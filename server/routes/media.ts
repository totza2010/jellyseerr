import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TautulliAPI from '@server/api/tautulli';
import TheMovieDb from '@server/api/themoviedb';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type {
  MediaResultsResponse,
  MediaWatchDataResponse,
} from '@server/interfaces/api/mediaInterfaces';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import type { FindOneOptions } from 'typeorm';
import { In } from 'typeorm';

const mediaRoutes = Router();

mediaRoutes.get('/', async (req, res, next) => {
  const mediaRepository = getRepository(Media);

  const pageSize = req.query.take ? Number(req.query.take) : 20;
  const skip = req.query.skip ? Number(req.query.skip) : 0;

  let statusFilter = undefined;

  switch (req.query.filter) {
    case 'available':
      statusFilter = MediaStatus.AVAILABLE;
      break;
    case 'partial':
      statusFilter = MediaStatus.PARTIALLY_AVAILABLE;
      break;
    case 'allavailable':
      statusFilter = In([
        MediaStatus.AVAILABLE,
        MediaStatus.PARTIALLY_AVAILABLE,
        MediaStatus.MIXED_AVAILABILITY,
      ]);
      break;
    case 'processing':
      statusFilter = MediaStatus.PROCESSING;
      break;
    case 'pending':
      statusFilter = MediaStatus.PENDING;
      break;
    case 'mixed':
      statusFilter = MediaStatus.MIXED_AVAILABILITY;
      break;
    default:
      statusFilter = undefined;
  }

  let mediaTypeFilter = undefined;

  switch (req.query.type) {
    case 'all':
      mediaTypeFilter = MediaType.MOVIE || MediaType.TV;
      break;
    case 'movie':
      mediaTypeFilter = MediaType.MOVIE;
      break;
    case 'tv':
      mediaTypeFilter = MediaType.TV;
      break;
    default:
      mediaTypeFilter = undefined;
  }

  // let sortFilter: string;
  let sortDirection: 'ASC' | 'DESC';

  switch (req.query.sortDirection) {
    case 'asc':
      sortDirection = 'ASC';
      break;
    default:
      sortDirection = 'DESC';
  }

  let sortFilter: FindOneOptions<Media>['order'] = {
    id: 'DESC',
  };

  switch (req.query.sort) {
    case 'modified':
      sortFilter = {
        updatedAt: sortDirection,
      };
      break;
    case 'mediaAdded':
      sortFilter = {
        mediaAddedAt: sortDirection,
      };
  }

  try {
    const [media, mediaCount] = await mediaRepository.findAndCount({
      order: sortFilter,
      where: statusFilter
        ? [
            { status: statusFilter, mediaType: mediaTypeFilter },
            { status4k: statusFilter, mediaType: mediaTypeFilter },
          ]
        : { mediaType: mediaTypeFilter },
      take: pageSize,
      skip,
    });
    return res.status(200).json({
      pageInfo: {
        pages: Math.ceil(mediaCount / pageSize),
        pageSize,
        results: mediaCount,
        page: Math.ceil(skip / pageSize) + 1,
      },
      results: media,
    } as MediaResultsResponse);
  } catch (e) {
    next({ status: 500, message: e.message });
  }
});

mediaRoutes.post<
  {
    id: string;
    status: 'available' | 'partial' | 'processing' | 'pending' | 'unknown';
  },
  Media
