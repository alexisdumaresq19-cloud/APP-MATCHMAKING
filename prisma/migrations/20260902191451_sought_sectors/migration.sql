-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "soughtSectorsSnapshot" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "soughtSectorIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
