-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "titleKey" TEXT;
ALTER TABLE "Guest" ADD COLUMN "includeFamily" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN "familySuffixKey" TEXT;
