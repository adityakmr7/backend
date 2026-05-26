-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companySlug" TEXT,
    "description" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "applyMethod" TEXT NOT NULL DEFAULT 'form',
    "applyEmail" TEXT,
    "location" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "ycBatch" TEXT,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "relevanceScore" DOUBLE PRECISION,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resumeId" TEXT,
    "coverLetter" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewDate" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "textContent" TEXT NOT NULL,
    "tags" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "targetRoles" TEXT[],
    "targetLocations" TEXT[],
    "preferredSalaryMin" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_company_idx" ON "jobs"("company");

-- CreateIndex
CREATE INDEX "jobs_source_idx" ON "jobs"("source");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_source_externalId_key" ON "jobs"("source", "externalId");

-- CreateIndex
CREATE INDEX "applications_stage_idx" ON "applications"("stage");

-- CreateIndex
CREATE INDEX "applications_jobId_idx" ON "applications"("jobId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
