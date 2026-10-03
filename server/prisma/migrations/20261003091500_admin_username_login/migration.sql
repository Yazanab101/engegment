-- AlterTable: add username for admin login
ALTER TABLE "AdminUser" ADD COLUMN "username" TEXT;

-- Backfill username from the email local-part (unique per row via id suffix on collision)
UPDATE "AdminUser" AS a
SET "username" = CASE
  WHEN (
    SELECT COUNT(*)::int
    FROM "AdminUser" AS b
    WHERE split_part(lower(b."email"), '@', 1) = split_part(lower(a."email"), '@', 1)
  ) = 1
  THEN split_part(lower(a."email"), '@', 1)
  ELSE split_part(lower(a."email"), '@', 1) || '_' || right(a."id", 6)
END
WHERE a."username" IS NULL;

ALTER TABLE "AdminUser" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- Email is optional contact info; login uses username
ALTER TABLE "AdminUser" ALTER COLUMN "email" DROP NOT NULL;
