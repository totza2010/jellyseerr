import { MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import Media from '@server/entity/Media';
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

    const ignoreRepository = getRepository(this);
    await ignoreRepository.save(ignore);

    const mediaRepository = getRepository(Media);
    const media = await mediaRepository.findOne({
      where: {
        tmdbId: ignoreRequest.tmdbId,
      },
    });

    if (!media) return;

    const season = media.seasons.find(
      (s) => s.seasonNumber === Number(ignoreRequest.seasonNumber)
    );

    if (!season) return;

    const episode = season.episodes.find(
      (e) => e.episodeNumber === Number(ignoreRequest.episodeNumber)
    );

    if (!episode) return;

    episode.ignore = Promise.resolve(ignore);
    episode.status = MediaStatus.IGNORED;
    episode.status4k = MediaStatus.IGNORED;

    const filteredEpisodes = season.episodes.filter(
      (e) => e.status !== MediaStatus.IGNORED
    );

    const filteredEpisodes4k = season.episodes.filter(
      (e) => e.status !== MediaStatus.IGNORED
    );

    season.status =
      filteredEpisodes.length > 0 &&
      filteredEpisodes.every((e) => e.status === MediaStatus.AVAILABLE)
        ? MediaStatus.AVAILABLE
        : season.episodes
            .filter((e) => e.status !== MediaStatus.IGNORED)
            .every((e) => e.status === MediaStatus.UNKNOWN)
        ? MediaStatus.UNKNOWN
        : season.status;
    season.status4k =
      filteredEpisodes4k.length > 0 &&
      filteredEpisodes4k.every((e) => e.status4k === MediaStatus.AVAILABLE)
        ? MediaStatus.AVAILABLE
        : season.episodes
            .filter((e) => e.status4k !== MediaStatus.IGNORED)
            .every((e) => e.status4k === MediaStatus.UNKNOWN)
        ? MediaStatus.UNKNOWN
        : season.status4k;

    const isAllStandardSeasons =
      media.seasons.length &&
      media.seasons
        .filter((s) => s.episodes.length > 0)
        .every((s) =>
          s.episodes
            .filter((e) => e.status !== MediaStatus.IGNORED)
            .every((e) => e.status === MediaStatus.AVAILABLE)
        );

    const isAll4kSeasons =
      media.seasons.length &&
      media.seasons
        .filter((s) => s.episodes.length > 0)
        .every((s) =>
          s.episodes
            .filter((e) => e.status4k !== MediaStatus.IGNORED)
            .every((e) => e.status4k === MediaStatus.AVAILABLE)
        );

    media.status = isAllStandardSeasons
      ? MediaStatus.AVAILABLE
      : media.seasons.some(
          (s) =>
            s.status === MediaStatus.PARTIALLY_AVAILABLE ||
            s.status === MediaStatus.MIXED_AVAILABILITY ||
            s.status === MediaStatus.AVAILABLE
        )
      ? MediaStatus.PARTIALLY_AVAILABLE
      : media.seasons.some((s) => s.status === MediaStatus.PROCESSING)
      ? MediaStatus.PROCESSING
      : MediaStatus.UNKNOWN;
    media.status4k = isAll4kSeasons
      ? MediaStatus.AVAILABLE
      : media.seasons.some(
          (s) =>
            s.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
            s.status4k === MediaStatus.MIXED_AVAILABILITY ||
            s.status4k === MediaStatus.AVAILABLE
        )
      ? MediaStatus.PARTIALLY_AVAILABLE
      : media.seasons.some((s) => s.status4k === MediaStatus.PROCESSING)
      ? MediaStatus.PROCESSING
      : MediaStatus.UNKNOWN;

    await mediaRepository.save(media);
  }
}
