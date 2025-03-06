import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { Ignore } from '@server/entity/Ignore';
import { getSettings } from '@server/lib/settings';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import Season from './Season';

@Entity()
@Unique(['episodeNumber', 'seasonNumber', 'tmdbId'])
class Episode {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  @Index()
  public tmdbId: number;

  @Column()
  public seasonNumber: number;

  @Column()
  public episodeNumber: number;

  @Column({ nullable: true, type: 'varchar' })
  public ratingKey?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  public ratingKey4k?: string | null;

  public mediaUrl?: string;
  public mediaUrl4k?: string;

  public iOSPlexUrl?: string;
  public iOSPlexUrl4k?: string;

  public tautulliUrl?: string;
  public tautulliUrl4k?: string;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status4k: MediaStatus;

  @Column({ type: 'text', nullable: true })
  public part?: string | null;

  @ManyToOne(() => Season, (season) => season.episodes, {
    onDelete: 'CASCADE',
  })
  public season: Promise<Season>;

  @OneToOne(() => Ignore, (ignore) => ignore.episode)
  public ignore: Promise<Ignore>;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<Episode>) {
    Object.assign(this, init);
  }

  @AfterLoad()
  public setPlexUrls(): void {
    const { machineId, webAppUrl } = getSettings().plex;
    const { externalUrl: tautulliUrl } = getSettings().tautulli;
    const { externalUrl: tautulliUrl4k } = getSettings().tautulli;

    if (getSettings().main.mediaServerType === MediaServerType.PLEX) {
      if (this.ratingKey) {
        const ratingKeys = this.ratingKey
          .split(/\s*,\s*/)
          .map((key) => key.trim());

        this.mediaUrl = ratingKeys
          .map(
            (key) =>
              `${
                webAppUrl ? webAppUrl : 'https://app.plex.tv/desktop'
              }#!/server/${machineId}/details?key=%2Flibrary%2Fmetadata%2F${key}`
          )
          .join(', ');

        this.iOSPlexUrl = ratingKeys
          .map(
            (key) =>
              `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${key}&server=${machineId}`
          )
          .join(', ');

        if (tautulliUrl) {
          this.tautulliUrl = ratingKeys
            .map((key) => `${tautulliUrl}/info?rating_key=${key}`)
            .join(', ');
        }
      }

      if (this.ratingKey4k) {
        const ratingKeys4k = this.ratingKey4k
          .split(/\s*,\s*/)
          .map((key) => key.trim());

        this.mediaUrl4k = ratingKeys4k
          .map(
            (key) =>
              `${
                webAppUrl ? webAppUrl : 'https://app.plex.tv/desktop'
              }#!/server/${machineId}/details?key=%2Flibrary%2Fmetadata%2F${key}`
          )
          .join(', ');

        this.iOSPlexUrl4k = ratingKeys4k
          .map(
            (key) =>
              `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${key}&server=${machineId}`
          )
          .join(', ');

        if (tautulliUrl4k) {
          this.tautulliUrl4k = ratingKeys4k
            .map((key) => `${tautulliUrl4k}/info?rating_key=${key}`)
            .join(', ');
        }
      }
    }
  }
}

export default Episode;
