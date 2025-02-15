import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Episode from './Episode';

@Entity()
class Part {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ nullable: true, type: 'text' })
  public file: string;

  @Column()
  public size: number;

  @ManyToOne(() => Episode, (episode) => episode.part, {
    onDelete: 'CASCADE',
  })
  public episode: Promise<Episode>;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<Part>) {
    Object.assign(this, init);
  }
}

export default Part;
