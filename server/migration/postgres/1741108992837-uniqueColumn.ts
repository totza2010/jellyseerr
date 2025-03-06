import type { MigrationInterface, QueryRunner } from 'typeorm';

export class uniqueColumn1741108992837 implements MigrationInterface {
  name = 'uniqueColumn1741108992837';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "episode" ADD "tmdbId" integer NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "episode" ADD "seasonNumber" integer NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "season" ADD "tmdbId" integer NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e8827ad38eff0082facd880f92" ON "episode" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb2ed623c14544e1d6430629d2" ON "season" ("tmdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "episode" ADD CONSTRAINT "UQ_ed5203dfcf7a4d4682420ba20f2" UNIQUE ("episodeNumber", "seasonNumber", "tmdbId")`
    );
    await queryRunner.query(
      `ALTER TABLE "season" ADD CONSTRAINT "UQ_95318857dc41106b79c8707d44f" UNIQUE ("seasonNumber", "tmdbId")`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "UQ_f8233358694d1677a67899b90a8" UNIQUE ("tmdbId", "mediaType")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "UQ_f8233358694d1677a67899b90a8"`
    );
    await queryRunner.query(
      `ALTER TABLE "season" DROP CONSTRAINT "UQ_95318857dc41106b79c8707d44f"`
    );
    await queryRunner.query(
      `ALTER TABLE "episode" DROP CONSTRAINT "UQ_ed5203dfcf7a4d4682420ba20f2"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cb2ed623c14544e1d6430629d2"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e8827ad38eff0082facd880f92"`
    );
    await queryRunner.query(`ALTER TABLE "season" DROP COLUMN "tmdbId"`);
    await queryRunner.query(`ALTER TABLE "episode" DROP COLUMN "seasonNumber"`);
    await queryRunner.query(`ALTER TABLE "episode" DROP COLUMN "tmdbId"`);
  }
}
