import TheMovieDb from '@server/api/themoviedb';
import { MediaStatus, MediaType } from '@server/constants/media';
import dataSource, { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import { Ignore } from '@server/entity/Ignore';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import AsyncLock from '@server/utils/asyncLock';
import { randomUUID } from 'crypto';

// Default scan rates (can be overidden)
const BUNDLE_SIZE = 20;
const UPDATE_RATE = 4 * 1000;

export type StatusBase = {
  running: boolean;
  progress: number;
  total: number;
};

export interface RunnableScanner<T> {
  run: () => Promise<void>;
  status: () => T & StatusBase;
}

export interface MediaIds {
  tmdbId: number;
  imdbId?: string;
  tvdbId?: number;
  isHama?: boolean;
}

interface ProcessOptions {
  is4k?: boolean;
  mediaAddedAt?: Date;
  ratingKey?: string;
  serviceId?: number;
  externalServiceId?: number;
  externalServiceSlug?: string;
  title?: string;
  part?: string | null;
  processing?: boolean;
}

export interface ProcessableSeason {
  seasonNumber: number;
  ratingKey?: string | null;
  totalEpisodes: number;
  episodes: number;
  episodes4k: number;
  is4kOverride?: boolean;
  processing?: boolean;
  allEpisodes: allEpisodes[];
}

export interface allEpisodes {
  episodeNumber: number;
  ratingKey?: string | null;
  part?: string | null;
}

export interface part {
  file: string;
  size?: number;
}

class BaseScanner<T> {
  private bundleSize;
  private updateRate;
  protected progress = 0;
  protected items: T[] = [];
  protected totalSize?: number = 0;
  protected scannerName: string;
  protected enable4kMovie = false;
  protected enable4kShow = false;
  protected sessionId: string;
  protected running = false;
  readonly asyncLock = new AsyncLock();
  readonly tmdb = new TheMovieDb();

  protected constructor(
    scannerName: string,
    {
      updateRate,
      bundleSize,
    }: {
      updateRate?: number;
      bundleSize?: number;
    } = {}
  ) {
    this.scannerName = scannerName;
    this.bundleSize = bundleSize ?? BUNDLE_SIZE;
    this.updateRate = updateRate ?? UPDATE_RATE;
  }

  private async getExisting(tmdbId: number, mediaType: MediaType) {
    const mediaRepository = getRepository(Media);

    const existing = await mediaRepository.findOne({
      where: { tmdbId: tmdbId, mediaType },
    });

    return existing;
  }

  private async updateMedia(media: Media) {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const mediaRepository = queryRunner.manager.getRepository(Media);
      const seasonRepository = queryRunner.manager.getRepository(Season);
      const episodeRepository = queryRunner.manager.getRepository(Episode);

      // ถ้า media ไม่มี id -> ใช้ save() เพื่อสร้างใหม่
      if (
        !media.id ||
        media.seasons?.some((s) => !s.id) ||
        media.seasons?.some((s) => s.episodes?.some((e) => !e.id))
      ) {
        const savedMedia = await mediaRepository.save(media);
        this.log(`[INFO] Saved new media with ID: ${savedMedia.id}`);
        return;
      }

      if (!media || !media.id) return;

      try {
        this.log(`[DEBUG] Updating media ID: ${media.id}`);
        const dbType = dataSource.options.type;
        const isPostgres = dbType === 'postgres';
        const query = isPostgres
          ? `UPDATE media SET status = $1, status4k = $2 WHERE id = $3`
          : `UPDATE media SET status = ?, status4k = ? WHERE id = ?`;

        await mediaRepository.query(query, [
          media.status,
          media.status4k,
          media.id,
        ]);

        await mediaRepository
          .createQueryBuilder()
          .update(Media)
          .set({
            tmdbId: media.tmdbId,
            tvdbId: media.tvdbId,
            imdbId: media.imdbId,
            mediaAddedAt: media.mediaAddedAt,
            ratingKey: media.ratingKey,
            ratingKey4k: media.ratingKey4k,
            parts: media.parts,
            serviceId: media.serviceId,
            serviceId4k: media.serviceId4k,
            externalServiceId: media.externalServiceId,
            externalServiceId4k: media.externalServiceId4k,
            externalServiceSlug: media.externalServiceSlug,
            externalServiceSlug4k: media.externalServiceSlug4k,
            jellyfinMediaId: media.jellyfinMediaId,
            jellyfinMediaId4k: media.jellyfinMediaId4k,
          })
          .where('id = :id', { id: media.id })
          .execute();
      } catch (error) {
        this.log(`After update - media.status:: ${media.status}`);
        this.log(`[ERROR] Failed to update media ID: ${media.id} - ${error}`);
      }

      for (const season of media.seasons ?? []) {
        if (!season || !season.id) continue;

        try {
          this.log(
            `[DEBUG] Updating season ID: ${season.id} (Media ID: ${media.id})`
          );
          await seasonRepository
            .createQueryBuilder()
            .update(Season)
            .set({
              seasonNumber: season.seasonNumber,
              ratingKey: season.ratingKey,
              ratingKey4k: season.ratingKey4k,
              status: season.status,
              status4k: season.status4k,
            })
            .where('id = :id', { id: season.id })
            .execute();
        } catch (error) {
          this.log(
            `[ERROR] Failed to update season ID: ${season.id} (Media ID: ${media.id} - ${error})`
          );
        }

        for (const episode of season.episodes ?? []) {
          if (!episode || !episode.id) continue;

          try {
            this.log(
              `[DEBUG] Updating episode ID: ${episode.id} (Season ID: ${season.id})`
            );
            await episodeRepository
              .createQueryBuilder()
              .update(Episode)
              .set({
                episodeNumber: episode.episodeNumber,
                ratingKey: episode.ratingKey,
                ratingKey4k: episode.ratingKey4k,
                status: episode.status,
                status4k: episode.status4k,
                part: episode.part,
              })
              .where('id = :id', { id: episode.id })
              .execute();
          } catch (error) {
            this.log(
              `[ERROR] Failed to update episode ID: ${episode.id} (Season ID: ${season.id} - ${error})`
            );
          }
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      this.log(`[ERROR] Failed to update media ID: ${media.id} - ${error}`);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  protected async processMovie(
    tmdbId: number,
    {
      is4k = false,
      mediaAddedAt,
      ratingKey,
      serviceId,
      externalServiceId,
      externalServiceSlug,
      processing = false,
      title = 'Unknown Title',
      part,
    }: ProcessOptions = {}
  ): Promise<void> {
    await this.asyncLock.dispatch(tmdbId, async () => {
      const existing = await this.getExisting(tmdbId, MediaType.MOVIE);

      if (existing) {
        let changedExisting = false;

        if (existing[is4k ? 'status4k' : 'status'] !== MediaStatus.AVAILABLE) {
          existing[is4k ? 'status4k' : 'status'] = processing
            ? MediaStatus.PROCESSING
            : MediaStatus.AVAILABLE;
          if (mediaAddedAt) {
            existing.mediaAddedAt = mediaAddedAt;
          }
          changedExisting = true;
        }

        if (!changedExisting && !existing.mediaAddedAt && mediaAddedAt) {
          existing.mediaAddedAt = mediaAddedAt;
          changedExisting = true;
        }

        if (
          ratingKey &&
          existing[is4k ? 'ratingKey4k' : 'ratingKey'] !== ratingKey
        ) {
          existing[is4k ? 'ratingKey4k' : 'ratingKey'] = ratingKey;
          changedExisting = true;
        }

        if (
          serviceId !== undefined &&
          existing[is4k ? 'serviceId4k' : 'serviceId'] !== serviceId
        ) {
          existing[is4k ? 'serviceId4k' : 'serviceId'] = serviceId;
          changedExisting = true;
        }

        if (
          externalServiceId !== undefined &&
          existing[is4k ? 'externalServiceId4k' : 'externalServiceId'] !==
            externalServiceId
        ) {
          existing[is4k ? 'externalServiceId4k' : 'externalServiceId'] =
            externalServiceId;
          changedExisting = true;
        }

        if (
          externalServiceSlug !== undefined &&
          existing[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] !==
            externalServiceSlug
        ) {
          existing[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] =
            externalServiceSlug;
          changedExisting = true;
        }

        existing.parts =
          JSON.stringify([
            ...JSON.parse(existing.parts ?? '[]'),
            ...JSON.parse(part ?? '[]'),
          ]) || null;

        if (changedExisting) {
          await this.updateMedia(existing);
          this.log(
            `Media for ${title} exists. Changes were detected and the title will be updated.`,
            'info'
          );
        } else {
          this.log(`Title already exists and no changes detected for ${title}`);
        }
      } else {
        const newMedia = new Media();
        newMedia.tmdbId = tmdbId;

        newMedia.status =
          !is4k && !processing
            ? MediaStatus.AVAILABLE
            : !is4k && processing
            ? MediaStatus.PROCESSING
            : MediaStatus.UNKNOWN;
        newMedia.status4k =
          is4k && this.enable4kMovie && !processing
            ? MediaStatus.AVAILABLE
            : is4k && this.enable4kMovie && processing
            ? MediaStatus.PROCESSING
            : MediaStatus.UNKNOWN;
        newMedia.mediaType = MediaType.MOVIE;
        newMedia.serviceId = !is4k ? serviceId : undefined;
        newMedia.serviceId4k = is4k ? serviceId : undefined;
        newMedia.externalServiceId = !is4k ? externalServiceId : undefined;
        newMedia.externalServiceId4k = is4k ? externalServiceId : undefined;
        newMedia.externalServiceSlug = !is4k ? externalServiceSlug : undefined;
        newMedia.externalServiceSlug4k = is4k ? externalServiceSlug : undefined;

        if (mediaAddedAt) {
          newMedia.mediaAddedAt = mediaAddedAt;
        }

        if (ratingKey) {
          newMedia.ratingKey = !is4k ? ratingKey : undefined;
          newMedia.ratingKey4k =
            is4k && this.enable4kMovie ? ratingKey : undefined;
        }
        newMedia.parts = part;
        await this.updateMedia(newMedia);
        this.log(`Saved new media: ${title}`);
      }
    });
  }

  /**
   * processShow takes a TMDB ID and an array of ProcessableSeasons, which
   * should include the total episodes a sesaon has + the total available
   * episodes that each season currently has. Unlike processMovie, this method
   * does not take an `is4k` option. We handle both the 4k _and_ non 4k status
   * in one method.
   *
   * Note: If 4k is not enable, ProcessableSeasons should combine their episode counts
   * into the normal episodes properties and avoid using the 4k properties.
   */
  protected async processShow(
    tmdbId: number,
    seasons: ProcessableSeason[],
    tvdbId?: number,
    {
      mediaAddedAt,
      ratingKey,
      serviceId,
      externalServiceId,
      externalServiceSlug,
      is4k = false,
      title = 'Unknown Title',
    }: ProcessOptions = {}
  ): Promise<void> {
    const updateStatus = (
      oldStatus: MediaStatus,
      newStatus: MediaStatus,
      epispde = false
    ) => {
      if (oldStatus === MediaStatus.AVAILABLE && epispde)
        return MediaStatus.AVAILABLE;
      if (oldStatus !== MediaStatus.AVAILABLE && epispde) return newStatus;
      if (
        oldStatus === MediaStatus.MIXED_AVAILABILITY ||
        newStatus === MediaStatus.MIXED_AVAILABILITY
      )
        return MediaStatus.MIXED_AVAILABILITY;
      if (
        oldStatus === MediaStatus.AVAILABLE &&
        newStatus === MediaStatus.AVAILABLE
      )
        return MediaStatus.AVAILABLE;
      if (
        oldStatus === MediaStatus.AVAILABLE &&
        newStatus === MediaStatus.UNKNOWN
      )
        return MediaStatus.MIXED_AVAILABILITY;
      if (
        oldStatus === MediaStatus.AVAILABLE &&
        newStatus === MediaStatus.PARTIALLY_AVAILABLE
      )
        return MediaStatus.MIXED_AVAILABILITY;
      if (
        oldStatus === MediaStatus.PARTIALLY_AVAILABLE &&
        newStatus === MediaStatus.AVAILABLE
      )
        return MediaStatus.MIXED_AVAILABILITY;
      if (
        oldStatus === MediaStatus.PARTIALLY_AVAILABLE &&
        newStatus === MediaStatus.UNKNOWN
      )
        return MediaStatus.MIXED_AVAILABILITY;
      if (
        oldStatus === MediaStatus.PARTIALLY_AVAILABLE &&
        newStatus === MediaStatus.PARTIALLY_AVAILABLE
      )
        return MediaStatus.PARTIALLY_AVAILABLE;
      if (
        oldStatus === MediaStatus.UNKNOWN &&
        newStatus === MediaStatus.AVAILABLE
      )
        return MediaStatus.MIXED_AVAILABILITY;
      if (
        oldStatus === MediaStatus.UNKNOWN &&
        newStatus === MediaStatus.UNKNOWN
      )
        return MediaStatus.UNKNOWN;
      if (
        oldStatus === MediaStatus.UNKNOWN &&
        newStatus === MediaStatus.PARTIALLY_AVAILABLE
      )
        return MediaStatus.PARTIALLY_AVAILABLE;

      return newStatus;
    };

    const updateRatingKey = (
      existingKey?: string | null,
      newKey?: string | null
    ): string | null => {
      if (!newKey) return existingKey ?? null;
      const updatedKey = [
        ...new Set(
          (existingKey ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .concat(newKey)
        ),
      ].join(', ');
      return updatedKey || null;
    };

    await this.asyncLock.dispatch(tmdbId, async () => {
      const media = await this.getExisting(tmdbId, MediaType.TV);
      const ignoreRepository = getRepository(Ignore);

      const newSeasons: Season[] = [];
      const sSeasons: Season[] = [];

      const mediaIs4k =
        this.enable4kShow && seasons?.some((s) => s.episodes4k > 0);

      if (media && !mediaIs4k) {
        media.ratingKey = updateRatingKey(media.ratingKey, ratingKey);
      }

      if (media && mediaIs4k) {
        media.ratingKey4k = updateRatingKey(media.ratingKey4k, ratingKey);
      }

      const seasonMap = new Map(media?.seasons.map((s) => [s.seasonNumber, s]));
      const sSeasonMap = new Map(sSeasons.map((s) => [s.seasonNumber, s]));

      for (const season of seasons) {
        const seasonIs4k = this.enable4kShow && season.episodes4k > 0;
        const existingSeason = seasonMap.get(season.seasonNumber);

        const sSeason =
          sSeasonMap.get(season.seasonNumber) ??
          new Season({
            seasonNumber: season.seasonNumber,
            ratingKey: !seasonIs4k ? season.ratingKey : null,
            ratingKey4k: seasonIs4k ? season.ratingKey : null,
            status: MediaStatus.DISABLED,
            status4k: MediaStatus.DISABLED,
            episodes: [],
          });

        if (!sSeasonMap.has(season.seasonNumber)) {
          sSeasons.push(sSeason);
          sSeasonMap.set(season.seasonNumber, sSeason);
        }

        const episodeMap = new Map(
          existingSeason?.episodes?.map((s) => [s.episodeNumber, s])
        );

        const ignoreDataEntries = await Promise.all(
          season.allEpisodes.map(async (episode) => {
            const ignoreData = await ignoreRepository.findOne({
              where: {
                tmdbId,
                seasonNumber: season.seasonNumber,
                episodeNumber: episode.episodeNumber,
              },
            });
            return [episode.episodeNumber, ignoreData] as const;
          })
        );

        const ignoreDataMap = new Map<number, Ignore | null>(ignoreDataEntries);

        const newEpisodes: Episode[] = [];

        for (const episode of season.allEpisodes) {
          const existingEpisode = episodeMap.get(episode.episodeNumber);
          const ignoreData = ignoreDataMap.get(episode.episodeNumber);

          const hasRatingKey = episode.part && episode.ratingKey;
          const hasSeasonEpisodes = season.allEpisodes.some((e) => e.ratingKey);

          const calculateStatus = () =>
            ignoreData
              ? MediaStatus.IGNORED
              : hasRatingKey
              ? MediaStatus.AVAILABLE
              : hasSeasonEpisodes
              ? MediaStatus.MISSING
              : MediaStatus.UNKNOWN;

          const sEpisode = new Episode({
            episodeNumber: episode.episodeNumber,
            ratingKey: !seasonIs4k ? episode.ratingKey : null,
            ratingKey4k: seasonIs4k ? episode.ratingKey : null,
            part: episode.part,
            status: !seasonIs4k ? calculateStatus() : MediaStatus.DISABLED,
            status4k: seasonIs4k ? calculateStatus() : MediaStatus.DISABLED,
          });

          sSeason.episodes.push(sEpisode);

          if (existingEpisode) {
            const existingParts = existingEpisode.part
              ? JSON.parse(existingEpisode.part)
              : [];
            const newParts = sEpisode.part ? JSON.parse(sEpisode.part) : [];
            const combinedParts = [...existingParts, ...newParts];

            existingEpisode.ratingKey = !seasonIs4k
              ? updateRatingKey(existingEpisode.ratingKey, sEpisode.ratingKey)
              : existingEpisode.ratingKey;
            existingEpisode.ratingKey4k = seasonIs4k
              ? updateRatingKey(
                  existingEpisode.ratingKey4k,
                  sEpisode.ratingKey4k
                )
              : existingEpisode.ratingKey4k;
            existingEpisode.part = combinedParts.length
              ? JSON.stringify(combinedParts)
              : null;
            existingEpisode.status = !seasonIs4k
              ? updateStatus(existingEpisode.status, sEpisode.status, true)
              : existingEpisode.status;
            existingEpisode.status4k = seasonIs4k
              ? updateStatus(existingEpisode.status4k, sEpisode.status4k, true)
              : existingEpisode.status4k;
          } else {
            newEpisodes.push(sEpisode);
          }
        }

        const countAvailableEpisodes = (ultraHD: boolean) => {
          const statusKey = ultraHD ? 'status4k' : 'status';
          const ratingKey = ultraHD ? 'ratingKey4k' : 'ratingKey';

          return sSeason.episodes.filter(
            (e) =>
              e[statusKey] !== MediaStatus.IGNORED && e.part && e[ratingKey]
          ).length;
        };

        const availableEpisodes = {
          normal: countAvailableEpisodes(false),
          ultraHD: countAvailableEpisodes(true),
        };

        const isComplete = (count: number) =>
          count > 0 && count === season.totalEpisodes;
        const isIncomplete = (count: number) => count > 0;

        const seasonStatus = {
          complete: isComplete(availableEpisodes.normal),
          incomplete: isIncomplete(availableEpisodes.normal),
          complete4k: seasonIs4k && isComplete(availableEpisodes.ultraHD),
          incomplete4k: seasonIs4k && isIncomplete(availableEpisodes.ultraHD),
        };

        const isProcessing = (ultraHD: boolean) =>
          Boolean(
            season.processing &&
              (ultraHD ? season.is4kOverride : !season.is4kOverride)
          );

        const processingStatus = {
          normal: isProcessing(false),
          ultraHD: isProcessing(true),
        };

        const calculateSeasonStatus = (ultraHD: boolean) => {
          if (seasonStatus[ultraHD ? 'complete4k' : 'complete'])
            return MediaStatus.AVAILABLE;
          if (seasonStatus[ultraHD ? 'incomplete4k' : 'incomplete'])
            return MediaStatus.PARTIALLY_AVAILABLE;
          if (processingStatus[ultraHD ? 'ultraHD' : 'normal'])
            return MediaStatus.PROCESSING;
          return MediaStatus.UNKNOWN;
        };

        sSeason.status = !seasonIs4k
          ? calculateSeasonStatus(false)
          : MediaStatus.DISABLED;
        sSeason.status4k = seasonIs4k
          ? calculateSeasonStatus(true)
          : MediaStatus.DISABLED;

        if (existingSeason) {
          existingSeason.ratingKey = !seasonIs4k
            ? updateRatingKey(existingSeason.ratingKey, sSeason.ratingKey)
            : existingSeason.ratingKey;
          existingSeason.ratingKey4k = seasonIs4k
            ? updateRatingKey(existingSeason.ratingKey4k, sSeason.ratingKey4k)
            : existingSeason.ratingKey4k;
          existingSeason.status = !seasonIs4k
            ? updateStatus(existingSeason.status, sSeason.status)
            : existingSeason.status;
          existingSeason.status4k = seasonIs4k
            ? updateStatus(existingSeason.status4k, sSeason.status4k)
            : existingSeason.status4k;
          existingSeason.episodes.push(...newEpisodes);
        } else {
          newSeasons.push(sSeason);
        }
      }

      const hasAvailableEpisodes = (season: Season, ultraHD: boolean) =>
        season.episodes.some((e) =>
          ultraHD
            ? e.status4k !== MediaStatus.IGNORED
            : e.status !== MediaStatus.IGNORED
        );

      const getOverallStatus = (seasons: Season[], ultraHD: boolean) => {
        const allAvailable = seasons.every(
          (s) =>
            hasAvailableEpisodes(s, ultraHD) &&
            (ultraHD ? s.status4k : s.status) === MediaStatus.AVAILABLE
        );

        return allAvailable
          ? MediaStatus.AVAILABLE
          : seasons.some((s) =>
              [
                MediaStatus.PARTIALLY_AVAILABLE,
                MediaStatus.MIXED_AVAILABILITY,
                MediaStatus.AVAILABLE,
              ].includes(ultraHD ? s.status4k : s.status)
            )
          ? MediaStatus.PARTIALLY_AVAILABLE
          : seasons.some(
              (s) =>
                (ultraHD ? s.status4k : s.status) === MediaStatus.PROCESSING
            )
          ? MediaStatus.PROCESSING
          : MediaStatus.DISABLED;
      };

      const isAllStandardSeasons = getOverallStatus(sSeasons, false);
      const isAll4kSeasons = getOverallStatus(sSeasons, true);

      if (media) {
        media.seasons = [...media.seasons, ...newSeasons];

        if (!media.mediaAddedAt && mediaAddedAt) {
          media.mediaAddedAt = mediaAddedAt;
        }

        media[is4k ? 'serviceId4k' : 'serviceId'] =
          serviceId ?? media[is4k ? 'serviceId4k' : 'serviceId'];
        media[is4k ? 'externalServiceId4k' : 'externalServiceId'] =
          externalServiceId ??
          media[is4k ? 'externalServiceId4k' : 'externalServiceId'];
        media[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] =
          externalServiceSlug ??
          media[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'];

        media.status = !mediaIs4k
          ? updateStatus(media.status, isAllStandardSeasons)
          : media.status;
        media.status4k = mediaIs4k
          ? updateStatus(media.status4k, isAll4kSeasons)
          : media.status4k;

        await this.updateMedia(media);
        this.log(`Updating existing title: ${title}`);
      } else {
        const newMedia = new Media({
          mediaType: MediaType.TV,
          seasons: newSeasons,
          tmdbId,
          tvdbId,
          mediaAddedAt,
          serviceId: !is4k ? serviceId : undefined,
          serviceId4k: is4k ? serviceId : undefined,
          externalServiceId: !is4k ? externalServiceId : undefined,
          externalServiceId4k: is4k ? externalServiceId : undefined,
          externalServiceSlug: !is4k ? externalServiceSlug : undefined,
          externalServiceSlug4k: is4k ? externalServiceSlug : undefined,
          ratingKey:
            !mediaIs4k &&
            newSeasons.some((sn) =>
              [MediaStatus.PARTIALLY_AVAILABLE, MediaStatus.AVAILABLE].includes(
                sn.status
              )
            )
              ? ratingKey
              : undefined,
          ratingKey4k:
            mediaIs4k &&
            newSeasons.some((sn) =>
              [MediaStatus.PARTIALLY_AVAILABLE, MediaStatus.AVAILABLE].includes(
                sn.status4k
              )
            )
              ? ratingKey
              : undefined,
          status: !mediaIs4k ? isAllStandardSeasons : MediaStatus.DISABLED,
          status4k: mediaIs4k ? isAll4kSeasons : MediaStatus.DISABLED,
        });
        await this.updateMedia(newMedia);
        this.log(`Saved ${title}`);
      }
    });
  }

  /**
   * Call startRun from child class whenever a run is starting to
   * ensure required values are set
   *
   * Returns the session ID which is requried for the cleanup method
   */
  protected startRun(): string {
    const settings = getSettings();
    const sessionId = randomUUID();
    this.sessionId = sessionId;

    this.log('Scan starting', 'info', { sessionId });

    this.enable4kMovie = settings.radarr.some((radarr) => radarr.is4k);
    if (this.enable4kMovie) {
      this.log(
        'At least one 4K Radarr server was detected. 4K movie detection is now enabled',
        'info'
      );
    }

    this.enable4kShow = settings.sonarr.some((sonarr) => sonarr.is4k);
    if (this.enable4kShow) {
      this.log(
        'At least one 4K Sonarr server was detected. 4K series detection is now enabled',
        'info'
      );
    }

    this.running = true;

    return sessionId;
  }

  /**
   * Call at end of run loop to perform cleanup
   */
  protected endRun(sessionId: string): void {
    if (this.sessionId === sessionId) {
      this.running = false;
    }
  }

  public cancel(): void {
    this.running = false;
  }

  protected async loop(
    processFn: (item: T) => Promise<void>,
    {
      start = 0,
      end = this.bundleSize,
      sessionId,
    }: {
      start?: number;
      end?: number;
      sessionId?: string;
    } = {}
  ): Promise<void> {
    const slicedItems = this.items.slice(start, end);

    if (!this.running) {
      throw new Error('Sync was aborted.');
    }

    if (this.sessionId !== sessionId) {
      throw new Error('New session was started. Old session aborted.');
    }

    if (start < this.items.length) {
      this.progress = start;
      await this.processItems(processFn, slicedItems);

      await new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          this.loop(processFn, {
            start: start + this.bundleSize,
            end: end + this.bundleSize,
            sessionId,
          })
            .then(() => resolve())
            .catch((e) => reject(new Error(e.message)));
        }, this.updateRate)
      );
    }
  }

  private async processItems(
    processFn: (items: T) => Promise<void>,
    items: T[]
  ) {
    await Promise.all(
      items.map(async (item) => {
        await processFn(item);
      })
    );
  }

  protected log(
    message: string,
    level: 'info' | 'error' | 'debug' | 'warn' = 'debug',
    optional?: Record<string, unknown>
  ): void {
    logger[level](message, { label: this.scannerName, ...optional });
  }

  get protectedUpdateRate(): number {
    return this.updateRate;
  }

  get protectedBundleSize(): number {
    return this.bundleSize;
  }
}

export default BaseScanner;
