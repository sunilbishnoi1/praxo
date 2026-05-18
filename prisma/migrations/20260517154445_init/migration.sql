-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'User',
    "defaultLlmProvider" TEXT,
    "defaultSttProvider" TEXT,
    "defaultTtsProvider" TEXT,
    "defaultDifficulty" TEXT,
    "defaultRoundType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "model" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "provider_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileHash" TEXT,
    "parsedSkills" TEXT,
    "parsedExperience" TEXT,
    "parsedEducation" TEXT,
    "parsedProjects" TEXT,
    "experienceLevel" TEXT,
    "yearsOfExperience" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "resumes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "parsedRequiredSkills" TEXT,
    "parsedNiceToHave" TEXT,
    "parsedRoleLevel" TEXT,
    "parsedCompanyName" TEXT,
    "parsedCompanyTier" TEXT,
    "parsedKeywords" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "job_descriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roundType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "yearsOfExperience" REAL,
    "targetCompanyTier" TEXT,
    "targetSalaryRange" TEXT,
    "llmProvider" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "sttProvider" TEXT NOT NULL,
    "ttsProvider" TEXT NOT NULL,
    "resumeId" TEXT,
    "jobDescriptionId" TEXT,
    "gapAnalysis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'configuring',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "totalDurationMs" INTEGER,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sessions_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sessions_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "expectedAnswer" TEXT,
    "expectedKeyPoints" TEXT,
    "relatedSkills" TEXT,
    "dsaProblemType" TEXT,
    "expectedTimeComplexity" TEXT,
    "expectedSpaceComplexity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "audioDurationMs" INTEGER,
    "fluencyMetrics" TEXT NOT NULL,
    "scores" TEXT NOT NULL,
    "codeSubmission" TEXT,
    "codeLanguage" TEXT,
    "codeExecutionResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "roundTypeScore" INTEGER NOT NULL,
    "dimensionAverages" TEXT NOT NULL,
    "fluencySummary" TEXT NOT NULL,
    "strongestAnswerIds" TEXT NOT NULL,
    "weakestAnswerIds" TEXT NOT NULL,
    "companyFitScore" INTEGER,
    "companyFitAnalysis" TEXT,
    "overallSummary" TEXT NOT NULL,
    "keyStrengths" TEXT NOT NULL,
    "keyWeaknesses" TEXT NOT NULL,
    "studyRecommendations" TEXT NOT NULL,
    "nextSessionFocus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "session_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progress_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionDate" DATETIME NOT NULL,
    "roundType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "fluencyScore" INTEGER NOT NULL,
    "relevanceScore" INTEGER NOT NULL,
    "depthScore" INTEGER NOT NULL,
    "technicalScore" INTEGER NOT NULL,
    "coherenceScore" INTEGER NOT NULL,
    "averageWpm" REAL NOT NULL,
    "fillerWordCount" INTEGER NOT NULL,
    "pauseCount" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "progress_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_userId_provider_key" ON "provider_configs"("userId", "provider");

-- CreateIndex
CREATE INDEX "sessions_userId_createdAt_idx" ON "sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "sessions_userId_roundType_idx" ON "sessions"("userId", "roundType");

-- CreateIndex
CREATE INDEX "questions_sessionId_orderIndex_idx" ON "questions"("sessionId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "answers_questionId_key" ON "answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "session_reports_sessionId_key" ON "session_reports"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "progress_entries_sessionId_key" ON "progress_entries"("sessionId");

-- CreateIndex
CREATE INDEX "progress_entries_userId_sessionDate_idx" ON "progress_entries"("userId", "sessionDate");

-- CreateIndex
CREATE INDEX "progress_entries_userId_roundType_sessionDate_idx" ON "progress_entries"("userId", "roundType", "sessionDate");
