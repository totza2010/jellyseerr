import type { MigrationInterface, QueryRunner } from 'typeorm';

export class minorUpdate1740896938300 implements MigrationInterface {
  name = 'minorUpdate1740896938300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "episode" ADD "ratingKey4k" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "season" ADD "ratingKey4k" character varying`
    );
    await queryRunner.query(`ALTER TABLE "media" ADD "parts" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "parts"`);
    await queryRunner.query(`ALTER TABLE "season" DROP COLUMN "ratingKey4k"`);
    await queryRunner.query(`ALTER TABLE "episode" DROP COLUMN "ratingKey4k"`);
  }
}
