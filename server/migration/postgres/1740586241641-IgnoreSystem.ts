import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IgnoreSystem1740586241641 implements MigrationInterface {
  name = 'IgnoreSystem1740586241641';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ignore" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "title" character varying, "seasonNumber" integer NOT NULL, "seasonTitle" character varying, "episodeNumber" integer NOT NULL, "episodeTitle" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "episodeId" integer, CONSTRAINT "REL_f57d440332ecef962f8b179145" UNIQUE ("episodeId"), CONSTRAINT "PK_22adb610e288882137718c5b754" PRIMARY KEY ("id"))`
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
    await queryRunner.query(
      `ALTER TABLE "ignore" ADD CONSTRAINT "FK_e4875844feae4dee7abd1fb882f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ignore" ADD CONSTRAINT "FK_f57d440332ecef962f8b1791452" FOREIGN KEY ("episodeId") REFERENCES "episode"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ignore" DROP CONSTRAINT "FK_f57d440332ecef962f8b1791452"`
    );
    await queryRunner.query(
      `ALTER TABLE "ignore" DROP CONSTRAINT "FK_e4875844feae4dee7abd1fb882f"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_30c72d994f15321115ec69ca2a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f342d8a50a61e4a0cd3a1c0b1e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_33e5d5ba731e3b7e0f23092fbc"`
    );
    await queryRunner.query(`DROP TABLE "ignore"`);
  }
}
