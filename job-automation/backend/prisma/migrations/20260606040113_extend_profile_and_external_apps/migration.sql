-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "externalCompany" TEXT,
ADD COLUMN     "externalTitle" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'internal',
ALTER COLUMN "jobId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "education" JSONB,
ADD COLUMN     "experience" JSONB,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip" TEXT;

-- CreateIndex
CREATE INDEX "applications_externalUrl_idx" ON "applications"("externalUrl");
