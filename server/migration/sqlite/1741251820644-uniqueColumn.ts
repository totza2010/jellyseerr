import type { MigrationInterface, QueryRunner } from 'typeorm';

export class uniqueColumn1741251820644 implements MigrationInterface {
  name = 'uniqueColumn1741251820644';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "ratingKey" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "part" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "seasonId" integer, "ratingKey4k" varchar, "tmdbId" integer NOT NULL, "seasonNumber" integer NOT NULL, CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_episode"("id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k") SELECT "id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k" FROM "episode"`
    );
    await queryRunner.query(`DROP TABLE "episode"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_episode" RENAME TO "episode"`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_season" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "mediaId" integer, "status4k" integer NOT NULL DEFAULT (1), "ratingKey" varchar, "ratingKey4k" varchar, "tmdbId" integer NOT NULL, CONSTRAINT "FK_087099b39600be695591da9a49c" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_season"("id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k") SELECT "id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k" FROM "season"`
    );
    await queryRunner.query(`DROP TABLE "season"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_season" RENAME TO "season"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e8827ad38eff0082facd880f92" ON "episode" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb2ed623c14544e1d6430629d2" ON "season" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_e8827ad38eff0082facd880f92"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "ratingKey" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "part" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "seasonId" integer, "ratingKey4k" varchar, "tmdbId" integer NOT NULL, "seasonNumber" integer NOT NULL, CONSTRAINT "UQ_ed5203dfcf7a4d4682420ba20f2" UNIQUE ("episodeNumber", "seasonNumber", "tmdbId"), CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_episode"("id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k", "tmdbId", "seasonNumber") SELECT "id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k", "tmdbId", "seasonNumber" FROM "episode"`
    );
    await queryRunner.query(`DROP TABLE "episode"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_episode" RENAME TO "episode"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e8827ad38eff0082facd880f92" ON "episode" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_cb2ed623c14544e1d6430629d2"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_season" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "mediaId" integer, "status4k" integer NOT NULL DEFAULT (1), "ratingKey" varchar, "ratingKey4k" varchar, "tmdbId" integer NOT NULL, CONSTRAINT "UQ_95318857dc41106b79c8707d44f" UNIQUE ("seasonNumber", "tmdbId"), CONSTRAINT "FK_087099b39600be695591da9a49c" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_season"("id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k", "tmdbId") SELECT "id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k", "tmdbId" FROM "season"`
    );
    await queryRunner.query(`DROP TABLE "season"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_season" RENAME TO "season"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb2ed623c14544e1d6430629d2" ON "season" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceId4k" integer, "externalServiceId" integer, "externalServiceId4k" integer, "externalServiceSlug" varchar, "externalServiceSlug4k" varchar, "ratingKey" varchar, "ratingKey4k" varchar, "jellyfinMediaId" varchar, "jellyfinMediaId4k" varchar, "parts" text, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"), CONSTRAINT "UQ_f8233358694d1677a67899b90a8" UNIQUE ("tmdbId", "mediaType"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "parts") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "parts" FROM "media"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME TO "temporary_media"`);
    await queryRunner.query(
      `CREATE TABLE "media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceId4k" integer, "externalServiceId" integer, "externalServiceId4k" integer, "externalServiceSlug" varchar, "externalServiceSlug4k" varchar, "ratingKey" varchar, "ratingKey4k" varchar, "jellyfinMediaId" varchar, "jellyfinMediaId4k" varchar, "parts" text, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "parts") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "parts" FROM "temporary_media"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_cb2ed623c14544e1d6430629d2"`);
    await queryRunner.query(
      `ALTER TABLE "season" RENAME TO "temporary_season"`
    );
    await queryRunner.query(
      `CREATE TABLE "season" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "mediaId" integer, "status4k" integer NOT NULL DEFAULT (1), "ratingKey" varchar, "ratingKey4k" varchar, "tmdbId" integer NOT NULL, CONSTRAINT "FK_087099b39600be695591da9a49c" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "season"("id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k", "tmdbId") SELECT "id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k", "tmdbId" FROM "temporary_season"`
    );
    await queryRunner.query(`DROP TABLE "temporary_season"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_cb2ed623c14544e1d6430629d2" ON "season" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_e8827ad38eff0082facd880f92"`);
    await queryRunner.query(
      `ALTER TABLE "episode" RENAME TO "temporary_episode"`
    );
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "ratingKey" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "part" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "seasonId" integer, "ratingKey4k" varchar, "tmdbId" integer NOT NULL, "seasonNumber" integer NOT NULL, CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "episode"("id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k", "tmdbId", "seasonNumber") SELECT "id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k", "tmdbId", "seasonNumber" FROM "temporary_episode"`
    );
    await queryRunner.query(`DROP TABLE "temporary_episode"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_e8827ad38eff0082facd880f92" ON "episode" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_cb2ed623c14544e1d6430629d2"`);
    await queryRunner.query(`DROP INDEX "IDX_e8827ad38eff0082facd880f92"`);
    await queryRunner.query(
      `ALTER TABLE "season" RENAME TO "temporary_season"`
    );
    await queryRunner.query(
      `CREATE TABLE "season" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "mediaId" integer, "status4k" integer NOT NULL DEFAULT (1), "ratingKey" varchar, "ratingKey4k" varchar, CONSTRAINT "FK_087099b39600be695591da9a49c" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "season"("id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k") SELECT "id", "seasonNumber", "status", "createdAt", "updatedAt", "mediaId", "status4k", "ratingKey", "ratingKey4k" FROM "temporary_season"`
    );
    await queryRunner.query(`DROP TABLE "temporary_season"`);
    await queryRunner.query(
      `ALTER TABLE "episode" RENAME TO "temporary_episode"`
    );
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "ratingKey" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "part" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "seasonId" integer, "ratingKey4k" varchar, CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "episode"("id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k") SELECT "id", "episodeNumber", "ratingKey", "status", "status4k", "part", "createdAt", "updatedAt", "seasonId", "ratingKey4k" FROM "temporary_episode"`
    );
    await queryRunner.query(`DROP TABLE "temporary_episode"`);
  }
}