>(
  '/:id/:status',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    const mediaRepository = getRepository(Media);
    const seasonRepository = getRepository(Season);

    const media = await mediaRepository.findOne({
      where: { id: Number(req.params.id) },
    });

    if (!media) {
      return next({ status: 404, message: 'Media does not exist.' });
    }

    const is4k = Boolean(req.body.is4k);

    switch (req.params.status) {
      case 'available':
        media[is4k ? 'status4k' : 'status'] = MediaStatus.AVAILABLE;

        if (media.mediaType === MediaType.TV) {
          const expectedSeasons = req.body.seasons ?? [];

          for (const expectedSeason of expectedSeasons) {
            let season = media.seasons.find(
              (s) => s.seasonNumber === expectedSeason?.seasonNumber
            );

            if (!season) {
              // Create the season if it doesn't exist
              season = seasonRepository.create({
                seasonNumber: expectedSeason?.seasonNumber,
              });
              media.seasons.push(season);
            }

            season[is4k ? 'status4k' : 'status'] = MediaStatus.AVAILABLE;
          }
        }
        break;
      case 'partial':
        if (media.mediaType === MediaType.MOVIE) {
          return next({
            status: 400,
            message: 'Only series can be set to be partially available',
          });
        }
        media.status = MediaStatus.PARTIALLY_AVAILABLE;
        break;
      case 'processing':
        media.status = MediaStatus.PROCESSING;
        break;
      case 'pending':
        media.status = MediaStatus.PENDING;
        break;
      case 'unknown':
        media.status = MediaStatus.UNKNOWN;
    }

    await mediaRepository.save(media);

    return res.status(200).json(media);
  }
);

mediaRoutes.delete(
  '/:id',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const mediaRepository = getRepository(Media);

      const media = await mediaRepository.findOneOrFail({
        where: { id: Number(req.params.id) },
      });

      await mediaRepository.remove(media);

      return res.status(204).send();
    } catch (e) {
      logger.error('Something went wrong fetching media in delete request', {
        label: 'Media',
        message: e.message,
      });
      next({ status: 404, message: 'Media not found' });
    }
  }
);

mediaRoutes.delete(
  '/:id/file',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    try {
      const settings = getSettings();
      const mediaRepository = getRepository(Media);
      const media = await mediaRepository.findOneOrFail({
        where: { id: Number(req.params.id) },
      });
      const is4k = media.serviceUrl4k !== undefined;
      const isMovie = media.mediaType === MediaType.MOVIE;
      let serviceSettings;
      if (isMovie) {
        serviceSettings = settings.radarr.find(
          (radarr) => radarr.isDefault && radarr.is4k === is4k
        );
      } else {
        serviceSettings = settings.sonarr.find(
          (sonarr) => sonarr.isDefault && sonarr.is4k === is4k
        );
      }

      if (
        media.serviceId &&
        media.serviceId >= 0 &&
        serviceSettings?.id !== media.serviceId
      ) {
        if (isMovie) {
          serviceSettings = settings.radarr.find(
            (radarr) => radarr.id === media.serviceId
          );
        } else {
          serviceSettings = settings.sonarr.find(
            (sonarr) => sonarr.id === media.serviceId
          );
        }
      }
      if (!serviceSettings) {
        logger.warn(
          `There is no default ${
            is4k ? '4K ' : '' + isMovie ? 'Radarr' : 'Sonarr'
          }/ server configured. Did you set any of your ${
            is4k ? '4K ' : '' + isMovie ? 'Radarr' : 'Sonarr'
          } servers as default?`,
          {
            label: 'Media Request',
            mediaId: media.id,
          }
        );
        return;
      }
      let service;
      if (isMovie) {
        service = new RadarrAPI({
          apiKey: serviceSettings?.apiKey,
          url: RadarrAPI.buildUrl(serviceSettings, '/api/v3'),
        });
      } else {
        service = new SonarrAPI({
          apiKey: serviceSettings?.apiKey,
          url: SonarrAPI.buildUrl(serviceSettings, '/api/v3'),
        });
      }

      if (isMovie) {
        await (service as RadarrAPI).removeMovie(
          parseInt(
            is4k
              ? (media.externalServiceSlug4k as string)
              : (media.externalServiceSlug as string)
          )
        );
      } else {
        const tmdb = new TheMovieDb();
        const series = await tmdb.getTvShow({ tvId: media.tmdbId });
        const tvdbId = series.external_ids.tvdb_id ?? media.tvdbId;
        if (!tvdbId) {
          throw new Error('TVDB ID not found');
        }
        await (service as SonarrAPI).removeSerie(tvdbId);
      }

      return res.status(204).send();
    } catch (e) {
      logger.error('Something went wrong fetching media in delete request', {
        label: 'Media',
        message: e.message,
      });
      next({ status: 404, message: 'Media not found' });
    }
  }
);

