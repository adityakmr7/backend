-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "geminiApiKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
