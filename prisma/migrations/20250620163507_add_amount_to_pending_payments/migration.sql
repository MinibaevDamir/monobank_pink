/*
  Warnings:

  - Added the required column `amount` to the `PendingPayment` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingPayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyOrderId" TEXT NOT NULL,
    "monobankInvoiceId" TEXT NOT NULL,
    "monobankPageUrl" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PendingPayment" ("createdAt", "id", "monobankInvoiceId", "monobankPageUrl", "shop", "shopifyOrderId") SELECT "createdAt", "id", "monobankInvoiceId", "monobankPageUrl", "shop", "shopifyOrderId" FROM "PendingPayment";
DROP TABLE "PendingPayment";
ALTER TABLE "new_PendingPayment" RENAME TO "PendingPayment";
CREATE UNIQUE INDEX "PendingPayment_shopifyOrderId_key" ON "PendingPayment"("shopifyOrderId");
CREATE UNIQUE INDEX "PendingPayment_monobankInvoiceId_key" ON "PendingPayment"("monobankInvoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
