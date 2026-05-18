"use client";

import {
  useState,
  useEffect,
  useRef,
  type ReactElement,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Binary,
  Clock,
  Cpu,
  FileUser,
  HeartHandshake,
  Loader2,
  Network,
  Sparkles,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type ResumeOption = {
  id: string;
  name: string;
  experienceLevel: string | null;
  yearsOfExperience: number | null;
};

type JdOption = {
  id: string;
  name: string;
  companyName: string | null;
  roleLevel: string | null;
};

const ROUND_TYPES = [
  {
    id: "technical-resume",
    name: "Technical - Resume-Based",
    description:
      "Deep-dive questions validating resume claims and tech stacks.",
    icon: FileUser,
    color: "text-amber-500 bg-amber-500/10",
    estimatedTime: "30-40 Mins",
  },
  {
    id: "dsa",
    name: "DSA (Algorithms)",
    description: "Algorithmic challenges covering complexity and reasoning.",
    icon: Binary,
    color: "text-blue-500 bg-blue-500/10",
    estimatedTime: "40-50 Mins",
  },
  {
    id: "behavioural",
    name: "Behavioural (STAR)",
    description: "Leadership, conflict, collaboration, and STAR storytelling.",
    icon: HeartHandshake,
    color: "text-rose-500 bg-rose-500/10",
    estimatedTime: "25-35 Mins",
  },
  {
    id: "oop-cs",
    name: "OOP & CS Fundamentals",
    description: "Core CS systems with SOLID and design patterns depth.",
    icon: Cpu,
    color: "text-teal-500 bg-teal-500/10",
    estimatedTime: "25-35 Mins",
  },
  {
    id: "system-design",
    name: "System Design",
    description: "Architecture, scaling, reliability, and trade-offs.",
    icon: Network,
    color: "text-purple-500 bg-purple-500/10",
    estimatedTime: "45-60 Mins",
  },
];

const DIFFICULTIES = [
  { id: "intern", label: "Intern", description: "Foundational concepts" },
  { id: "junior", label: "Junior", description: "Early-career depth" },
  { id: "mid", label: "Mid", description: "Solid engineering fluency" },
  { id: "senior", label: "Senior", description: "Architecture and trade-offs" },
  { id: "custom", label: "Custom", description: "Set exact YOE" },
];

function deriveJdName(rawText: string): string {
  const firstLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstLine) {
    return firstLine.slice(0, 60);
  }

  const now = new Date();
  return `JD ${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function formatDifficultySummary(
  difficulty: string,
  yearsOfExperience: number,
): string {
  const entry = DIFFICULTIES.find((level) => level.id === difficulty);
  if (!entry) return "Unknown";
  if (difficulty === "custom") {
    return `${entry.label} (${yearsOfExperience} YOE)`;
  }
  return entry.label;
}

type ToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function OptionToggle({
  label,
  description,
  checked,
  onChange,
}: ToggleProps): ReactElement {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-button border px-element py-3 text-left transition-all ${
        checked
          ? "border-accent-500/50 bg-accent-500/5"
          : "border-border bg-surface"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <div className="space-y-1">
        <p className="font-semibold text-body text-foreground">{label}</p>
        <p className="text-caption text-muted-foreground">{description}</p>
      </div>
      <span
        className={`flex h-6 w-11 items-center rounded-full border transition-all ${
          checked
            ? "border-accent-500 bg-accent-500/20"
            : "border-border bg-muted"
        }`}
      >
        <span
          className={`ml-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export default function NewSessionPage(): ReactElement {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedRound, setSelectedRound] =
    useState<string>("technical-resume");
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<string>("junior");
  const [customYears, setCustomYears] = useState<number>(4);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [selectedJdId, setSelectedJdId] = useState<string>("");

  const [useJdForScoring, setUseJdForScoring] = useState<boolean>(true);
  const [generateIdealAnswer, setGenerateIdealAnswer] = useState<boolean>(true);
  const [voiceOnly, setVoiceOnly] = useState<boolean>(false);

  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [jds, setJds] = useState<JdOption[]>([]);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploading, setResumeUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const [jdText, setJdText] = useState<string>("");
  const [jdParsing, setJdParsing] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitStep, setSubmitStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  useEffect(() => {
    async function loadData(): Promise<void> {
      setLoading(true);
      setErrorMsg("");
      try {
        const [resumesRes, jdsRes] = await Promise.all([
          fetch("/api/resumes"),
          fetch("/api/job-descriptions"),
        ]);

        const resumesJson = await resumesRes.json();
        const jdsJson = await jdsRes.json();

        if (resumesJson.success) {
          setResumes(resumesJson.data.resumes || []);
        }
        if (jdsJson.success) {
          setJds(jdsJson.data.jobDescriptions || []);
        }
      } catch (err) {
        console.error("Failed to load session options:", err);
        setErrorMsg("Failed to load options. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function handleDrag(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setResumeFile(file);
      } else {
        setErrorMsg("Only PDF resumes are supported.");
      }
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setResumeFile(file);
      } else {
        setErrorMsg("Only PDF resumes are supported.");
      }
    }
  }

  function triggerFileInput(): void {
    fileInputRef.current?.click();
  }

  async function uploadResume(): Promise<void> {
    if (!resumeFile) {
      setErrorMsg("Select a PDF resume to upload.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setResumeUploading(true);

    try {
      const formData = new FormData();
      const fileName = resumeFile.name.replace(/\.pdf$/i, "");
      formData.append("name", fileName || "Resume");
      formData.append("file", resumeFile);

      const response = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to upload resume.");
      }

      setResumeFile(null);
      setSelectedResumeId(json.data.resume.id);
      setSuccessMsg("Resume uploaded and linked to this session.");

      const listRes = await fetch("/api/resumes");
      const listJson = await listRes.json();
      if (listJson.success) {
        setResumes(listJson.data.resumes || []);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Resume upload failed.");
    } finally {
      setResumeUploading(false);
    }
  }

  async function parseJd(): Promise<void> {
    if (!jdText.trim()) {
      setErrorMsg("Paste a job description before parsing.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setJdParsing(true);

    try {
      const response = await fetch("/api/job-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deriveJdName(jdText),
          text: jdText,
        }),
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(
          json.error?.message || "Failed to parse job description.",
        );
      }

      setSelectedJdId(json.data.jobDescription.id);
      setJdText("");
      setSuccessMsg("Job description parsed and linked.");

      const listRes = await fetch("/api/job-descriptions");
      const listJson = await listRes.json();
      if (listJson.success) {
        setJds(listJson.data.jobDescriptions || []);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Job description parsing failed.");
    } finally {
      setJdParsing(false);
    }
  }

  async function createSession(): Promise<string> {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundType: selectedRound,
        difficulty: selectedDifficulty,
        yearsOfExperience: selectedDifficulty === "custom" ? customYears : null,
        resumeId: selectedResumeId || null,
        jobDescriptionId: selectedJdId || null,
        useJdForScoring,
        generateIdealAnswer,
        voiceOnly,
      }),
    });

    const json = await response.json();
    if (!json.success) {
      throw new Error(
        json.error?.message || "Failed to create session record.",
      );
    }

    return json.data.session.id as string;
  }

  async function handleStartInterview(): Promise<void> {
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);
    setSubmitStep("Creating interview session...");

    try {
      const sessionId = await createSession();
      setSubmitStep("Generating tailored questions...");

      const startRes = await fetch(`/api/sessions/${sessionId}/start`, {
        method: "POST",
      });
      const startJson = await startRes.json();
      if (!startJson.success) {
        throw new Error(
          startJson.error?.message || "Failed to start the session.",
        );
      }

      setSubmitStep("Redirecting to live interview...");
      router.push(`/session/${sessionId}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to start interview session.");
      setSubmitting(false);
    }
  }

  async function handleSaveDraft(): Promise<void> {
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);
    setSubmitStep("Saving session draft...");

    try {
      await createSession();
      setSuccessMsg(
        "Draft saved. You can start it once the Sessions list is available.",
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to save draft.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRoundData = ROUND_TYPES.find(
    (round) => round.id === selectedRound,
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-element">
        <Loader2 className="h-10 w-10 animate-spin text-accent-500" />
        <p className="text-body text-muted-foreground animate-pulse">
          Loading session configuration...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-col gap-element">
        <h1 className="font-display text-display">Configure Session</h1>
        <p className="text-body text-muted-foreground">
          Set your personalization sources, round format, and interview depth.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-element rounded-button border border-destructive/20 bg-destructive/5 p-element text-body text-destructive-foreground">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Configuration Error</p>
            <p className="text-caption opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-element rounded-button border border-accent-500/30 bg-accent-500/10 p-element text-body text-foreground">
          <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-accent-500" />
          <div className="flex-1">
            <p className="font-semibold">Success</p>
            <p className="text-caption text-muted-foreground">{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid gap-section lg:grid-cols-[8fr_4fr] items-start">
        <div className="flex flex-col gap-section">
          <Card>
            <CardHeader>
              <CardTitle className="text-heading">1. Resume Upload</CardTitle>
              <CardDescription>
                Drag and drop a resume or select from your recent profiles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-section">
              <div
                className={`flex flex-col items-center justify-center rounded-card border border-dashed p-6 text-center transition-all ${
                  dragActive
                    ? "border-accent-500 bg-accent-500/5"
                    : "border-border bg-surface-raised"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/10 text-accent-600 mb-3">
                  <Upload className="h-6 w-6" aria-hidden />
                </div>
                <p className="font-medium text-body">
                  {resumeFile
                    ? resumeFile.name
                    : "Drag and drop your PDF resume"}
                </p>
                <p className="text-caption text-muted-foreground mt-1">
                  Supports PDF format up to 5MB
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  Browse Files
                </Button>
              </div>

              <Button
                type="button"
                onClick={uploadResume}
                disabled={!resumeFile || resumeUploading}
                className="w-full"
              >
                {resumeUploading ? "Uploading..." : "Upload Resume"}
              </Button>

              <div className="space-y-element">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-body">
                    Recent resumes
                  </Label>
                  <Link
                    href="/resume"
                    className="text-caption text-accent-500 hover:underline"
                  >
                    Manage library
                  </Link>
                </div>
                {resumes.length === 0 ? (
                  <div className="rounded-button border border-dashed border-border bg-surface px-element py-4 text-center text-caption text-muted-foreground">
                    No resumes saved yet.
                  </div>
                ) : (
                  <div className="grid gap-element">
                    {resumes.map((resume) => (
                      <button
                        key={resume.id}
                        type="button"
                        onClick={() => setSelectedResumeId(resume.id)}
                        className={`flex items-center justify-between rounded-button border px-element py-2 text-left transition-all ${
                          selectedResumeId === resume.id
                            ? "border-accent-500 bg-accent-500/5"
                            : "border-border bg-surface"
                        }`}
                      >
                        <span className="font-medium text-body">
                          {resume.name}
                        </span>
                        {resume.experienceLevel ? (
                          <Badge variant="muted" className="text-caption">
                            {resume.experienceLevel}
                          </Badge>
                        ) : null}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedResumeId("")}
                      className={`rounded-button border px-element py-2 text-caption text-muted-foreground transition-all ${
                        selectedResumeId === ""
                          ? "border-accent-500 bg-accent-500/5"
                          : "border-border bg-surface"
                      }`}
                    >
                      Proceed without resume
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-heading">
                  2. Job Description
                </CardTitle>
                <CardDescription>
                  Paste the role description to tailor question focus.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={parseJd}
                disabled={jdParsing}
              >
                {jdParsing ? "Parsing..." : "Parse JD"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-element">
              <textarea
                rows={6}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the job requirements, skills, and responsibilities here..."
                className="w-full rounded-button border border-border bg-surface px-element py-3 text-body focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
              {jds.length > 0 && (
                <div className="space-y-element">
                  <Label className="font-semibold text-body">Recent JDs</Label>
                  <div className="grid gap-element">
                    {jds.map((jd) => (
                      <button
                        key={jd.id}
                        type="button"
                        onClick={() => setSelectedJdId(jd.id)}
                        className={`flex items-center justify-between rounded-button border px-element py-2 text-left transition-all ${
                          selectedJdId === jd.id
                            ? "border-accent-500 bg-accent-500/5"
                            : "border-border bg-surface"
                        }`}
                      >
                        <span className="font-medium text-body">{jd.name}</span>
                        <span className="text-caption text-muted-foreground">
                          {jd.companyName || jd.roleLevel || "JD"}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedJdId("")}
                      className={`rounded-button border px-element py-2 text-caption text-muted-foreground transition-all ${
                        selectedJdId === ""
                          ? "border-accent-500 bg-accent-500/5"
                          : "border-border bg-surface"
                      }`}
                    >
                      Proceed without JD
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-heading">3. Round Type</CardTitle>
              <CardDescription>
                Select the interview format and competency focus.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-element md:grid-cols-2">
              {ROUND_TYPES.map((round) => {
                const Icon = round.icon;
                const isSelected = selectedRound === round.id;
                return (
                  <button
                    key={round.id}
                    type="button"
                    onClick={() => setSelectedRound(round.id)}
                    className={`flex flex-col gap-element rounded-button border p-card text-left transition-all ${
                      isSelected
                        ? "border-accent-500 bg-surface shadow-glow"
                        : "border-border bg-surface hover:border-accent-300"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-button ${round.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-body text-foreground">
                        {round.name}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {round.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-heading">4. Difficulty</CardTitle>
              <CardDescription>
                Choose the depth and rigor of the interviewer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-section">
              <div className="grid gap-element md:grid-cols-5">
                {DIFFICULTIES.map((diff) => {
                  const isSelected = selectedDifficulty === diff.id;
                  return (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() => setSelectedDifficulty(diff.id)}
                      className={`flex flex-col items-center justify-center rounded-button border p-element text-center transition-all ${
                        isSelected
                          ? "border-accent-500 bg-surface shadow-glow"
                          : "border-border bg-surface"
                      }`}
                    >
                      <span className="font-semibold text-body">
                        {diff.label}
                      </span>
                      <span className="text-caption text-muted-foreground mt-1 hidden md:inline">
                        {diff.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDifficulty === "custom" && (
                <div className="space-y-element rounded-button border border-border bg-surface p-element">
                  <div className="flex items-center justify-between">
                    <Label className="text-body font-semibold">
                      Target YOE
                    </Label>
                    <span className="font-mono text-body font-bold text-accent-500 bg-accent-500/5 px-2 py-0.5 rounded">
                      {customYears} Years
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={customYears}
                    onChange={(e) =>
                      setCustomYears(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-accent-500 cursor-pointer"
                  />
                  <p className="text-caption text-muted-foreground">
                    Custom YOE calibrates question depth and system design
                    expectations.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-heading">5. Options</CardTitle>
              <CardDescription>
                Tune how the interview is scored and delivered.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-element">
              <OptionToggle
                label="Use JD for scoring"
                description="Apply JD requirements when grading answers."
                checked={useJdForScoring}
                onChange={setUseJdForScoring}
              />
              <OptionToggle
                label="Generate ideal answer"
                description="Include a model answer in the final report."
                checked={generateIdealAnswer}
                onChange={setGenerateIdealAnswer}
              />
              <OptionToggle
                label="Voice only"
                description="Disable text fallback and keep the session audio-first."
                checked={voiceOnly}
                onChange={setVoiceOnly}
              />
            </CardContent>
          </Card>
        </div>

        <div className="sticky top-6 flex flex-col gap-element">
          <Card className="relative overflow-hidden border-border bg-surface">
            {submitting && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/85 p-card text-center gap-card">
                <Loader2 className="h-10 w-10 animate-spin text-accent-500" />
                <div className="space-y-2">
                  <p className="font-semibold text-body text-foreground">
                    Preparing session
                  </p>
                  <p className="text-caption text-muted-foreground animate-pulse">
                    {submitStep}
                  </p>
                </div>
              </div>
            )}

            <CardHeader className="relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,106,46,0.08)_0%,_rgba(242,106,46,0)_60%)]"
              />
              <CardTitle className="text-heading flex items-center gap-element">
                <Sparkles className="h-5 w-5 text-accent-500" />
                Session Summary
              </CardTitle>
              <CardDescription>
                Review your selections before starting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-card">
              <div className="rounded-button border border-border bg-surface px-element py-3 space-y-2">
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">
                    Round Type
                  </span>
                  <span className="font-semibold text-foreground text-right max-w-[200px] truncate">
                    {selectedRoundData?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">
                    Difficulty
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDifficultySummary(selectedDifficulty, customYears)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">
                    Resume
                  </span>
                  <span className="font-semibold text-foreground text-right max-w-[200px] truncate">
                    {selectedResumeId
                      ? resumes.find((resume) => resume.id === selectedResumeId)
                          ?.name
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">
                    Job Description
                  </span>
                  <span className="font-semibold text-foreground text-right max-w-[200px] truncate">
                    {selectedJdId
                      ? jds.find((jd) => jd.id === selectedJdId)?.name
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption">
                  <span className="text-muted-foreground font-medium">
                    Options
                  </span>
                  <span className="font-semibold text-foreground">
                    {(useJdForScoring ? "JD" : "No JD") +
                      ", " +
                      (generateIdealAnswer ? "Ideal" : "No Ideal") +
                      ", " +
                      (voiceOnly ? "Voice" : "Hybrid")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-element rounded-button border border-accent-500/10 bg-accent-500/5 px-element py-3">
                <Clock className="h-5 w-5 text-accent-500 shrink-0" />
                <div>
                  <p className="font-semibold text-caption text-foreground">
                    Estimated Time: {selectedRoundData?.estimatedTime}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Question count adapts to difficulty and round type.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-element">
              <Button
                onClick={handleStartInterview}
                className="w-full font-semibold shadow-glow"
                size="lg"
              >
                Start Interview
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                className="w-full"
              >
                Save Draft
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
