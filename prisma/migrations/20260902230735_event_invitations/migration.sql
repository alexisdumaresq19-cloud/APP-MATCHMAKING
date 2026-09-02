-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "invitationsStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "invitationsOptOut" BOOLEAN NOT NULL DEFAULT false;
