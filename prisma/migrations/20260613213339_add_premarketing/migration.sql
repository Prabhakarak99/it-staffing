/*
  Warnings:

  - You are about to drop the `Recruiter` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "businessNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "endDate" DATETIME;
ALTER TABLE "User" ADD COLUMN "startDate" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Recruiter";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "personalPhone" TEXT,
    "email" TEXT NOT NULL,
    "dob" DATETIME,
    "parentPhone" TEXT,
    "emergencyContact" TEXT,
    "referredBy" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "universityName" TEXT,
    "universityLocation" TEXT,
    "masters" TEXT,
    "mastersCompletedDate" TEXT,
    "dsoName" TEXT,
    "dsoEmail" TEXT,
    "dsoPhone" TEXT,
    "visaStatus" TEXT,
    "visaStartDate" DATETIME,
    "visaExpiryDate" DATETIME,
    "onboardingStartDate" DATETIME,
    "offerLetterType" TEXT,
    "payRate" TEXT,
    "hasDL" TEXT,
    "hasSSN" TEXT,
    "passportNumber" TEXT,
    "dlDocument" TEXT,
    "passportDocument" TEXT,
    "visaCopyDocument" TEXT,
    "projectStatus" TEXT,
    "jobTitle" TEXT,
    "verbalConfirmationDate" DATETIME,
    "linkedInterviewId" TEXT,
    "projectStartDate" DATETIME,
    "billRate" TEXT,
    "payroll" TEXT,
    "workMode" TEXT,
    "pmName" TEXT,
    "pmEmail" TEXT,
    "pmPhone" TEXT,
    "phoneNumber" TEXT,
    "technology" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "submissionDate" DATETIME NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "jobDescription" TEXT,
    "payRate" TEXT,
    "vendorCompany" TEXT NOT NULL,
    "vendorRecruiterName" TEXT NOT NULL,
    "vendorRecruiterEmail" TEXT NOT NULL,
    "vendorRecruiterPhone" TEXT NOT NULL,
    "implementationName" TEXT,
    "implementationEmail" TEXT,
    "implementationPhone" TEXT,
    "clientName" TEXT,
    "clientLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Submission Submitted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submission_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TechSupport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "availability" TEXT,
    "calendarLink" TEXT,
    "amount" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "interviewStartDate" DATETIME NOT NULL,
    "interviewEndDate" DATETIME NOT NULL,
    "interviewLevel" TEXT NOT NULL,
    "interviewStatus" TEXT NOT NULL,
    "techSupportId" TEXT,
    "amount" TEXT,
    "techSupportFeedback" TEXT,
    "otterLink" TEXT,
    "interviewQuestions" TEXT,
    "interviewFeedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interview_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Interview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Interview_techSupportId_fkey" FOREIGN KEY ("techSupportId") REFERENCES "TechSupport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreMarketing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultantId" TEXT NOT NULL,
    "dlAvailable" TEXT,
    "visaAvailable" TEXT,
    "ssnAvailable" TEXT,
    "marketingSheetReady" TEXT,
    "marketingSheetExplained" TEXT,
    "marketingSheetReverseKT" TEXT,
    "allTrainingSessionsCompleted" TEXT,
    "allTrainingAssignmentsCompleted" TEXT,
    "marketingEmail" TEXT,
    "marketingVisaStatus" TEXT,
    "marketingStartDate" DATETIME,
    "marketingEndDate" DATETIME,
    "recruiterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreMarketing_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PreMarketing_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_submissionId_key" ON "Submission"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "TechSupport_email_key" ON "TechSupport"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_interviewId_key" ON "Interview"("interviewId");
