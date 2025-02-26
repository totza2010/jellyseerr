import { MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import type { IgnoreItem } from '@server/interfaces/api/ignoreInterfaces';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ZodNumber, ZodOptional, ZodString } from 'zod';

@Entity()
export class Ignore implements IgnoreItem {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  @Index()
  public tmdbId: number;

  @Column({ nullable: true, type: 'varchar' })
  title?: string;

  @Column()
  @Index()
  public seasonNumber: number;

  @Column({ nullable: true, type: 'varchar' })
  seasonTitle?: string;

  @Column()
  @Index()
  public episodeNumber: number;

  @Column({ nullable: true, type: 'varchar' })
  episodeTitle?: string;

  @ManyToOne(() => User, (user) => user.id, {
    eager: true,
  })
  user: User;

  @OneToOne(() => Episode, (episode) => episode.ignore, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  public episode: Episode;

  @CreateDateColumn()
  public createdAt: Date;

  constructor(init?: Partial<Ignore>) {
    Object.assign(this, init);
  }

  public static async addToIgnore({
    ignoreRequest,
  }: {
    ignoreRequest: {
      tmdbId: ZodNumber['_output'];
      title?: ZodOptional<ZodString>['_output'];
      seasonNumber: ZodNumber['_output'];
      seasonTitle?: ZodOptional<ZodString>['_output'];
      episodeNumber: ZodNumber['_output'];
      episodeTitle?: ZodOptional<ZodString>['_output'];
    };
  }): Promise<void> {
    const ignore = new this({
      ...ignoreRequest,
    });

    const mediaRepository = getRepository(Media);
    const media = await mediaRepository.findOne({
      where: {
        tmdbId: ignoreRequest.tmdbId,
      },
    });

    if (!media) return;

    const seasonRepository = getRepository(Season);
    const season = await seasonRepository.findOne({
      where: {
        media: { id: media?.id },
        seasonNumber: ignoreRequest.seasonNumber,
      },
    });

    if (!season) return;

    const episodeRepository = getRepository(Episode);
    const episode = await episodeRepository.findOne({
      where: {
        season: { id: season?.id },
        episodeNumber: ignoreRequest.episodeNumber,
      },
    });

    if (!episode) return;

    const ignoreRepository = getRepository(this);

    await ignoreRepository.save(ignore);

    episode.ignore = Promise.resolve(ignore);
    episode.status = MediaStatus.IGNORED;
    episode.status4k = MediaStatus.IGNORED;

    await episodeRepository.save(episode);

    const season2 = await seasonRepository.findOne({
      where: {
        media: { id: media?.id },
        seasonNumber: ignoreRequest.seasonNumber,
      },
    });

    if (!season2) return;

    const filteredEpisodes = season2.episodes.filter(
      (episode) => episode.status !== MediaStatus.IGNORED
    );

    const filteredEpisodes4k = season2.episodes.filter(
      (episode) => episode.status !== MediaStatus.IGNORED
    );

    season2.status =
      filteredEpisodes.length > 0 &&
      filteredEpisodes.every(
        (episode) => episode.status === MediaStatus.AVAILABLE
      )
        ? MediaStatus.AVAILABLE
        : season2.episodes
            .filter((episode) => episode.status !== MediaStatus.IGNORED)
            .every((episode) => episode.status === MediaStatus.UNKNOWN)
        ? MediaStatus.UNKNOWN
        : season2.status;
    season2.status4k =
      filteredEpisodes4k.length > 0 &&
      filteredEpisodes4k.every(
        (episode) => episode.status4k === MediaStatus.AVAILABLE
      )
        ? MediaStatus.AVAILABLE
        : season2.episodes
            .filter((episode) => episode.status4k !== MediaStatus.IGNORED)
            .every((episode) => episode.status4k === MediaStatus.UNKNOWN)
        ? MediaStatus.UNKNOWN
        : season2.status4k;

    await seasonRepository.save(season2);

    const media2 = await mediaRepository.findOne({
      where: {
        tmdbId: ignoreRequest.tmdbId,
      },
    });

    if (!media2) return;

    const isAllStandardSeasons =
      media2.seasons.length &&
      media2.seasons
        .filter((season) => season.episodes.length > 0)
        .every((season) =>
          season.episodes
            .filter((episode) => episode.status !== MediaStatus.IGNORED)
            .every((episode) => episode.status === MediaStatus.AVAILABLE)
        );

    const isAll4kSeasons =
      media2.seasons.length &&
      media2.seasons
        .filter((season) => season.episodes.length > 0)
        .every((season) =>
          season.episodes
            .filter((episode) => episode.status4k !== MediaStatus.IGNORED)
            .every((episode) => episode.status4k === MediaStatus.AVAILABLE)
        );

    media2.status = isAllStandardSeasons
      ? MediaStatus.AVAILABLE
      : media2.seasons.some(
          (season) =>
            season.status === MediaStatus.PARTIALLY_AVAILABLE ||
            season.status === MediaStatus.AVAILABLE
        )
      ? MediaStatus.PARTIALLY_AVAILABLE
      : media2.seasons.some(
          (season) => season.status === MediaStatus.PROCESSING
        )
      ? MediaStatus.PROCESSING
      : MediaStatus.UNKNOWN;
    media2.status4k = isAll4kSeasons
      ? MediaStatus.AVAILABLE
      : media2.seasons.some(
          (season) =>
            season.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
            season.status4k === MediaStatus.AVAILABLE
        )
      ? MediaStatus.PARTIALLY_AVAILABLE
      : media2.seasons.some(
          (season) => season.status4k === MediaStatus.PROCESSING
        )
      ? MediaStatus.PROCESSING
      : MediaStatus.UNKNOWN;

    await mediaRepository.save(media2);
  }
}
