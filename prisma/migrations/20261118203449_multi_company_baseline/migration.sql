-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'company',
    "status" TEXT NOT NULL DEFAULT 'active',
    "logoFile" TEXT,
    "brandColor" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "attendanceTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "disabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxUsers" INTEGER,
    "settings" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleScreen" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoleScreen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "phoneNumber" TEXT,
    "password" TEXT NOT NULL,
    "roleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "easySubmissionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailSignature" TEXT,
    "activationToken" TEXT,
    "activationExpiry" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetExpiry" TIMESTAMP(3),
    "businessNumber" TEXT,
    "fullAddress" TEXT,
    "experience" TEXT,
    "salary" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankBranch" TEXT,
    "accountType" TEXT,
    "blackChequeDocument" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "personalPhone" TEXT,
    "email" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
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
    "visaStartDate" TIMESTAMP(3),
    "visaExpiryDate" TIMESTAMP(3),
    "onboardingStartDate" TIMESTAMP(3),
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
    "marketingStartDate" TIMESTAMP(3),
    "verbalConfirmationDate" TIMESTAMP(3),
    "linkedInterviewId" TEXT,
    "projectStartDate" TIMESTAMP(3),
    "billRate" TEXT,
    "payroll" TEXT,
    "workMode" TEXT,
    "pmName" TEXT,
    "pmEmail" TEXT,
    "pmPhone" TEXT,
    "driveLocation" TEXT,
    "phoneNumber" TEXT,
    "technology" TEXT,
    "resumeFile" TEXT,
    "resumeFileName" TEXT,
    "resumeUpdatedAt" TIMESTAMP(3),
    "comments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechSupport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "availability" TEXT,
    "calendarLink" TEXT,
    "amount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "interviewStartDate" TIMESTAMP(3) NOT NULL,
    "interviewEndDate" TIMESTAMP(3) NOT NULL,
    "interviewLevel" TEXT NOT NULL,
    "interviewStatus" TEXT NOT NULL,
    "techSupportId" TEXT,
    "amount" TEXT,
    "techSupportFeedback" TEXT,
    "otterLink" TEXT,
    "interviewQuestions" TEXT,
    "interviewFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreMarketing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "checklist" JSONB,
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
    "marketingStartDate" TIMESTAMP(3),
    "marketingEndDate" TIMESTAMP(3),
    "recruiterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "submittedById" TEXT NOT NULL,
    "consultantId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "receiptFile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "consultantId" TEXT,
    "consultantName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT NOT NULL,
    "visaStatus" TEXT,
    "university" TEXT,
    "state" TEXT,
    "optStartDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Interested',
    "comments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sheets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "accessTokenExpiry" TIMESTAMP(3),
    "spreadsheetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sheet_rows" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "loadedById" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_sheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("companyId","key")
);

