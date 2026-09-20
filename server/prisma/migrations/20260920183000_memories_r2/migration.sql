-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "uploadsOpen" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MemoryGuest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "tableLabel" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryUploadSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "tableLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "uploadSessionId" TEXT NOT NULL,
    "clientUploadId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'r2',
    "objectKey" TEXT NOT NULL,
    "thumbnailObjectKey" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "MemoryMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemoryGuest_deviceToken_key" ON "MemoryGuest"("deviceToken");
CREATE INDEX "MemoryGuest_eventId_displayName_idx" ON "MemoryGuest"("eventId", "displayName");
CREATE INDEX "MemoryGuest_eventId_lastSeenAt_idx" ON "MemoryGuest"("eventId", "lastSeenAt");
CREATE INDEX "MemoryUploadSession_eventId_guestId_idx" ON "MemoryUploadSession"("eventId", "guestId");
CREATE UNIQUE INDEX "MemoryMedia_clientUploadId_key" ON "MemoryMedia"("clientUploadId");
CREATE UNIQUE INDEX "MemoryMedia_objectKey_key" ON "MemoryMedia"("objectKey");
CREATE INDEX "MemoryMedia_eventId_createdAt_idx" ON "MemoryMedia"("eventId", "createdAt");
CREATE INDEX "MemoryMedia_eventId_guestId_createdAt_idx" ON "MemoryMedia"("eventId", "guestId", "createdAt");
CREATE INDEX "MemoryMedia_eventId_mediaType_createdAt_idx" ON "MemoryMedia"("eventId", "mediaType", "createdAt");
CREATE INDEX "MemoryMedia_eventId_isFavorite_createdAt_idx" ON "MemoryMedia"("eventId", "isFavorite", "createdAt");
CREATE INDEX "MemoryMedia_uploadSessionId_idx" ON "MemoryMedia"("uploadSessionId");
CREATE INDEX "MemoryMessage_eventId_createdAt_idx" ON "MemoryMessage"("eventId", "createdAt");
CREATE INDEX "MemoryMessage_eventId_guestId_createdAt_idx" ON "MemoryMessage"("eventId", "guestId", "createdAt");

ALTER TABLE "MemoryGuest" ADD CONSTRAINT "MemoryGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryUploadSession" ADD CONSTRAINT "MemoryUploadSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryUploadSession" ADD CONSTRAINT "MemoryUploadSession_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "MemoryGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryMedia" ADD CONSTRAINT "MemoryMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryMedia" ADD CONSTRAINT "MemoryMedia_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "MemoryGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryMedia" ADD CONSTRAINT "MemoryMedia_uploadSessionId_fkey" FOREIGN KEY ("uploadSessionId") REFERENCES "MemoryUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryMessage" ADD CONSTRAINT "MemoryMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryMessage" ADD CONSTRAINT "MemoryMessage_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "MemoryGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