mediaRoutes.get<{ id: string }, MediaWatchDataResponse>(
  '/:id/watch_data',
  isAuthenticated(Permission.ADMIN),
  async (req, res, next) => {
    const settings = getSettings().tautulli;

    if (!settings.hostname || !settings.port || !settings.apiKey) {
      return next({
        status: 404,
        message: 'Tautulli API not configured.',
      });
    }

    const media = await getRepository(Media).findOne({
      where: { id: Number(req.params.id) },
    });

    if (!media) {
      return next({ status: 404, message: 'Media does not exist.' });
    }

    try {
      const tautulli = new TautulliAPI(settings);
      const userRepository = getRepository(User);

      const response: MediaWatchDataResponse = {};

      if (media.ratingKey) {
        const ratingKeys = media.ratingKey.split(/\s*,\s*/); // รองรับ "1234, 5678"

        // ดึงข้อมูลจาก Tautulli สำหรับทุก key
        const watchStatsArray = await Promise.all(
          ratingKeys.map((key) => tautulli.getMediaWatchStats(key))
        );
        const watchUsersArray = await Promise.all(
          ratingKeys.map((key) => tautulli.getMediaWatchUsers(key))
        );

        // รวมค่าที่ได้จากทุก ratingKey
        const watchStats = watchStatsArray.flat();
        const watchUsers = watchUsersArray.flat();

        // ดึง plexId ของผู้ใช้ที่ดูเนื้อหานี้
        const plexIds = [...new Set(watchUsers.map((u) => u.user_id))]; // ลบค่า duplicate

        let users: User[] = [];
        if (plexIds.length > 0) {
          users = await userRepository
            .createQueryBuilder('user')
            .where('user.plexId IN (:...plexIds)', { plexIds })
            .getMany();
        }

        // รวมค่า playCount จากหลาย ratingKey
        const getTotalPlays = (days: number) =>
          watchStats
            .filter((i) => i.query_days === days)
            .reduce((sum, stat) => sum + (stat.total_plays ?? 0), 0);

        response.data = {
          users,
          playCount: getTotalPlays(0),
          playCount7Days: getTotalPlays(7),
          playCount30Days: getTotalPlays(30),
        };
      }

      if (media.ratingKey4k) {
        const ratingKeys4k = media.ratingKey4k.split(/\s*,\s*/); // แยกค่าที่คั่นด้วย ", "

        // ดึงข้อมูลจาก Tautulli สำหรับทุก key
        const watchStatsArray4k = await Promise.all(
          ratingKeys4k.map((key) => tautulli.getMediaWatchStats(key))
        );
        const watchUsersArray4k = await Promise.all(
          ratingKeys4k.map((key) => tautulli.getMediaWatchUsers(key))
        );

        // รวมค่าที่ได้จากทุก ratingKey4k
        const watchStats4k = watchStatsArray4k.flat();
        const watchUsers4k = watchUsersArray4k.flat();

        // ดึง plexId ของผู้ใช้ที่ดูเนื้อหานี้
        const plexIds4k = [...new Set(watchUsers4k.map((u) => u.user_id))]; // ลบค่า duplicate

        let users4k: User[] = [];
        if (plexIds4k.length > 0) {
          users4k = await userRepository
            .createQueryBuilder('user')
            .where('user.plexId IN (:...plexIds4k)', { plexIds4k })
            .getMany();
        }

        // รวมค่า playCount จากหลาย ratingKey4k
        const getTotalPlays = (days: number) =>
          watchStats4k
            .filter((i) => i.query_days === days)
            .reduce((sum, stat) => sum + (stat.total_plays ?? 0), 0);

        response.data4k = {
          users: users4k,
          playCount: getTotalPlays(0),
          playCount7Days: getTotalPlays(7),
          playCount30Days: getTotalPlays(30),
        };
      }

      return res.status(200).json(response);
    } catch (e) {
      logger.error('Something went wrong fetching media watch data', {
        label: 'API',
        errorMessage: e.message,
        mediaId: req.params.id,
      });
      next({ status: 500, message: 'Failed to fetch watch data.' });
    }
  }
);

export default mediaRoutes;
