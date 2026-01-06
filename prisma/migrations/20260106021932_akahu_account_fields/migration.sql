/*
  Warnings:

  - You are about to drop the column `akahuAccountId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `balance` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Account` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,akahuId]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountType` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `akahuId` to the `Account` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Account_akahuAccountId_key";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "akahuAccountId",
DROP COLUMN "balance",
DROP COLUMN "type",
ADD COLUMN     "accountType" TEXT NOT NULL,
ADD COLUMN     "akahuId" TEXT NOT NULL,
ADD COLUMN     "balanceAvailable" DECIMAL(12,2),
ADD COLUMN     "balanceCurrent" DECIMAL(12,2),
ADD COLUMN     "connectionLogo" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NZD',
ADD COLUMN     "formattedAccount" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_akahuId_key" ON "Account"("userId", "akahuId");
