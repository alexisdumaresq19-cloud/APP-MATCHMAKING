-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "previewText" TEXT,
ADD COLUMN     "subject" TEXT;

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_createdAt_idx" ON "EmailLog"("organizationId", "createdAt");
