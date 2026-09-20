-- AlterTable
ALTER TABLE "Guest" ALTER COLUMN "maxGuestsAllowed" SET DEFAULT 50;
UPDATE "Guest" SET "maxGuestsAllowed" = 50 WHERE "maxGuestsAllowed" < 50;
