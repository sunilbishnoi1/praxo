"use client";

import { useState, useEffect, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Binary,
  HeartHandshake,
  Cpu,
  Network,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Clock,
  Settings,
  BadgeAlert,
  Loader2,
  FileUser,
  FileText
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
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
  roleLevel: string | null;
  companyName: string | null;
  companyTier: string | null;
};

type ProviderOption = {
  provider: string;
  isConfigured: boolean;
  isValid: boolean;
  model: string | null;
};

const ROUND_TYPES = [
  {
    id: "technical-resume",
    name: "Technical — Resume-Based",
    description: "Deep-dive questions validating resume claims, experiences, and tech stacks.",
    icon: FileUser,
    color: "text-amber-500 bg-amber-500/10",
    estimatedTime: "30-40 Mins"
  },
  {
    id: "dsa",
    name: "DSA (Algorithms)",
    description: "Algorithmic challenges calibrating problem-solving, complexity, and logical thinking.",
    icon: Binary,
    color: "text-blue-500 bg-blue-500/10",
    estimatedTime: "40-50 Mins"
  },
  {
    id: "behavioural",
    name: "Behavioural (STAR)",
    description: "Assess leadership, conflicts, collaboration, and cultural alignment using STAR.",
    icon: HeartHandshake,
    color: "text-rose-500 bg-rose-500/10",
    estimatedTime: "25-35 Mins"
  },
  {
    id: "oop-cs",
    name: "OOP & CS Fundamentals",
    description: "Test object-oriented design principles (SOLID, patterns) and core CS systems.",
    icon: Cpu,
    color: "text-teal-500 bg-teal-500/10",
    estimatedTime: "25-35 Mins"
  },
  {
    id: "system-design",
    name: "System Design",
    description: "Assess architecture strategy, components, database choices, scaling, and fault tolerance.",
    icon: Network,
    color: "text-purple-500 bg-purple-500/10",
    estimatedTime: "45-60 Mins"
  }
];

const DIFFICULTIES = [
  { id: "intern", label: "Intern", description: "Conceptual baseline" },
  { id: "fresher", label: "Fresher / Junior", description: "1-2 Years Experience" },
  { id: "experienced", label: "Experienced / Senior", description: "3+ Years / Deep concepts" }
];

