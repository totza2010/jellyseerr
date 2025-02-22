import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EveryEpisodeStatus1740252329100 implements MigrationInterface {
  name = 'EveryEpisodeStatus1740252329100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" SERIAL NOT NULL, "episodeNumber" integer NOT NULL, "ratingKey" character varying, "status" integer NOT NULL DEFAULT '1', "status4k" integer NOT NULL DEFAULT '1', "part" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "seasonId" integer, CONSTRAINT "PK_7258b95d6d2bf7f621845a0e143" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "season" ADD "ratingKey" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "episode" ADD CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "episode" DROP CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd"`
    );
    await queryRunner.query(`ALTER TABLE "season" DROP COLUMN "ratingKey"`);
    await queryRunner.query(`DROP TABLE "episode"`);
  }
}
