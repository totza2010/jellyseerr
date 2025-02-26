import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IgnoreSystem1740585783976 implements MigrationInterface {
  name = 'IgnoreSystem1740585783976';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ignore" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "title" varchar, "seasonNumber" integer NOT NULL, "seasonTitle" varchar, "episodeNumber" integer NOT NULL, "episodeTitle" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" integer, "episodeId" integer, CONSTRAINT "REL_f57d440332ecef962f8b179145" UNIQUE ("episodeId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_33e5d5ba731e3b7e0f23092fbc" ON "ignore" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f342d8a50a61e4a0cd3a1c0b1e" ON "ignore" ("seasonNumber") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_30c72d994f15321115ec69ca2a" ON "ignore" ("episodeNumber") `
    );
    await queryRunner.query(`DROP INDEX "IDX_33e5d5ba731e3b7e0f23092fbc"`);
    await queryRunner.query(`DROP INDEX "IDX_f342d8a50a61e4a0cd3a1c0b1e"`);
    await queryRunner.query(`DROP INDEX "IDX_30c72d994f15321115ec69ca2a"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_ignore" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "title" varchar, "seasonNumber" integer NOT NULL, "seasonTitle" varchar, "episodeNumber" integer NOT NULL, "episodeTitle" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" integer, "episodeId" integer, CONSTRAINT "REL_f57d440332ecef962f8b179145" UNIQUE ("episodeId"), CONSTRAINT "FK_e4875844feae4dee7abd1fb882f" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_f57d440332ecef962f8b1791452" FOREIGN KEY ("episodeId") REFERENCES "episode" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_ignore"("id", "tmdbId", "title", "seasonNumber", "seasonTitle", "episodeNumber", "episodeTitle", "createdAt", "userId", "episodeId") SELECT "id", "tmdbId", "title", "seasonNumber", "seasonTitle", "episodeNumber", "episodeTitle", "createdAt", "userId", "episodeId" FROM "ignore"`
    );
    await queryRunner.query(`DROP TABLE "ignore"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_ignore" RENAME TO "ignore"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_33e5d5ba731e3b7e0f23092fbc" ON "ignore" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f342d8a50a61e4a0cd3a1c0b1e" ON "ignore" ("seasonNumber") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_30c72d994f15321115ec69ca2a" ON "ignore" ("episodeNumber") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_30c72d994f15321115ec69ca2a"`);
    await queryRunner.query(`DROP INDEX "IDX_f342d8a50a61e4a0cd3a1c0b1e"`);
    await queryRunner.query(`DROP INDEX "IDX_33e5d5ba731e3b7e0f23092fbc"`);
    await queryRunner.query(
      `ALTER TABLE "ignore" RENAME TO "temporary_ignore"`
    );
    await queryRunner.query(
      `CREATE TABLE "ignore" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "title" varchar, "seasonNumber" integer NOT NULL, "seasonTitle" varchar, "episodeNumber" integer NOT NULL, "episodeTitle" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" integer, "episodeId" integer, CONSTRAINT "REL_f57d440332ecef962f8b179145" UNIQUE ("episodeId"))`
    );
    await queryRunner.query(
      `INSERT INTO "ignore"("id", "tmdbId", "title", "seasonNumber", "seasonTitle", "episodeNumber", "episodeTitle", "createdAt", "userId", "episodeId") SELECT "id", "tmdbId", "title", "seasonNumber", "seasonTitle", "episodeNumber", "episodeTitle", "createdAt", "userId", "episodeId" FROM "temporary_ignore"`
    );
    await queryRunner.query(`DROP TABLE "temporary_ignore"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_30c72d994f15321115ec69ca2a" ON "ignore" ("episodeNumber") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f342d8a50a61e4a0cd3a1c0b1e" ON "ignore" ("seasonNumber") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_33e5d5ba731e3b7e0f23092fbc" ON "ignore" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_30c72d994f15321115ec69ca2a"`);
    await queryRunner.query(`DROP INDEX "IDX_f342d8a50a61e4a0cd3a1c0b1e"`);
    await queryRunner.query(`DROP INDEX "IDX_33e5d5ba731e3b7e0f23092fbc"`);
    await queryRunner.query(`DROP TABLE "ignore"`);
  }
}
