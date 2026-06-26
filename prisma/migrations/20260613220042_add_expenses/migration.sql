-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "submittedById" TEXT NOT NULL,
    "consultantId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" REAL NOT NULL,
    "location" TEXT NOT NULL,
    "receiptFile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseId_key" ON "Expense"("expenseId");
