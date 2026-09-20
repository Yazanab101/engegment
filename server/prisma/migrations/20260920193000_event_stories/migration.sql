-- Couple-only engagement stories. Guests can view; they cannot publish.

CREATE TABLE "EventStory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "thumbnailObjectKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "duration" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "EventStory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventStory_mediaType_chk" CHECK ("mediaType" IN ('photo', 'video')),
    CONSTRAINT "EventStory_status_chk" CHECK ("status" IN ('pending', 'ready', 'deleted'))
);

CREATE UNIQUE INDEX "EventStory_objectKey_key" ON "EventStory"("objectKey");
CREATE INDEX "EventStory_eventId_sortOrder_createdAt_idx" ON "EventStory"("eventId", "sortOrder", "createdAt");
CREATE INDEX "EventStory_eventId_isActive_status_idx" ON "EventStory"("eventId", "isActive", "status");

ALTER TABLE "EventStory" ADD CONSTRAINT "EventStory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoryView" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "guestId" TEXT,
    "deviceId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoryView_identity_chk" CHECK ("guestId" IS NOT NULL OR "deviceId" IS NOT NULL)
);

CREATE UNIQUE INDEX "StoryView_storyId_guestId_uidx" ON "StoryView"("storyId", "guestId") WHERE "guestId" IS NOT NULL;
CREATE UNIQUE INDEX "StoryView_storyId_deviceId_uidx" ON "StoryView"("storyId", "deviceId") WHERE "deviceId" IS NOT NULL;
CREATE INDEX "StoryView_storyId_idx" ON "StoryView"("storyId");

ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "EventStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "MemoryGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
