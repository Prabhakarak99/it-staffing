-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recruiter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "businessNumber" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "roleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "activationToken" TEXT,
    "activationExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recruiter_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Recruiter" ("businessNumber", "createdAt", "email", "endDate", "firstName", "id", "isActive", "lastName", "phoneNumber", "roleId", "startDate", "updatedAt") SELECT "businessNumber", "createdAt", "email", "endDate", "firstName", "id", "isActive", "lastName", "phoneNumber", "roleId", "startDate", "updatedAt" FROM "Recruiter";
DROP TABLE "Recruiter";
ALTER TABLE "new_Recruiter" RENAME TO "Recruiter";
CREATE UNIQUE INDEX "Recruiter_email_key" ON "Recruiter"("email");
CREATE UNIQUE INDEX "Recruiter_activationToken_key" ON "Recruiter"("activationToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
