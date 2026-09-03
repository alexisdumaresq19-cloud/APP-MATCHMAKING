-- CreateEnum
CREATE TYPE "FeedbackOutcome" AS ENUM ('DEAL', 'FOLLOW_UP', 'NO_FIT', 'NOT_MET');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "surveySentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "purgeNoticeSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MatchFeedback" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "outcome" "FeedbackOutcome" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchFeedback_participantId_idx" ON "MatchFeedback"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchFeedback_matchId_participantId_key" ON "MatchFeedback"("matchId", "participantId");

-- AddForeignKey
ALTER TABLE "MatchFeedback" ADD CONSTRAINT "MatchFeedback_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchFeedback" ADD CONSTRAINT "MatchFeedback_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
