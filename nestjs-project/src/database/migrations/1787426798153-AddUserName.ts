import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `users.name` — the person's full name, submitted at registration and
 * used to seed the display name of their Channel.
 *
 * The CLI generates this as a single `ADD ... NOT NULL`, which fails outright
 * on any database that already holds accounts. The three steps below are the
 * safe form: add the column nullable, backfill each existing account from the
 * display name of its channel (which until now was derived from the e-mail
 * prefix — the closest thing to a name those rows have), then tighten the
 * constraint. Written by hand because a backfill is a data migration, and the
 * CLI cannot express one.
 *
 * @author Saulo Santos
 * @date 22/08/2026
 */
export class AddUserName1787426798153 implements MigrationInterface {
  name = 'AddUserName1787426798153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" character varying(255)`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "name" = COALESCE((SELECT "channels"."name" FROM "channels" WHERE "channels"."user_id" = "users"."id"), split_part("users"."email", '@', 1)) WHERE "name" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "name"`,
    );
  }
}