-- CreateTable
CREATE TABLE "AppMigration" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_search_results" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technology" TEXT,
    "technologies" TEXT[],
    "source" TEXT NOT NULL,
    "vendorName" TEXT,
    "vendorEmail" TEXT,
    "vendorPhone" TEXT,
    "location" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "jobDescription" TEXT,
    "clientName" TEXT,
    "jobType" TEXT,
    "title" TEXT,
    "datePosted" TIMESTAMP(3),
    "dateScraped" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applyLink" TEXT,
    "rateMin" INTEGER,
    "rateMax" INTEGER,
    "visaRequirements" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rawData" JSONB,
    "sourceType" TEXT NOT NULL DEFAULT 'board',
    "atsProvider" TEXT,
    "companyName" TEXT,
    "employmentType" TEXT,
    "isContract" BOOLEAN NOT NULL DEFAULT true,
    "dedupeHash" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "classifiedBy" TEXT,
    "aiParsedAt" TIMESTAMP(3),
    "aiConfidence" DOUBLE PRECISION,
    "atsCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_search_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtsCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "boardToken" TEXT NOT NULL,
    "workdayHost" TEXT,
    "workdaySite" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCrawledAt" TIMESTAMP(3),
    "lastJobCount" INTEGER NOT NULL DEFAULT 0,
    "lastNewCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtsCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobIngestConfig" (
    "companyId" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "crawlIntervalMin" INTEGER NOT NULL DEFAULT 60,
    "maxCompaniesPerCycle" INTEGER NOT NULL DEFAULT 10,
    "boardScrapeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "boardScrapeHours" INTEGER NOT NULL DEFAULT 6,
    "lastBoardScrapeAt" TIMESTAMP(3),
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiBatchId" TEXT,
    "aiBatchSubmittedAt" TIMESTAMP(3),
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobIngestConfig_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "job_api_sources" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiKeyEnc" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMin" INTEGER NOT NULL DEFAULT 60,
    "activeFromHour" INTEGER,
    "activeToHour" INTEGER,
    "maxPerRun" INTEGER NOT NULL DEFAULT 100,
    "keywords" TEXT NOT NULL DEFAULT '',
    "contractOnly" BOOLEAN NOT NULL DEFAULT true,
    "extraParams" TEXT NOT NULL DEFAULT '',
    "startUrls" TEXT NOT NULL DEFAULT '',
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastFetched" INTEGER NOT NULL DEFAULT 0,
    "lastNew" INTEGER NOT NULL DEFAULT 0,
    "totalNew" INTEGER NOT NULL DEFAULT 0,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestError" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_api_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "accessTokenExpiry" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "reqScanAt" TIMESTAMP(3),

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailSettings" (
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailSettings_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "EmailDailyStat" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "day" TIMESTAMP(3) NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EmailDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterVendor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT NOT NULL,
    "technologies" TEXT,
    "clients" TEXT,
    "implementationPartners" TEXT,
    "notes" TEXT,
    "jobDescription" TEXT,
    "lastEmailedAt" TIMESTAMP(3),
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorCompany" TEXT NOT NULL,
    "recruiterName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "implementationName" TEXT,
    "clientName" TEXT NOT NULL,
    "technology" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoJobRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "triggerSubmissionId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "matchedConsultants" INTEGER NOT NULL DEFAULT 0,
    "vendorsFound" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoJobApplication" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "vendorContactId" TEXT NOT NULL,
    "vendorEmail" TEXT NOT NULL,
    "resumeUrl" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoJobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoJobsConfig" (
    "companyId" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "dailyCap" INTEGER NOT NULL DEFAULT 100,
    "maxVendorsPerRun" INTEGER NOT NULL DEFAULT 25,
    "cooldownDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoJobsConfig_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyQuote" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" TEXT[],
    "totalDays" INTEGER NOT NULL,
    "paidDays" INTEGER NOT NULL DEFAULT 0,
    "unpaidDays" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TailoredResume" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT,
    "consultantId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "clientName" TEXT,
    "technology" TEXT,
    "jobDescription" TEXT,
    "jdFile" TEXT,
    "jdFileName" TEXT,
    "createdById" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "atsBefore" INTEGER NOT NULL,
    "atsAfter" INTEGER NOT NULL,
    "keywords" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recruiterVendorId" TEXT,
    "emailRequirementId" TEXT,

    CONSTRAINT "TailoredResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EasySubmissionSend" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "vendorEmail" TEXT NOT NULL,
    "vendorName" TEXT,
    "vendorCompany" TEXT,
    "tailoredResumeId" TEXT,
    "subject" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EasySubmissionSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "interviewId" TEXT,
    "senderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "threadId" TEXT,
    "inReplyTo" TEXT,
    "via" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRequirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "alsoReceivedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gmailMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "jobTitle" TEXT,
    "technology" TEXT,
    "clientName" TEXT,
    "location" TEXT,
    "workMode" TEXT,
    "employmentType" TEXT,
    "rate" TEXT,
    "duration" TEXT,
    "visa" TEXT,
    "jobDescription" TEXT NOT NULL,
    "vendorName" TEXT,
    "vendorCompany" TEXT,
    "vendorEmail" TEXT,
    "vendorPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consultantId" TEXT,

    CONSTRAINT "EmailRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailScan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultantMailbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'oauth',
    "refreshTokenEnc" TEXT,
    "appPasswordEnc" TEXT,
    "accessTokenEnc" TEXT,
    "accessTokenExpiry" TIMESTAMP(3),
    "connectedById" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "reqScanAt" TIMESTAMP(3),

    CONSTRAINT "ConsultantMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorResumeSend" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "tailoredResumeId" TEXT,
    "subject" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorResumeSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRequirementSend" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "tailoredResumeId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailRequirementSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT,
    "tab" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionRefId" TEXT NOT NULL,
    "submissionCode" TEXT NOT NULL,
    "interviewRefId" TEXT,
    "interviewCode" TEXT,
    "consultantId" TEXT NOT NULL,
    "consultantName" TEXT NOT NULL,
    "clientName" TEXT,
    "implementationName" TEXT,
    "vendorCompany" TEXT,
    "rate" TEXT,
    "confirmationDate" DATE NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_placements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionRefId" TEXT NOT NULL,
    "submissionCode" TEXT NOT NULL,
    "interviewRefId" TEXT,
    "interviewCode" TEXT,
    "recruiterId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "consultantName" TEXT NOT NULL,
    "clientName" TEXT,
    "implementationName" TEXT,
    "vendorCompany" TEXT,
    "rate" TEXT,
    "billRate" DOUBLE PRECISION,
    "confirmationDate" DATE NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incentive_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appreciation_awards" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appreciation_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appreciation_bonuses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "otherReason" TEXT,
    "consultantId" TEXT,
    "consultantName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appreciation_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Screen_name_key" ON "Screen"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Screen_path_key" ON "Screen"("path");

-- CreateIndex
CREATE INDEX "RoleScreen_companyId_idx" ON "RoleScreen"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleScreen_roleId_screenId_key" ON "RoleScreen"("roleId", "screenId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_activationToken_key" ON "User"("activationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "Student_companyId_idx" ON "Student"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_companyId_email_key" ON "Student"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_submissionId_key" ON "Submission"("submissionId");

-- CreateIndex
CREATE INDEX "Submission_companyId_idx" ON "Submission"("companyId");

-- CreateIndex
CREATE INDEX "TechSupport_companyId_idx" ON "TechSupport"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TechSupport_companyId_email_key" ON "TechSupport"("companyId", "email");

-- CreateIndex
CREATE INDEX "Interview_companyId_idx" ON "Interview"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_companyId_interviewId_key" ON "Interview"("companyId", "interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "PreMarketing_consultantId_key" ON "PreMarketing"("consultantId");

-- CreateIndex
CREATE INDEX "PreMarketing_companyId_idx" ON "PreMarketing"("companyId");

-- CreateIndex
CREATE INDEX "Expense_companyId_idx" ON "Expense"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_companyId_expenseId_key" ON "Expense"("companyId", "expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_consultantId_key" ON "Lead"("consultantId");

-- CreateIndex
CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sheets_userId_key" ON "lead_sheets"("userId");

-- CreateIndex
CREATE INDEX "lead_sheets_companyId_idx" ON "lead_sheets"("companyId");

-- CreateIndex
CREATE INDEX "lead_sheet_rows_companyId_idx" ON "lead_sheet_rows"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sheet_rows_sheetId_rowKey_key" ON "lead_sheet_rows"("sheetId", "rowKey");

-- CreateIndex
CREATE UNIQUE INDEX "job_search_results_jobId_key" ON "job_search_results"("jobId");

-- CreateIndex
CREATE INDEX "job_search_results_dedupeHash_idx" ON "job_search_results"("dedupeHash");

-- CreateIndex
CREATE INDEX "job_search_results_sourceType_lastSeenAt_idx" ON "job_search_results"("sourceType", "lastSeenAt");

-- CreateIndex
CREATE INDEX "job_search_results_classifiedBy_idx" ON "job_search_results"("classifiedBy");

-- CreateIndex
CREATE INDEX "job_search_results_companyId_idx" ON "job_search_results"("companyId");

-- CreateIndex
CREATE INDEX "AtsCompany_isActive_lastCrawledAt_idx" ON "AtsCompany"("isActive", "lastCrawledAt");

-- CreateIndex
CREATE INDEX "AtsCompany_companyId_idx" ON "AtsCompany"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AtsCompany_companyId_provider_boardToken_workdaySite_key" ON "AtsCompany"("companyId", "provider", "boardToken", "workdaySite");

-- CreateIndex
CREATE INDEX "job_api_sources_companyId_idx" ON "job_api_sources"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "job_api_sources_companyId_provider_key" ON "job_api_sources"("companyId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_userId_key" ON "GmailAccount"("userId");

-- CreateIndex
CREATE INDEX "GmailAccount_companyId_idx" ON "GmailAccount"("companyId");

-- CreateIndex
CREATE INDEX "EmailDailyStat_companyId_idx" ON "EmailDailyStat"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDailyStat_userId_day_key" ON "EmailDailyStat"("userId", "day");

-- CreateIndex
CREATE INDEX "RecruiterVendor_ownerId_idx" ON "RecruiterVendor"("ownerId");

-- CreateIndex
CREATE INDEX "RecruiterVendor_companyId_idx" ON "RecruiterVendor"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterVendor_ownerId_email_key" ON "RecruiterVendor"("ownerId", "email");

-- CreateIndex
CREATE INDEX "VendorContact_clientName_idx" ON "VendorContact"("clientName");

-- CreateIndex
CREATE INDEX "VendorContact_companyId_idx" ON "VendorContact"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorContact_companyId_email_clientName_key" ON "VendorContact"("companyId", "email", "clientName");

-- CreateIndex
CREATE INDEX "AutoJobRun_companyId_idx" ON "AutoJobRun"("companyId");

-- CreateIndex
CREATE INDEX "AutoJobApplication_consultantId_vendorEmail_idx" ON "AutoJobApplication"("consultantId", "vendorEmail");

-- CreateIndex
CREATE INDEX "AutoJobApplication_companyId_idx" ON "AutoJobApplication"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoJobApplication_runId_consultantId_vendorContactId_key" ON "AutoJobApplication"("runId", "consultantId", "vendorContactId");

-- CreateIndex
CREATE INDEX "Attendance_status_day_idx" ON "Attendance"("status", "day");

-- CreateIndex
CREATE INDEX "Attendance_companyId_idx" ON "Attendance"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_userId_day_key" ON "Attendance"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuote_text_key" ON "DailyQuote"("text");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_status_idx" ON "LeaveRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_idx" ON "LeaveRequest"("companyId");

-- CreateIndex
CREATE INDEX "AiProvider_companyId_idx" ON "AiProvider"("companyId");

-- CreateIndex
CREATE INDEX "TailoredResume_submissionId_consultantId_idx" ON "TailoredResume"("submissionId", "consultantId");

-- CreateIndex
CREATE INDEX "TailoredResume_consultantId_createdAt_idx" ON "TailoredResume"("consultantId", "createdAt");

-- CreateIndex
CREATE INDEX "TailoredResume_recruiterVendorId_consultantId_idx" ON "TailoredResume"("recruiterVendorId", "consultantId");

-- CreateIndex
CREATE INDEX "TailoredResume_emailRequirementId_consultantId_idx" ON "TailoredResume"("emailRequirementId", "consultantId");

-- CreateIndex
CREATE INDEX "TailoredResume_companyId_idx" ON "TailoredResume"("companyId");

-- CreateIndex
CREATE INDEX "EasySubmissionSend_consultantId_vendorEmail_idx" ON "EasySubmissionSend"("consultantId", "vendorEmail");

-- CreateIndex
CREATE INDEX "EasySubmissionSend_submissionId_idx" ON "EasySubmissionSend"("submissionId");

-- CreateIndex
CREATE INDEX "EasySubmissionSend_companyId_idx" ON "EasySubmissionSend"("companyId");

-- CreateIndex
CREATE INDEX "FollowUp_submissionId_kind_idx" ON "FollowUp"("submissionId", "kind");

-- CreateIndex
CREATE INDEX "FollowUp_interviewId_idx" ON "FollowUp"("interviewId");

-- CreateIndex
CREATE INDEX "FollowUp_senderId_createdAt_idx" ON "FollowUp"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "FollowUp_companyId_idx" ON "FollowUp"("companyId");

-- CreateIndex
CREATE INDEX "EmailTemplate_userId_category_idx" ON "EmailTemplate"("userId", "category");

-- CreateIndex
CREATE INDEX "EmailTemplate_companyId_idx" ON "EmailTemplate"("companyId");

-- CreateIndex
CREATE INDEX "EmailRequirement_receivedAt_idx" ON "EmailRequirement"("receivedAt");

-- CreateIndex
CREATE INDEX "EmailRequirement_fingerprint_idx" ON "EmailRequirement"("fingerprint");

-- CreateIndex
CREATE INDEX "EmailRequirement_createdAt_idx" ON "EmailRequirement"("createdAt");

-- CreateIndex
CREATE INDEX "EmailRequirement_companyId_idx" ON "EmailRequirement"("companyId");

-- CreateIndex
CREATE INDEX "EmailScan_createdAt_idx" ON "EmailScan"("createdAt");

-- CreateIndex
CREATE INDEX "EmailScan_companyId_idx" ON "EmailScan"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailScan_ownerId_gmailMessageId_key" ON "EmailScan"("ownerId", "gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultantMailbox_consultantId_key" ON "ConsultantMailbox"("consultantId");

-- CreateIndex
CREATE INDEX "ConsultantMailbox_companyId_idx" ON "ConsultantMailbox"("companyId");

-- CreateIndex
CREATE INDEX "VendorResumeSend_vendorId_consultantId_idx" ON "VendorResumeSend"("vendorId", "consultantId");

-- CreateIndex
CREATE INDEX "VendorResumeSend_companyId_idx" ON "VendorResumeSend"("companyId");

-- CreateIndex
CREATE INDEX "EmailRequirementSend_requirementId_consultantId_idx" ON "EmailRequirementSend"("requirementId", "consultantId");

-- CreateIndex
CREATE INDEX "EmailRequirementSend_companyId_idx" ON "EmailRequirementSend"("companyId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_companyId_idx" ON "activity_logs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "confirmations_submissionRefId_key" ON "confirmations"("submissionRefId");

-- CreateIndex
CREATE INDEX "confirmations_confirmationDate_idx" ON "confirmations"("confirmationDate");

-- CreateIndex
CREATE INDEX "confirmations_companyId_idx" ON "confirmations"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "incentive_placements_submissionRefId_key" ON "incentive_placements"("submissionRefId");

-- CreateIndex
CREATE INDEX "incentive_placements_recruiterId_idx" ON "incentive_placements"("recruiterId");

-- CreateIndex
CREATE INDEX "incentive_placements_status_idx" ON "incentive_placements"("status");

-- CreateIndex
CREATE INDEX "incentive_placements_companyId_idx" ON "incentive_placements"("companyId");

-- CreateIndex
CREATE INDEX "appreciation_awards_userId_idx" ON "appreciation_awards"("userId");

-- CreateIndex
CREATE INDEX "appreciation_awards_companyId_idx" ON "appreciation_awards"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "appreciation_awards_month_category_userId_key" ON "appreciation_awards"("month", "category", "userId");

-- CreateIndex
CREATE INDEX "appreciation_bonuses_userId_idx" ON "appreciation_bonuses"("userId");

-- CreateIndex
CREATE INDEX "appreciation_bonuses_companyId_idx" ON "appreciation_bonuses"("companyId");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleScreen" ADD CONSTRAINT "RoleScreen_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleScreen" ADD CONSTRAINT "RoleScreen_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleScreen" ADD CONSTRAINT "RoleScreen_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechSupport" ADD CONSTRAINT "TechSupport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_techSupportId_fkey" FOREIGN KEY ("techSupportId") REFERENCES "TechSupport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreMarketing" ADD CONSTRAINT "PreMarketing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreMarketing" ADD CONSTRAINT "PreMarketing_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreMarketing" ADD CONSTRAINT "PreMarketing_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_sheets" ADD CONSTRAINT "lead_sheets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_sheet_rows" ADD CONSTRAINT "lead_sheet_rows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_search_results" ADD CONSTRAINT "job_search_results_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtsCompany" ADD CONSTRAINT "AtsCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobIngestConfig" ADD CONSTRAINT "JobIngestConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_api_sources" ADD CONSTRAINT "job_api_sources_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailSettings" ADD CONSTRAINT "GmailSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDailyStat" ADD CONSTRAINT "EmailDailyStat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDailyStat" ADD CONSTRAINT "EmailDailyStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterVendor" ADD CONSTRAINT "RecruiterVendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterVendor" ADD CONSTRAINT "RecruiterVendor_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoJobRun" ADD CONSTRAINT "AutoJobRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoJobApplication" ADD CONSTRAINT "AutoJobApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoJobApplication" ADD CONSTRAINT "AutoJobApplication_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutoJobRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoJobApplication" ADD CONSTRAINT "AutoJobApplication_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoJobApplication" ADD CONSTRAINT "AutoJobApplication_vendorContactId_fkey" FOREIGN KEY ("vendorContactId") REFERENCES "VendorContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoJobsConfig" ADD CONSTRAINT "AutoJobsConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "DailyQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProvider" ADD CONSTRAINT "AiProvider_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_recruiterVendorId_fkey" FOREIGN KEY ("recruiterVendorId") REFERENCES "RecruiterVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_emailRequirementId_fkey" FOREIGN KEY ("emailRequirementId") REFERENCES "EmailRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EasySubmissionSend" ADD CONSTRAINT "EasySubmissionSend_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EasySubmissionSend" ADD CONSTRAINT "EasySubmissionSend_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EasySubmissionSend" ADD CONSTRAINT "EasySubmissionSend_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EasySubmissionSend" ADD CONSTRAINT "EasySubmissionSend_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRequirement" ADD CONSTRAINT "EmailRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRequirement" ADD CONSTRAINT "EmailRequirement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailScan" ADD CONSTRAINT "EmailScan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantMailbox" ADD CONSTRAINT "ConsultantMailbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantMailbox" ADD CONSTRAINT "ConsultantMailbox_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantMailbox" ADD CONSTRAINT "ConsultantMailbox_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorResumeSend" ADD CONSTRAINT "VendorResumeSend_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorResumeSend" ADD CONSTRAINT "VendorResumeSend_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "RecruiterVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorResumeSend" ADD CONSTRAINT "VendorResumeSend_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRequirementSend" ADD CONSTRAINT "EmailRequirementSend_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRequirementSend" ADD CONSTRAINT "EmailRequirementSend_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "EmailRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRequirementSend" ADD CONSTRAINT "EmailRequirementSend_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_placements" ADD CONSTRAINT "incentive_placements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appreciation_awards" ADD CONSTRAINT "appreciation_awards_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appreciation_bonuses" ADD CONSTRAINT "appreciation_bonuses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
