-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "directoryOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "directoryOptInAt" TIMESTAMP(3);
