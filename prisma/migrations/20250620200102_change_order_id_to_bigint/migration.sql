/*
  Warnings:

  - You are about to alter the column `shopifyOrderId` on the `PendingPayment` table. The data in that column could be lost. The data in that column will be cast from `String` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingPayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyOrderId" BIGINT NOT NULL,
    "monobankInvoiceId" TEXT NOT NULL,
    "monobankPageUrl" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PendingPayment" ("amount", "createdAt", "id", "monobankInvoiceId", "monobankPageUrl", "shop", "shopifyOrderId") SELECT "amount", "createdAt", "id", "monobankInvoiceId", "monobankPageUrl", "shop", "shopifyOrderId" FROM "PendingPayment";
DROP TABLE "PendingPayment";
ALTER TABLE "new_PendingPayment" RENAME TO "PendingPayment";
CREATE UNIQUE INDEX "PendingPayment_shopifyOrderId_key" ON "PendingPayment"("shopifyOrderId");
CREATE UNIQUE INDEX "PendingPayment_monobankInvoiceId_key" ON "PendingPayment"("monobankInvoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
