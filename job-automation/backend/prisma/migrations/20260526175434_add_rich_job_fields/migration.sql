-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "equity" TEXT,
ADD COLUMN     "jobType" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "salary" TEXT,
ADD COLUMN     "visa" TEXT,
ADD COLUMN     "yearsExp" TEXT;
