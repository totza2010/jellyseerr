import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getSettings } from '@server/lib/settings';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  AfterLoad,
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import Episode from './Episode';
import Media from './Media';

@Entity()
@Unique(['seasonNumber', 'tmdbId'])
class Season {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  @Index()
  public tmdbId: number;

  @Column()
  public seasonNumber: number;

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

  @OneToMany(() => Episode, (episode) => episode.season, {
    cascade: true,
    eager: true,
  })
  public episodes: Episode[];

  @ManyToOne(() => Media, (media) => media.seasons, {
    onDelete: 'CASCADE',
  })
  public media: Promise<Media>;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @DbAwareColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<Season>) {
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

export default Season;
