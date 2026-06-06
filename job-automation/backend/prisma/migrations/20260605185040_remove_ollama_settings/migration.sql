/*
  Warnings:

  - You are about to drop the column `aiProvider` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `ollamaBaseUrl` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `ollamaModel` on the `settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "settings" DROP COLUMN "aiProvider",
DROP COLUMN "ollamaBaseUrl",
DROP COLUMN "ollamaModel";
