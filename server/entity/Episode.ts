import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import { getSettings } from '@server/lib/settings';
import {
  AfterLoad,
  AfterUpdate,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Season from './Season';

@Entity()
class Episode {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public episodeNumber: number;

  @Column({ nullable: true, type: 'varchar' })
  public ratingKey?: string | null;

  public mediaUrl?: string;

  public iOSPlexUrl?: string;

  public tautulliUrl?: string;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status: MediaStatus;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  public status4k: MediaStatus;

  @Column({ type: 'text', nullable: true })
  public part?: string;

  @ManyToOne(() => Season, (season) => season.episodes, {
    onDelete: 'CASCADE',
  })
  public season: Promise<Season>;

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
    }
  }

  @AfterUpdate()
  public updatePlexUrls(): void {
    this.setPlexUrls();
  }
}

export default Episode;
