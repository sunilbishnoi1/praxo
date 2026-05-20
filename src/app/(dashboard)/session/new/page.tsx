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
  ArrowRight,
  Sparkle
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
    color: "text-brand-700 bg-brand-500/10",
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
    color: "text-accent-600 bg-accent-500/10",
    estimatedTime: "45-60 Mins",
  },
];

const DIFFICULTIES = [
  { id: "intern", label: "Intern", description: "Foundational concepts" },
  { id: "junior", label: "Junior", description: "Early-career depth" },
  { id: "mid", label: "Mid", description: "Solid engineering fluency" },
  { id: "senior", label: "Senior", description: "Architecture & systems" },
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
      className={`flex w-full items-center justify-between rounded-lg border px-5 py-3 text-left transition-all duration-200 cursor-pointer ${
        checked
          ? "border-brand-500/35 bg-brand-500/5 shadow-[0_0_15px_rgba(242,106,46,0.02)]"
          : "border-border bg-card hover:bg-muted/10"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <div className="space-y-1 pr-4">
        <p className="font-semibold text-body text-foreground">{label}</p>
        <p className="text-caption text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <span
        className={`flex h-6 w-11 items-center rounded-full border transition-all ${
          checked
            ? "border-brand-500 bg-brand-500/25"
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
        "Draft saved successfully. Manage your active sessions in the dashboard."
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
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-body text-muted-foreground animate-pulse font-medium">
          Loading workspace session variables...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg flex-1">
      {/* Header Section */}
      <header className="flex justify-between items-end border-b border-border pb-stack-md shrink-0">
        <div className="flex flex-col gap-1">
          <p className="font-label-sm text-label-sm text-muted-foreground/80 uppercase tracking-wider">Playground</p>
          <h2 className="font-display text-4xl font-bold text-foreground">Configure Session</h2>
        </div>
      </header>

      {errorMsg && (
        <div className="flex items-start gap-element rounded-lg border border-red-500/20 bg-red-500/10 px-card py-element text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-body">Configuration Error</p>
            <p className="text-caption opacity-90 font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-element rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-card py-element text-emerald-600 dark:text-emerald-400">
          <Sparkle className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
          <div className="flex-1">
            <p className="font-semibold text-body">Success</p>
            <p className="text-caption opacity-90 font-medium">{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid gap-stack-lg lg:grid-cols-[8fr_4fr] items-start flex-1">
        {/* Left Side Options */}
        <div className="flex flex-col gap-stack-lg">
          {/* 1. Resume Select */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <CardTitle className="font-display text-xl font-bold text-foreground">1. Resume Profile</CardTitle>
              <CardDescription className="text-muted-foreground">
                Provide custom technical background details from your resume library.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-all cursor-pointer ${
                  dragActive
                    ? "border-brand-500 bg-brand-500/5"
                    : "border-border bg-muted/20 hover:bg-muted/30"
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
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700 mb-3">
                  <Upload className="h-6 w-6" aria-hidden />
                </div>
                <p className="font-semibold text-body">
                  {resumeFile ? resumeFile.name : "Drag and drop your PDF resume"}
                </p>
                <p className="text-caption text-muted-foreground mt-1 font-medium">
                  Supports PDF format up to 5MB
                </p>
                {!resumeFile && (
                  <Button type="button" variant="secondary" size="sm" className="mt-4">
                    Browse Files
                  </Button>
                )}
              </div>

              {resumeFile && (
                <Button
                  type="button"
                  onClick={uploadResume}
                  disabled={resumeUploading}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold"
                >
                  {resumeUploading ? "Processing..." : "Parse & Use Resume"}
                </Button>
              )}

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-body text-foreground">
                    Link Existing Profile
                  </Label>
                  <Link
                    href="/resume"
                    className="text-caption text-brand-700 hover:underline font-semibold"
                  >
                    Manage Library
                  </Link>
                </div>
                {resumes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/10 py-4 text-center text-caption text-muted-foreground font-medium">
                    No resumes saved. Upload above to proceed.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {resumes.map((resume) => (
                      <button
                        key={resume.id}
                        type="button"
                        onClick={() => setSelectedResumeId(resume.id)}
                        className={`flex items-center justify-between rounded-lg border px-4 py-2 text-left transition-all active:scale-98 font-semibold cursor-pointer ${
                          selectedResumeId === resume.id
                            ? "border-brand-500/40 bg-brand-500/10 text-brand-700"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                        }`}
                      >
                        <span className="text-caption mr-2">{resume.name}</span>
                        {resume.experienceLevel && (
                          <Badge variant="muted" className="text-[9px] px-1.5 font-bold">
                            {resume.experienceLevel}
                          </Badge>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedResumeId("")}
                      className={`rounded-lg border px-4 py-2 text-caption font-semibold transition-all active:scale-98 cursor-pointer ${
                        selectedResumeId === ""
                          ? "border-brand-500/40 bg-brand-500/10 text-brand-700"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                      }`}
                    >
                      Proceed without resume
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. Job Description Select */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl font-bold text-foreground">2. Target Job Description</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Customize scenario questions based on role requirements.
                  </CardDescription>
                </div>
                {jdText.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-brand-500 text-brand-700 hover:bg-brand-500/10 font-semibold"
                    onClick={parseJd}
                    disabled={jdParsing}
                  >
                    {jdParsing ? "Analyzing..." : "Structure JD"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <textarea
                rows={5}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste your target job descriptions, requirements, responsibilities, or role details here..."
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-body shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
              
              {jds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-body text-foreground">Link Extracted Role</Label>
                    <Link href="/jd" className="text-caption text-brand-700 hover:underline font-semibold">
                      Manage Library
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {jds.map((jd) => (
                      <button
                        key={jd.id}
                        type="button"
                        onClick={() => setSelectedJdId(jd.id)}
                        className={`flex items-center justify-between rounded-lg border px-4 py-2 text-left transition-all active:scale-98 font-semibold cursor-pointer ${
                          selectedJdId === jd.id
                            ? "border-brand-500/40 bg-brand-500/10 text-brand-700"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                        }`}
                      >
                        <span className="text-caption mr-2">{jd.name}</span>
                        <span className="text-[10px] text-muted-foreground/80 font-bold uppercase">
                          {jd.companyName || jd.roleLevel || "JD"}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedJdId("")}
                      className={`rounded-lg border px-4 py-2 text-caption font-semibold transition-all active:scale-98 cursor-pointer ${
                        selectedJdId === ""
                          ? "border-brand-500/40 bg-brand-500/10 text-brand-700"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                      }`}
                    >
                      Proceed without JD
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Round Type */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <CardTitle className="font-display text-xl font-bold text-foreground">3. Round Type</CardTitle>
              <CardDescription className="text-muted-foreground">
                Set core competency parameters and target scenario frameworks.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
              {ROUND_TYPES.map((round) => {
                const Icon = round.icon;
                const isSelected = selectedRound === round.id;
                return (
                  <button
                    key={round.id}
                    type="button"
                    onClick={() => setSelectedRound(round.id)}
                    className={`flex flex-col gap-3 rounded-lg border p-4 text-left transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? "border-brand-500 bg-brand-500/5 shadow-[0_0_15px_rgba(242,106,46,0.04)]"
                        : "border-border bg-card hover:border-brand-500/20 hover:shadow-sm"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${round.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-body text-foreground">
                        {round.name}
                      </p>
                      <p className="text-caption text-muted-foreground mt-1 leading-relaxed">
                        {round.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* 4. Difficulty */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <CardTitle className="font-display text-xl font-bold text-foreground">4. Difficulty Level</CardTitle>
              <CardDescription className="text-muted-foreground">
                Calibrate LLM grading criteria and interview strictness.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-2 md:grid-cols-5">
                {DIFFICULTIES.map((diff) => {
                  const isSelected = selectedDifficulty === diff.id;
                  return (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() => setSelectedDifficulty(diff.id)}
                      className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? "border-brand-500/40 bg-brand-500/10 text-brand-700 shadow-sm font-semibold"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                      }`}
                    >
                      <span className="text-body font-bold">{diff.label}</span>
                      <span className="text-[10px] text-muted-foreground/80 mt-1 font-medium hidden md:inline">
                        {diff.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDifficulty === "custom" && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-body font-bold text-foreground">
                      Target Years of Experience
                    </Label>
                    <span className="font-mono text-body font-bold text-brand-700 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
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
                    className="w-full accent-brand-500 cursor-pointer h-1.5 bg-border rounded-lg"
                  />
                  <p className="text-caption text-muted-foreground font-medium">
                    Adjusts algorithmic expectations and architectural deep-dive complexity dynamically.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Options */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border bg-muted/20 pb-4">
              <CardTitle className="font-display text-xl font-bold text-foreground">5. Advanced Modifiers</CardTitle>
              <CardDescription className="text-muted-foreground">
                Customize report generations and live interface layouts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <OptionToggle
                label="Use JD for scoring"
                description="Cross-reference candidate grading directly with parsed skills and Nice-to-Have criteria."
                checked={useJdForScoring}
                onChange={setUseJdForScoring}
              />
              <OptionToggle
                label="Generate ideal answer"
                description="Produce a structured high-quality reference solution in post-interview reports."
                checked={generateIdealAnswer}
                onChange={setGenerateIdealAnswer}
              />
              <OptionToggle
                label="Voice only"
                description="Force pure conversational mode by hiding continuous live transcripts."
                checked={voiceOnly}
                onChange={setVoiceOnly}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Sticky Sidebar */}
        <div className="sticky top-6 flex flex-col gap-element">
          <Card className="relative overflow-hidden border-border bg-card shadow-md">
            {submitting && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 p-card text-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                <div className="space-y-1">
                  <p className="font-bold text-body text-foreground">
                    Preparing Session
                  </p>
                  <p className="text-caption text-muted-foreground animate-pulse font-medium">
                    {submitStep}
                  </p>
                </div>
              </div>
            )}

            <CardHeader className="relative overflow-hidden border-b border-border pb-4 bg-muted/10">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,106,46,0.05)_0%,_rgba(242,106,46,0)_60%)]"
              />
              <CardTitle className="text-body font-display font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="h-5 w-5 text-brand-500" />
                Session Setup
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Summary of customized variables.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4 pt-6">
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-semibold">
                    Round Type
                  </span>
                  <span className="font-bold text-foreground text-right max-w-[150px] truncate">
                    {selectedRoundData?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-semibold">
                    Difficulty
                  </span>
                  <span className="font-bold text-foreground">
                    {formatDifficultySummary(selectedDifficulty, customYears)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-semibold">
                    Linked Resume
                  </span>
                  <span className="font-bold text-foreground text-right max-w-[150px] truncate">
                    {selectedResumeId
                      ? resumes.find((resume) => resume.id === selectedResumeId)?.name
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-semibold">
                    Linked JD
                  </span>
                  <span className="font-bold text-foreground text-right max-w-[150px] truncate">
                    {selectedJdId
                      ? jds.find((jd) => jd.id === selectedJdId)?.name
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption">
                  <span className="text-muted-foreground font-semibold">
                    Options
                  </span>
                  <span className="font-bold text-foreground">
                    {(useJdForScoring ? "JD" : "No JD") +
                      ", " +
                      (generateIdealAnswer ? "Ideal" : "No Ideal") +
                      ", " +
                      (voiceOnly ? "Voice" : "Hybrid")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-accent-500/10 bg-accent-500/5 px-4 py-3">
                <Clock className="h-5 w-5 text-accent-600 shrink-0" />
                <div>
                  <p className="font-bold text-caption text-foreground">
                    Estimated Time: {selectedRoundData?.estimatedTime}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 leading-relaxed">
                    Adjusts dynamically based on depth.
                  </p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2 p-card border-t border-border bg-muted/10">
              <Button
                onClick={handleStartInterview}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold"
                size="lg"
              >
                Start Interview
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                className="w-full font-semibold"
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
