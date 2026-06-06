-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "aiProvider" TEXT NOT NULL DEFAULT 'gemini',
ADD COLUMN     "ollamaBaseUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
ADD COLUMN     "ollamaModel" TEXT NOT NULL DEFAULT 'llama3.2';
