-- CreateEnum
CREATE TYPE "OrganizerRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'MATCHED', 'PUBLISHED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('PLATFORM', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PROPOSED', 'PINNED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'MATCH_RUN', 'PUBLISH', 'CONSENT', 'DATA_REQUEST', 'LOGIN_FAILED', 'CHECK_IN', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "OrganizerTokenPurpose" AS ENUM ('MAGIC_LINK', 'PASSWORD_RESET', 'INVITE');

-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'Jumelage',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1F3864',
    "accentColor" TEXT NOT NULL DEFAULT '#F2C94C',
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL DEFAULT '',
    "privacyEmail" TEXT NOT NULL,
    "replyToEmail" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organizer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "OrganizerRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "OrganizerTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectorAffinity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromSectorId" TEXT NOT NULL,
    "toSectorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "SectorAffinity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "sectorId" TEXT,
    "website" TEXT,
    "city" TEXT,
    "region" TEXT,
    "offers" TEXT[],
    "needs" TEXT[],
    "description" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "consentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venueName" TEXT,
    "venueAddress" TEXT,
    "capacity" INTEGER,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "tableCount" INTEGER NOT NULL DEFAULT 10,
    "seatsPerTable" INTEGER NOT NULL DEFAULT 6,
    "roundCount" INTEGER NOT NULL DEFAULT 1,
    "roundMinutes" INTEGER DEFAULT 20,
    "matchesPerParticipant" INTEGER NOT NULL DEFAULT 5,
    "matchingRuleSetId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "source" "RegistrationSource" NOT NULL DEFAULT 'PLATFORM',
    "offersSnapshot" TEXT[],
    "needsSnapshot" TEXT[],
    "goalsText" TEXT,
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "publishedMatchesHash" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTable" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT,
    "seats" INTEGER NOT NULL,

    CONSTRAINT "EventTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableAssignment" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TableAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchingRuleSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Règles par défaut',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "weightComplementarity" INTEGER NOT NULL DEFAULT 40,
    "weightSectorAffinity" INTEGER NOT NULL DEFAULT 30,
    "weightRegion" INTEGER NOT NULL DEFAULT 15,
    "weightNovelty" INTEGER NOT NULL DEFAULT 15,
    "penaltySameSector" INTEGER NOT NULL DEFAULT 60,
    "excludeSameCompany" BOOLEAN NOT NULL DEFAULT true,
    "minScoreToPropose" INTEGER NOT NULL DEFAULT 35,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "eventId" TEXT,
    "consentVersion" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "toEmail" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "providerId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "totalRegistered" INTEGER NOT NULL,
    "totalCheckedIn" INTEGER NOT NULL,
    "totalPlatformSource" INTEGER NOT NULL,
    "totalManualSource" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "note" TEXT,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organizer_email_idx" ON "Organizer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organizer_organizationId_email_key" ON "Organizer"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerToken_tokenHash_key" ON "OrganizerToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizerToken_organizerId_purpose_idx" ON "OrganizerToken"("organizerId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_organizationId_slug_key" ON "Sector"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "SectorAffinity_organizationId_fromSectorId_toSectorId_key" ON "SectorAffinity"("organizationId", "fromSectorId", "toSectorId");

-- CreateIndex
CREATE INDEX "Participant_organizationId_sectorId_idx" ON "Participant"("organizationId", "sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_organizationId_email_key" ON "Participant"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Event_organizationId_status_idx" ON "Event"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Event_organizationId_slug_key" ON "Event"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_status_idx" ON "EventRegistration"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_participantId_key" ON "EventRegistration"("eventId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTable_eventId_number_key" ON "EventTable"("eventId", "number");

-- CreateIndex
CREATE INDEX "TableAssignment_tableId_round_idx" ON "TableAssignment"("tableId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "TableAssignment_registrationId_round_key" ON "TableAssignment"("registrationId", "round");

-- CreateIndex
CREATE INDEX "Match_eventId_status_idx" ON "Match"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_eventId_aId_bId_key" ON "Match"("eventId", "aId", "bId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchingRuleSet_organizationId_name_key" ON "MatchingRuleSet"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ConsentLog_participantId_idx" ON "ConsentLog"("participantId");

-- CreateIndex
CREATE INDEX "EmailLog_eventId_template_idx" ON "EmailLog"("eventId", "template");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSnapshot_eventId_key" ON "BillingSnapshot"("eventId");

-- CreateIndex
CREATE INDEX "DeletionRequest_organizationId_status_idx" ON "DeletionRequest"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "Organizer" ADD CONSTRAINT "Organizer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerToken" ADD CONSTRAINT "OrganizerToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerToken" ADD CONSTRAINT "OrganizerToken_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sector" ADD CONSTRAINT "Sector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorAffinity" ADD CONSTRAINT "SectorAffinity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorAffinity" ADD CONSTRAINT "SectorAffinity_fromSectorId_fkey" FOREIGN KEY ("fromSectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorAffinity" ADD CONSTRAINT "SectorAffinity_toSectorId_fkey" FOREIGN KEY ("toSectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_matchingRuleSetId_fkey" FOREIGN KEY ("matchingRuleSetId") REFERENCES "MatchingRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTable" ADD CONSTRAINT "EventTable_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAssignment" ADD CONSTRAINT "TableAssignment_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "EventTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAssignment" ADD CONSTRAINT "TableAssignment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_aId_fkey" FOREIGN KEY ("aId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bId_fkey" FOREIGN KEY ("bId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingRuleSet" ADD CONSTRAINT "MatchingRuleSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
