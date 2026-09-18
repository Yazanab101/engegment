-- CreateEnum
CREATE TYPE "Language" AS ENUM ('AR', 'HE', 'EN');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'NOT_ATTENDING');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('CREATED', 'OPENED', 'RESPONDED');

-- CreateEnum
CREATE TYPE "InvitationEventType" AS ENUM ('INVITATION_OPENED', 'RSVP_ATTENDING', 'RSVP_NOT_ATTENDING', 'RSVP_UPDATED', 'LOCATION_CLICKED', 'CALENDAR_CLICKED');

-- CreateEnum
CREATE TYPE "GuestTag" AS ENUM ('FAMILY', 'FRIENDS', 'WORK', 'BRIDE_FAMILY', 'GROOM_FAMILY', 'VIP');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'current',
    "title" TEXT NOT NULL,
    "brideName" TEXT NOT NULL,
    "groomName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventStartTime" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "googleMapsUrl" TEXT,
    "wazeUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "rsvpDeadline" TIMESTAMP(3),
    "contactPhone" TEXT,
    "whatsappPhone" TEXT,
    "dressCode" TEXT,
    "parkingInfo" TEXT,
    "additionalInfo" TEXT,
    "showTableAssignments" BOOLEAN NOT NULL DEFAULT false,
    "introEn" TEXT,
    "introAr" TEXT,
    "introHe" TEXT,
    "footerEn" TEXT,
    "footerAr" TEXT,
    "footerHe" TEXT,
    "taglineEn" TEXT,
    "taglineAr" TEXT,
    "taglineHe" TEXT,
    "joinUsMessageEn" TEXT,
    "joinUsMessageAr" TEXT,
    "joinUsMessageHe" TEXT,
    "celebrationNoteEn" TEXT,
    "celebrationNoteAr" TEXT,
    "celebrationNoteHe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "inviteToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxGuestsAllowed" INTEGER NOT NULL DEFAULT 1,
    "invitationStatus" "InvitationStatus" NOT NULL DEFAULT 'CREATED',
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "tags" "GuestTag"[] DEFAULT ARRAY[]::"GuestTag"[],
    "tableNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rsvp" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationEvent" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "type" "InvitationEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_inviteToken_key" ON "Guest"("inviteToken");

-- CreateIndex
CREATE INDEX "Guest_eventId_idx" ON "Guest"("eventId");

-- CreateIndex
CREATE INDEX "Guest_language_idx" ON "Guest"("language");

-- CreateIndex
CREATE INDEX "Guest_invitationStatus_idx" ON "Guest"("invitationStatus");

-- CreateIndex
CREATE INDEX "Guest_fullName_idx" ON "Guest"("fullName");

-- CreateIndex
CREATE INDEX "Guest_phoneNumber_idx" ON "Guest"("phoneNumber");

-- CreateIndex
CREATE INDEX "Guest_email_idx" ON "Guest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_guestId_key" ON "Rsvp"("guestId");

-- CreateIndex
CREATE INDEX "InvitationEvent_guestId_type_createdAt_idx" ON "InvitationEvent"("guestId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InvitationEvent_createdAt_idx" ON "InvitationEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationEvent" ADD CONSTRAINT "InvitationEvent_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