export default function NewSessionPage(): ReactElement {
  const router = useRouter();

  // Selection state
  const [selectedRound, setSelectedRound] = useState<string>("technical-resume");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("fresher");
  const [yearsOfExp, setYearsOfExp] = useState<number>(3);
  const [targetCompanyTier, setTargetCompanyTier] = useState<string>("");
  const [targetSalaryRange, setTargetSalaryRange] = useState<string>("");
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [selectedJdId, setSelectedJdId] = useState<string>("");
  const [selectedLlm, setSelectedLlm] = useState<string>("");
  const [sttProvider, setSttProvider] = useState<string>("deepgram");
  const [ttsProvider, setTtsProvider] = useState<string>("openai");

  // Options lists
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [jds, setJds] = useState<JdOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  // Loading & submit states
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitStep, setSubmitStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg("");
      try {
        const [resumesRes, jdsRes, providersRes] = await Promise.all([
          fetch("/api/resumes"),
          fetch("/api/job-descriptions"),
          fetch("/api/providers")
        ]);

        const resumesJson = await resumesRes.json();
        const jdsJson = await jdsRes.json();
        const providersJson = await providersRes.json();

        if (resumesJson.success) {
          setResumes(resumesJson.data.resumes || []);
          if (resumesJson.data.resumes?.length > 0) {
            setSelectedResumeId(resumesJson.data.resumes[0].id);
          }
        }
        if (jdsJson.success) {
          setJds(jdsJson.data.jobDescriptions || []);
          if (jdsJson.data.jobDescriptions?.length > 0) {
            setSelectedJdId(jdsJson.data.jobDescriptions[0].id);
          }
        }
        if (providersJson.success) {
          const list = providersJson.data.providers || [];
          setProviders(list);
          const configured = list.filter((p: any) => p.isConfigured);
          if (configured.length > 0) {
            setSelectedLlm(configured[0].provider);
          }
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

  async function handleStartInterview(): Promise<void> {
    if (!selectedLlm) {
      setErrorMsg("Please configure and select an active LLM provider in Settings first.");
      return;
    }

    setErrorMsg("");
    setSubmitting(true);
    setSubmitStep("Creating interview session...");

    try {
      // 1. Create Session
      const createRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundType: selectedRound,
          difficulty: selectedDifficulty,
          yearsOfExperience: selectedDifficulty === "experienced" ? yearsOfExp : null,
          targetCompanyTier: targetCompanyTier || null,
          targetSalaryRange: targetSalaryRange || null,
          resumeId: selectedResumeId || null,
          jobDescriptionId: selectedJdId || null,
          llmProvider: selectedLlm,
          sttProvider,
          ttsProvider
        })
      });

      const createJson = await createRes.json();
      if (!createJson.success) {
        throw new Error(createJson.error?.message || "Failed to create session record.");
      }

      const sessionId = createJson.data.session.id;

      // Shifting progress text to look premium
      setSubmitStep("Running target JD gap analysis...");
      await new Promise((r) => setTimeout(r, 1200));

      setSubmitStep("Generating high-fidelity technical questions...");
      
      // 2. Start Session
      const startRes = await fetch(`/api/sessions/${sessionId}/start`, {
        method: "POST"
      });

      const startJson = await startRes.json();
      if (!startJson.success) {
        throw new Error(startJson.error?.message || "Failed to generate question batch.");
      }

      setSubmitStep("Redirecting to active interview space...");
      await new Promise((r) => setTimeout(r, 800));

      // 3. Redirect to interview route
      router.push(`/session/${sessionId}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to startup interview session. Try again.");
      setSubmitting(false);
    }
  }

  const selectedRoundData = ROUND_TYPES.find((r) => r.id === selectedRound);
  const activeProviders = providers.filter((p) => p.isConfigured);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-element">
        <Loader2 className="h-10 w-10 animate-spin text-accent-500" />
        <p className="text-body text-muted-foreground animate-pulse">Loading customization engine context...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      {/* Header */}
      <div className="flex flex-col gap-element">
        <h1 className="font-display text-display">Configure Session</h1>
        <p className="text-body text-muted-foreground">
          Calibrate interview focus, difficulty, and providers to construct a highly personalized voice mock session.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-element rounded-button border border-destructive/20 bg-destructive/5 p-element text-body text-destructive-foreground">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Initialization Error</p>
            <p className="text-caption opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-section lg:grid-cols-[7fr_5fr] items-start">
        {/* Left Column - Form */}
        <div className="flex flex-col gap-section">
          {/* Step 1: Round Type Selector */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-heading">1. Select Round Type</CardTitle>
              <CardDescription>
                Choose the structural format and focus of your practice interview.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-element">
              <div className="grid gap-element md:grid-cols-2">
                {ROUND_TYPES.map((round) => {
                  const Icon = round.icon;
                  const isSelected = selectedRound === round.id;
                  return (
                    <button
                      key={round.id}
                      onClick={() => setSelectedRound(round.id)}
                      className={`group relative flex flex-col gap-element rounded-button border text-left p-card transition-all duration-150 ${
                        isSelected
                          ? "border-accent-500 bg-surface shadow-glow"
                          : "border-border bg-surface hover:border-accent-300 hover:shadow-card hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-button ${round.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge variant="muted" className="text-caption">
                          {round.estimatedTime}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-semibold text-body group-hover:text-accent-500 transition-colors">
                          {round.name}
                        </p>
                        <p className="text-caption text-muted-foreground mt-1 line-clamp-2">
                          {round.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Personalization Inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading">2. Personalization Sources</CardTitle>
              <CardDescription>
                Link profiles to automatically calculate gaps and tailor questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-section">
              {/* Resume selection */}
              <div className="space-y-element">
                <div className="flex items-center justify-between">
                  <Label htmlFor="resume-select" className="font-semibold text-body">
                    Target Resume Profile
                  </Label>
                  <Link href="/resume" className="text-caption text-accent-500 hover:underline flex items-center gap-0.5">
                    Upload new <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {resumes.length === 0 ? (
                  <div className="rounded-button border border-dashed border-border bg-surface px-element py-card text-center text-caption text-muted-foreground">
                    No resumes in library. Interview will proceed with generic defaults.
                  </div>
                ) : (
                  <select
                    id="resume-select"
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="w-full rounded-button border border-border bg-surface px-element py-3 text-body focus:outline-none focus:ring-1 focus:ring-accent-500 transition-all"
                  >
                    <option value="">None (Fully Generic/Role-only)</option>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.experienceLevel ? `(${r.experienceLevel})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* JD selection */}
              <div className="space-y-element">
                <div className="flex items-center justify-between">
                  <Label htmlFor="jd-select" className="font-semibold text-body">
                    Target Job Description (JD)
                  </Label>
                  <Link href="/jd" className="text-caption text-accent-500 hover:underline flex items-center gap-0.5">
                    Add new <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                {jds.length === 0 ? (
                  <div className="rounded-button border border-dashed border-border bg-surface px-element py-card text-center text-caption text-muted-foreground">
                    No JDs in library. Interview will proceed based on resume only.
                  </div>
                ) : (
                  <select
                    id="jd-select"
                    value={selectedJdId}
                    onChange={(e) => setSelectedJdId(e.target.value)}
                    className="w-full rounded-button border border-border bg-surface px-element py-3 text-body focus:outline-none focus:ring-1 focus:ring-accent-500 transition-all"
                  >
                    <option value="">None (Generic Industry Benchmarks)</option>
                    {jds.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name} {j.companyName ? `@ ${j.companyName}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Difficulty & Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading">3. Difficulty & Calibration</CardTitle>
              <CardDescription>
                Calibrate the depth of conceptual probing and complexity limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-section">
              {/* Segmented control for difficulty */}
              <div className="space-y-element">
                <Label className="font-semibold text-body">Interviewer Level</Label>
                <div className="grid grid-cols-3 gap-element">
                  {DIFFICULTIES.map((diff) => {
                    const isSelected = selectedDifficulty === diff.id;
                    return (
                      <button
                        key={diff.id}
                        type="button"
                        onClick={() => setSelectedDifficulty(diff.id)}
                        className={`flex flex-col items-center justify-center p-element rounded-button border text-center transition-all ${
                          isSelected
                            ? "border-accent-500 bg-surface shadow-glow"
                            : "border-border bg-surface hover:border-accent-300"
                        }`}
                      >
                        <span className="font-semibold text-body">{diff.label}</span>
                        <span className="text-caption text-muted-foreground mt-0.5 text-center hidden md:inline">
                          {diff.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Experienced YOE Slider */}
              {selectedDifficulty === "experienced" && (
                <div className="space-y-element rounded-button border border-border bg-surface p-element animate-fade-in">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="yoe-range" className="text-body font-semibold">
                      Target Experience Level
                    </Label>
                    <span className="font-mono text-body font-bold text-accent-500 bg-accent-500/5 px-2 py-0.5 rounded">
                      {yearsOfExp} Years
                    </span>
                  </div>
                  <input
                    id="yoe-range"
                    type="range"
                    min="3"
                    max="15"
                    value={yearsOfExp}
                    onChange={(e) => setYearsOfExp(parseInt(e.target.value, 10))}
                    className="w-full accent-accent-500 cursor-pointer"
                  />
                  <p className="text-caption text-muted-foreground">
                    Calibrates system design, architectural constraints, and leadership behaviors.
                  </p>
                </div>
              )}

              {/* Optional context parameters */}
              <div className="grid gap-element md:grid-cols-2">
                <div className="space-y-element">
                  <Label htmlFor="company-tier-select" className="text-body font-semibold">
                    Target Company Tier
                  </Label>
                  <select
                    id="company-tier-select"
                    value={targetCompanyTier}
                    onChange={(e) => setTargetCompanyTier(e.target.value)}
                    className="w-full rounded-button border border-border bg-surface px-element py-2 text-body focus:outline-none focus:ring-1 focus:ring-accent-500"
                  >
                    <option value="">General Tech / Open-Market</option>
                    <option value="faang">FAANG & Equivalent</option>
                    <option value="mid-tier">Mid-Tier Enterprise</option>
                    <option value="startup">Early-Stage / Fast Startup</option>
                  </select>
                </div>

                <div className="space-y-element">
                  <Label htmlFor="salary-input" className="text-body font-semibold">
                    Target Salary Range
                  </Label>
                  <input
                    id="salary-input"
                    type="text"
                    placeholder="e.g. $150k-$200k or 15-25 LPA"
                    value={targetSalaryRange}
                    onChange={(e) => setTargetSalaryRange(e.target.value)}
                    className="w-full rounded-button border border-border bg-surface px-element py-2 text-body focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Provider Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-heading">4. Engine Configuration</CardTitle>
              <CardDescription>
                Verify backend APIs for mock generation and audio capture.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-section">
              <div className="space-y-element">
                <Label htmlFor="llm-select" className="text-body font-semibold">
                  Active LLM Provider
                </Label>
                {activeProviders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-button border border-destructive/20 bg-destructive/5 p-card text-center gap-element">
                    <BadgeAlert className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="font-semibold text-destructive-foreground">No LLM providers configured</p>
                      <p className="text-caption text-muted-foreground mt-1 max-w-sm">
                        You need to configure and test an active provider (OpenAI, Anthropic, Groq, etc.) in settings.
                      </p>
                    </div>
                    <Button variant="outline" asChild className="border-destructive/30 hover:bg-destructive/10 text-destructive-foreground">
                      <Link href="/settings">Configure Provider</Link>
                    </Button>
                  </div>
                ) : (
                  <select
                    id="llm-select"
                    value={selectedLlm}
                    onChange={(e) => setSelectedLlm(e.target.value)}
                    className="w-full rounded-button border border-border bg-surface px-element py-2.5 text-body focus:outline-none focus:ring-1 focus:ring-accent-500"
                  >
                    {activeProviders.map((p) => (
                      <option key={p.provider} value={p.provider}>
                        {p.provider.toUpperCase()} {p.model ? `(${p.model})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* STT/TTS Providers */}
              <div className="grid gap-element md:grid-cols-2">
                <div className="space-y-element">
                  <Label htmlFor="stt-select" className="text-body font-semibold">
                    Speech-to-Text (STT)
                  </Label>
                  <select
                    id="stt-select"
                    value={sttProvider}
                    onChange={(e) => setSttProvider(e.target.value)}
                    className="w-full rounded-button border border-border bg-surface px-element py-2 text-body"
                  >
                    <option value="deepgram">Deepgram (Recommended)</option>
                    <option value="whisper">OpenAI Whisper</option>
                  </select>
                </div>

                <div className="space-y-element">
                  <Label htmlFor="tts-select" className="text-body font-semibold">
                    Text-to-Speech (TTS)
                  </Label>
                  <select
                    id="tts-select"
                    value={ttsProvider}
                    onChange={(e) => setTtsProvider(e.target.value)}
                    className="w-full rounded-button border border-border bg-surface px-element py-2 text-body"
                  >
                    <option value="openai">OpenAI TTS (Recommended)</option>
                    <option value="kokoro">Kokoro (Local Fallback)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & CTA */}
        <div className="sticky top-6 flex flex-col gap-element">
          <Card className="relative overflow-hidden border-border bg-surface">
            {submitting && (
              <div className="absolute inset-0 bg-background/85 z-50 flex flex-col items-center justify-center p-card text-center gap-card">
                <Loader2 className="h-10 w-10 animate-spin text-accent-500" />
                <div className="space-y-2">
                  <p className="font-semibold text-body text-foreground">Assembling Customization Engine</p>
                  <p className="text-caption text-muted-foreground animate-pulse">{submitStep}</p>
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
              <CardDescription>High-fidelity personalization preview.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-card">
              <div className="rounded-button border border-border bg-surface px-element py-3 space-y-2">
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">Round Focus</span>
                  <span className="font-semibold text-foreground text-right max-w-[200px] truncate">
                    {selectedRoundData?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">Difficulty Depth</span>
                  <span className="font-semibold text-foreground">
                    {DIFFICULTIES.find((d) => d.id === selectedDifficulty)?.label}
                    {selectedDifficulty === "experienced" ? ` (${yearsOfExp} YOE)` : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">Resume File</span>
                  <span className="font-semibold text-foreground text-right max-w-[200px] truncate">
                    {selectedResumeId ? resumes.find((r) => r.id === selectedResumeId)?.name : "None (Generic)"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">Role JD Benchmark</span>
                  <span className="font-semibold text-foreground text-right max-w-[200px] truncate">
                    {selectedJdId ? jds.find((j) => j.id === selectedJdId)?.name : "None (Generic)"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption border-b border-border pb-2">
                  <span className="text-muted-foreground font-medium">Target Company</span>
                  <span className="font-semibold text-foreground">
                    {targetCompanyTier === "faang"
                      ? "FAANG & Tier 1"
                      : targetCompanyTier === "mid-tier"
                      ? "Mid-Tier"
                      : targetCompanyTier === "startup"
                      ? "Startup Focus"
                      : "General Tech"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-caption">
                  <span className="text-muted-foreground font-medium">LLM Engine</span>
                  <span className="font-semibold text-foreground">
                    {selectedLlm ? selectedLlm.toUpperCase() : "None"}
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
                    Usually consists of {selectedRound === "dsa" ? "3 problems" : "6-8 structured questions"}.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-element">
              <Button onClick={handleStartInterview} className="w-full font-semibold shadow-glow" size="lg">
                Start Interview Session
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link href="/">Cancel</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
