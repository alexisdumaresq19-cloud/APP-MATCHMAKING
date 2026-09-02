-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMimeType" TEXT;

-- CreateTable
CREATE TABLE "ConsentTextVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentTextVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentTextVersion_organizationId_createdAt_idx" ON "ConsentTextVersion"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTextVersion_organizationId_version_key" ON "ConsentTextVersion"("organizationId", "version");

-- AddForeignKey
ALTER TABLE "ConsentTextVersion" ADD CONSTRAINT "ConsentTextVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
