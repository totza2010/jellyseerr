import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AvailaleEpisodes1739775341062 implements MigrationInterface {
  name = 'AvailaleEpisodes1739775341062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "part" ("id" SERIAL NOT NULL, "file" text, "size" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "episodeId" integer, CONSTRAINT "PK_58888debdf048d2dfe459aa59da" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" SERIAL NOT NULL, "episodeNumber" integer NOT NULL, "ratingKey" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "seasonId" integer, CONSTRAINT "PK_7258b95d6d2bf7f621845a0e143" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "season" ADD "ratingKey" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "part" ADD CONSTRAINT "FK_c6c6ec487bb6f480b4315709e46" FOREIGN KEY ("episodeId") REFERENCES "episode"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "episode" ADD CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "episode" DROP CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd"`
    );
    await queryRunner.query(
      `ALTER TABLE "part" DROP CONSTRAINT "FK_c6c6ec487bb6f480b4315709e46"`
    );
    await queryRunner.query(`ALTER TABLE "season" DROP COLUMN "ratingKey"`);
    await queryRunner.query(`DROP TABLE "episode"`);
    await queryRunner.query(`DROP TABLE "part"`);
  }
}
