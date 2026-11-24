-- The same email may now have an account in each company (each account keeps its own history).
-- Inside one company an email is still unique.
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
