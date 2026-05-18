-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roundType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "yearsOfExperience" REAL,
    "targetCompanyTier" TEXT,
    "targetSalaryRange" TEXT,
    "useJdForScoring" BOOLEAN NOT NULL DEFAULT true,
    "generateIdealAnswer" BOOLEAN NOT NULL DEFAULT true,
    "voiceOnly" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_sessions" ("completedAt", "createdAt", "deletedAt", "difficulty", "gapAnalysis", "id", "jobDescriptionId", "llmModel", "llmProvider", "questionCount", "resumeId", "roundType", "startedAt", "status", "sttProvider", "targetCompanyTier", "targetSalaryRange", "totalDurationMs", "ttsProvider", "updatedAt", "userId", "yearsOfExperience") SELECT "completedAt", "createdAt", "deletedAt", "difficulty", "gapAnalysis", "id", "jobDescriptionId", "llmModel", "llmProvider", "questionCount", "resumeId", "roundType", "startedAt", "status", "sttProvider", "targetCompanyTier", "targetSalaryRange", "totalDurationMs", "ttsProvider", "updatedAt", "userId", "yearsOfExperience" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE INDEX "sessions_userId_createdAt_idx" ON "sessions"("userId", "createdAt");
CREATE INDEX "sessions_userId_roundType_idx" ON "sessions"("userId", "roundType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
