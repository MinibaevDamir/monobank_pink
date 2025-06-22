-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MonobankSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "gatewayName" TEXT,
    "iv" TEXT NOT NULL,
    "activationStatus" TEXT NOT NULL DEFAULT 'inactive',
    "activatedKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MonobankSetting" ("apiToken", "createdAt", "gatewayName", "id", "iv", "shop", "updatedAt") SELECT "apiToken", "createdAt", "gatewayName", "id", "iv", "shop", "updatedAt" FROM "MonobankSetting";
DROP TABLE "MonobankSetting";
ALTER TABLE "new_MonobankSetting" RENAME TO "MonobankSetting";
CREATE UNIQUE INDEX "MonobankSetting_shop_key" ON "MonobankSetting"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
