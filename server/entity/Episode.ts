import { MediaServerType } from '@server/constants/server';
import Part from '@server/entity/Part';
import { getSettings } from '@server/lib/settings';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
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

  @OneToMany(() => Part, (part) => part.episode, {
    cascade: true,
    eager: true,
  })
  public part: Part[];

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

    if (getSettings().main.mediaServerType == MediaServerType.PLEX) {
      if (this.ratingKey) {
        this.mediaUrl = `${
          webAppUrl ? webAppUrl : 'https://app.plex.tv/desktop'
        }#!/server/${machineId}/details?key=%2Flibrary%2Fmetadata%2F${
          this.ratingKey
        }`;

        this.iOSPlexUrl = `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${this.ratingKey}&server=${machineId}`;

        if (tautulliUrl) {
          this.tautulliUrl = `${tautulliUrl}/info?rating_key=${this.ratingKey}`;
        }
      }
    }
  }
}

export default Episode;
