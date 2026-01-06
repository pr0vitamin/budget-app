-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "balance" DECIMAL(12,2),
ADD COLUMN     "category" TEXT,
ADD COLUMN     "isAmended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transactionType" TEXT;
