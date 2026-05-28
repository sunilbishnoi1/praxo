"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Star,
  TrendingDown,
  Volume2,
  Lightbulb,
  Calendar,
  Clock,
  Target,
  Award,
  CheckCircle2,
  AlertTriangle,
  BookOpen
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/shared/ErrorState";

type AnswerType = {
  id: string;
  transcript: string;
  audioDurationMs: number | null;
  fluencyMetrics?: {
    wpm?: number;
    fillerWords?: string[];
    fillerWordCount?: number;
    pauseCount?: number;
    score?: number;
  } | null;
  scores?: {
    clarity?: number;
    delivery?: number;
    depth?: number;
    relevance?: number;
    coherence?: number;
    overall?: number;
    feedback?: string;
    dimensions?: {
      relevance?: number;
      depth?: number;
      technicalAccuracy?: number;
      starStructure?: number;
      timeComplexity?: number;
      coherence?: number;
      fluency?: number;
    } | null;
  } | null;
};

type QuestionType = {
  id: string;
  text: string;
  questionType: string;
  difficulty: string;
  orderIndex: number;
  expectedKeyPoints: string[];
  relatedSkills: string[];
  answer?: AnswerType | null;
  answered: boolean;
};

type StudyRecommendation = {
  topic: string;
  resources: string[];
  priority: "high" | "medium" | "low";
};

type ReportDetail = {
  id: string;
  sessionId: string;
  overallScore: number;
  roundTypeScore: number;
  dimensionAverages: {
    relevance?: number;
    depth?: number;
    technicalAccuracy?: number;
    starStructure?: number;
    timeComplexity?: number;
    coherence?: number;
    fluency?: number;
    [key: string]: number | undefined;
  };
  fluencySummary: {
    averageWpm?: number;
    totalFillerWords?: number;
    totalPauses?: number;
    wpmTrend?: string;
    fillerTrend?: string;
  };
  strongestAnswerIds: string[];
  weakestAnswerIds: string[];
  companyFitScore?: number | null;
  companyFitAnalysis?: string | null;
  overallSummary: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  studyRecommendations: StudyRecommendation[];
  nextSessionFocus?: string | null;
  createdAt: string;
  questions: QuestionType[];
  session: {
    id: string;
    roundType: string;
    difficulty: string;
    questionCount: number;
    totalDurationMs: number | null;
    resume?: { id: string; name: string } | null;
    jobDescription?: { id: string; name: string } | null;
  };
};

function parseInlineMarkdown(text: string): ReactNode[] {
  if (!text) return [];
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {token.slice(1, -1)}
        </strong>
      );
    }
    return token;
  });
}

function renderStructuredMarkdown(text: string): ReactNode {
  if (!text) return null;

  // Detect if there are contiguous inline numbered items like "1. " or "2. "
  const hasInlineNumbers = /(?:\b\d+\.\s+){2,}/.test(text) || (text.includes("1. ") && text.includes("2. "));

  if (hasInlineNumbers) {
    const parts = text.split(/(?=\b\d+\.\s)/);
    return (
      <div className="space-y-3">
        {parts.map((part, idx) => {
          const trimmed = part.trim();
          if (!trimmed) return null;

          const isListItem = /^\d+\.\s/.test(trimmed);

          if (isListItem) {
            return (
              <div key={idx} className="pl-4 border-l-2 border-brand-500/30 py-1">
                {parseInlineMarkdown(trimmed)}
              </div>
            );
          } else {
            return (
              <p key={idx} className="font-semibold text-foreground">
                {parseInlineMarkdown(trimmed)}
              </p>
            );
          }
        })}
      </div>
    );
  }

  const lines = text.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        return (
          <p key={idx} className="leading-relaxed">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function ReportDetailPage(): ReactElement {
  const { id } = useParams() as { id: string };

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport(): Promise<void> {
      try {
        const response = await fetch(`/api/reports/${id}`);
        const json = await response.json();
        if (json.success && json.data?.report) {
          setReport(json.data.report);
        } else {
          setError(json.error?.message || "Failed to locate interview feedback report.");
        }
      } catch (err) {
        console.error("Failed to load report:", err);
        setError("Network error loading feedback report details.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [id]);

  function formatRoundName(round: string): string {
    if (!round) return "";
    return round
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function formatDuration(ms: number | null): string {
    if (!ms) return "0m";
    const minutes = Math.floor(ms / 60000);
    return `${minutes}m`;
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-body text-muted-foreground animate-pulse font-medium">
          Compiling report analysis...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <ErrorState
        title="Report Not Found"
        message={error || "Could not retrieve the grading details."}
        action={
          <Button asChild className="bg-brand-500 hover:bg-brand-600 text-white font-semibold">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        }
      />
    );
  }

  const overallScore = report.overallScore || 80;
  
  // Grade classification
  let gradeLetter = "Grade B";
  let gradeColor = "text-amber-600";
  if (overallScore >= 90) {
    gradeLetter = "Grade A+";
    gradeColor = "text-emerald-500";
  } else if (overallScore >= 80) {
    gradeLetter = "Grade A";
    gradeColor = "text-[#006783]";
  } else if (overallScore >= 70) {
    gradeLetter = "Grade B+";
    gradeColor = "text-brand-700";
  }

  // Find Strongest and Weakest Questions based on report.strongestAnswerIds
  const answeredQuestions = report.questions.filter((q) => q.answer);
  
  const strongestQuestion = answeredQuestions.find((q) => report.strongestAnswerIds.includes(q.id)) ||
    answeredQuestions.reduce<QuestionType | null>((prev, current) => {
      if (!prev) return current;
      const prevScore = prev.answer?.scores?.overall || 0;
      const currScore = current.answer?.scores?.overall || 0;
      return currScore > prevScore ? current : prev;
    }, null);

  const weakestQuestion = answeredQuestions.find((q) => report.weakestAnswerIds.includes(q.id)) ||
    answeredQuestions.reduce<QuestionType | null>((prev, current) => {
      if (!prev) return current;
      const prevScore = prev.answer?.scores?.overall || 0;
      const currScore = current.answer?.scores?.overall || 0;
      return currScore < prevScore ? current : prev;
    }, null);

  const avgWpm = report.fluencySummary.averageWpm || 135;
  let pacingFeedback = "Optimal professional tempo.";
  if (avgWpm < 110) pacingFeedback = "Deliberate and highly controlled tempo.";
  else if (avgWpm > 160) pacingFeedback = "Vibrant, rapid tempo; consider pausing slightly more.";

  // SVG circular stroke calculation
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="flex flex-col gap-stack-lg flex-1">
      {/* Back Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
        <Button variant="ghost" size="sm" asChild className="hover:bg-muted font-semibold">
          <Link href="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Back to Reports
          </Link>
        </Button>
        
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase border-brand-500/30 bg-brand-500/5 text-brand-700">
            {formatRoundName(report.session.roundType)}
          </Badge>
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase border-border bg-card text-muted-foreground">
            {report.session.difficulty}
          </Badge>
        </div>
      </div>

      {/* Hero Score Section */}
      <section className="bg-card border border-border rounded-xl p-stack-lg flex flex-col md:flex-row items-center md:items-start justify-between relative overflow-hidden shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(167,58,0,0.06)_0%,_rgba(167,58,0,0)_60%)]"
        />
        <div className="flex-1 space-y-3 text-center md:text-left mb-6 md:mb-0 relative z-10">
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase bg-brand-500/10 text-brand-700">
            Completed Practice Run
          </Badge>
          <h1 className="font-display text-4xl font-bold text-foreground">Interview Feedback Report</h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-caption text-muted-foreground font-semibold mt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(report.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatDuration(report.session.totalDurationMs)} Duration
            </span>
            <span className="flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              Role: {report.session.jobDescription?.name || report.session.resume?.name || "Senior Software Engineer"}
            </span>
          </div>
        </div>

        {/* Circular Progress Bar (Wow element) */}
        <div className="flex flex-col items-center shrink-0 relative">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="absolute w-full h-full -rotate-90">
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-muted"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-brand-500 transition-all duration-1000 ease-out"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center z-10">
              <span className="font-display text-5xl font-bold text-brand-700 block leading-none">{overallScore}</span>
              <span className={`font-label-sm text-xs font-bold uppercase tracking-wider block mt-1.5 ${gradeColor}`}>
                {gradeLetter}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {/* Highlight 1: Strongest Answer */}
        <div className="bg-card border border-border rounded-xl p-stack-md flex flex-col justify-between hover:border-brand-500/20 transition-all duration-300">
          <div>
            <div className="flex items-center gap-2 mb-4 text-brand-700">
              <Star className="h-5 w-5 fill-current" />
              <h3 className="font-label-md text-label-md font-bold uppercase tracking-wider">Strongest Answer</h3>
            </div>
            <p className="font-body-md text-body-md font-bold text-foreground mb-2">
              {strongestQuestion ? `Question ${strongestQuestion.orderIndex + 1}` : "System Architecture"}
            </p>
            <p className="text-caption text-muted-foreground font-medium leading-relaxed">
              {strongestQuestion?.text 
                ? `"${strongestQuestion.text.slice(0, 80)}..."` 
                : "Demonstrated exceptional technical clarity and concrete design choices."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-brand-700 font-bold uppercase tracking-wider">
            <span>Score</span>
            <span>{strongestQuestion?.answer?.scores?.overall || 90}/100</span>
          </div>
        </div>

        {/* Highlight 2: Weakest Answer */}
        <div className="bg-card border border-border rounded-xl p-stack-md flex flex-col justify-between hover:border-border transition-all duration-300">
          <div>
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <TrendingDown className="h-5 w-5" />
              <h3 className="font-label-md text-label-md font-bold uppercase tracking-wider">Weakest Answer</h3>
            </div>
            <p className="font-body-md text-body-md font-bold text-foreground mb-2">
              {weakestQuestion ? `Question ${weakestQuestion.orderIndex + 1}` : "Behavioral STAR Model"}
            </p>
            <p className="text-caption text-muted-foreground font-medium leading-relaxed">
              {weakestQuestion?.text 
                ? `"${weakestQuestion.text.slice(0, 80)}..."` 
                : "Relied on general hypotheticals rather than specific anecdotes."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
            <span>Score</span>
            <span>{weakestQuestion?.answer?.scores?.overall || 60}/100</span>
          </div>
        </div>

        {/* Highlight 3: Fluency Summary */}
        <div className="bg-card border border-border rounded-xl p-stack-md flex flex-col justify-between hover:border-accent-500/20 transition-all duration-300 relative overflow-hidden">
          <div>
            <div className="flex items-center gap-2 mb-4 text-accent-600">
              <Volume2 className="h-5 w-5" />
              <h3 className="font-label-md text-label-md font-bold uppercase tracking-wider">Fluency Pace</h3>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="font-display text-4xl font-bold text-foreground">{Math.round(avgWpm)}</span>
              <span className="font-label-sm text-label-sm text-muted-foreground font-semibold">WPM</span>
            </div>
            <p className="text-caption text-muted-foreground font-medium leading-relaxed">
              Steady tempo with {report.fluencySummary.totalFillerWords || 0} filler words. {pacingFeedback}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
            <div className="h-full bg-accent-500" style={{ width: "85%" }}></div>
          </div>
        </div>
      </section>

      {/* Executive Summary Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter pt-2">
        {/* Left Side: 2 columns for Summary */}
        <Card className="lg:col-span-2 border-border bg-card shadow-sm flex flex-col justify-between">
          <CardHeader className="bg-muted/10 border-b border-border pb-4">
            <div className="flex items-center gap-2 text-brand-700">
              <Sparkles className="h-5 w-5" />
              <CardTitle className="font-display text-lg font-bold text-foreground">AI Executive Assessment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 flex-1">
            <div className="font-body-md text-body-md text-muted-foreground leading-relaxed">
              {report.overallSummary 
                ? renderStructuredMarkdown(report.overallSummary)
                : "Analyzing the session transcription content shows exceptional structural capabilities with concrete examples. Key design patterns were demonstrated clearly."
              }
            </div>
          </CardContent>
        </Card>

        {/* Right Side: 1 column for Strengths & Weaknesses */}
        <div className="flex flex-col gap-4">
          <Card className="border-border bg-card shadow-sm flex-1">
            <CardHeader className="bg-muted/10 border-b border-border py-3 px-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span className="font-label-md text-xs font-bold uppercase tracking-wider">Key Strengths</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <ul className="space-y-2 text-caption text-muted-foreground font-semibold">
                {report.keyStrengths && report.keyStrengths.length > 0 ? (
                  report.keyStrengths.map((s, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">•</span>
                      <span>{parseInlineMarkdown(s)}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">•</span>
                      <span>Clear communication and high technical vocabulary.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">•</span>
                      <span>Good indexing and scaling trade-off definitions.</span>
                    </li>
                  </>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm flex-1">
            <CardHeader className="bg-muted/10 border-b border-border py-3 px-4">
              <div className="flex items-center gap-2 text-brand-700">
                <AlertTriangle className="h-4.5 w-4.5" />
                <span className="font-label-md text-xs font-bold uppercase tracking-wider">Key Weaknesses</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <ul className="space-y-2 text-caption text-muted-foreground font-semibold">
                {report.keyWeaknesses && report.keyWeaknesses.length > 0 ? (
                  report.keyWeaknesses.map((w, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-brand-500 font-bold mt-0.5">•</span>
                      <span>{parseInlineMarkdown(w)}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-500 font-bold mt-0.5">•</span>
                      <span>Relied on generalizations instead of concrete numbers.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-500 font-bold mt-0.5">•</span>
                      <span>Conflict resolution lacked a proper structured path.</span>
                    </li>
                  </>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Company Fit Analysis (Wow bento block) */}
      {report.companyFitScore !== null && report.companyFitScore !== undefined && (
        <section className="bg-card border-l-4 border-l-[#006783] border border-border rounded-xl p-stack-md flex flex-col md:flex-row gap-6 items-center md:items-start justify-between relative shadow-sm">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 text-[#006783]">
              <Target className="h-5 w-5" />
              <h3 className="font-display text-lg font-bold">Company-Fit Calibrator</h3>
            </div>
            <p className="text-caption text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap">
              {report.companyFitAnalysis || "The candidate's core technology choices align perfectly with the target stack outlined in the Job Description, demonstrating solid production experience."}
            </p>
          </div>
          <div className="shrink-0 text-center bg-[#006783]/5 border border-[#006783]/20 px-6 py-4 rounded-lg flex flex-col justify-center min-w-[140px]">
            <span className="font-display text-3xl font-bold text-[#006783]">{report.companyFitScore}%</span>
            <span className="font-label-sm text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Role Match</span>
          </div>
        </section>
      )}

      {/* Prep & Prep Section */}
      {(() => {
        const sortedRecommendations = report.studyRecommendations
          ? [...report.studyRecommendations].sort((a, b) => {
              const order = { high: 1, medium: 2, low: 3 };
              const pA = order[a.priority as keyof typeof order] || 4;
              const pB = order[b.priority as keyof typeof order] || 4;
              return pA - pB;
            })
          : [];

        return (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-gutter pt-2">
            {/* Next Focus */}
            <Card className="border-border bg-card shadow-sm flex flex-col h-full">
              <CardHeader className="bg-muted/10 border-b border-border pb-4 shrink-0">
                <div className="flex items-center gap-2 text-brand-700">
                  <Award className="h-5 w-5" />
                  <CardTitle className="font-display text-lg font-bold text-foreground">Next Session Focus</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 flex-1">
                <div className="text-caption text-muted-foreground leading-relaxed font-semibold">
                  {report.nextSessionFocus 
                    ? renderStructuredMarkdown(report.nextSessionFocus)
                    : "Develop concrete metric storytelling skills. Practice framing behavioral narratives using quantitative results (e.g. latency reduced by X%, team velocity increased by Y%)."
                  }
                </div>
              </CardContent>
            </Card>

            {/* Study Prep Recommendations */}
            <Card className="border-border bg-card shadow-sm flex flex-col h-full">
              <CardHeader className="bg-muted/10 border-b border-border pb-4 shrink-0">
                <div className="flex items-center gap-2 text-[#006783]">
                  <BookOpen className="h-5 w-5" />
                  <CardTitle className="font-display text-lg font-bold text-foreground">Recommended Study & Prep Plan</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 flex-1">
                {sortedRecommendations && sortedRecommendations.length > 0 ? (
                  <div className="space-y-4">
                    {sortedRecommendations.map((rec, idx) => {
                      const badgeColors = 
                        rec.priority === "high" 
                          ? "bg-red-500/10 text-red-600 border-red-500/20"
                          : rec.priority === "medium"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : "bg-muted text-muted-foreground border-border";

                      return (
                        <div key={idx} className="border border-border p-4 rounded-lg bg-muted/5 flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="muted" className={`font-bold text-[9px] tracking-wider uppercase px-2 whitespace-nowrap shrink-0 ${badgeColors}`}>
                              {rec.priority} Priority
                            </Badge>
                            <h4 className="font-body-md text-sm font-bold text-foreground leading-snug">{rec.topic}</h4>
                          </div>
                          
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground font-semibold">Recommended material & resources:</p>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {rec.resources && rec.resources.map((res, rIdx) => (
                                <span 
                                  key={rIdx}
                                  className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-card border border-border text-[#006783] break-words max-w-full"
                                >
                                  {res}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-border p-4 rounded-lg bg-muted/5 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted" className="font-bold text-[9px] tracking-wider uppercase px-2 whitespace-nowrap shrink-0 bg-red-500/10 text-red-600 border-red-500/20">
                        high Priority
                      </Badge>
                      <h4 className="font-body-md text-sm font-bold text-foreground leading-snug">STAR Behavioral Framework</h4>
                    </div>
                    
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-semibold">Structured behavioral answers with clear situational context.</p>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-card border border-border text-[#006783]">
                          STAR guide
                        </span>
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-card border border-border text-[#006783]">
                          Template
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        );
      })()}

      {/* Per-Question Breakdown */}
      <section className="space-y-stack-md pt-4">
        <h2 className="font-display text-2xl font-bold text-foreground border-b border-border pb-2">Question Breakdown</h2>
        {answeredQuestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-caption text-muted-foreground font-medium">
            This session ended before any questions were answered. Try another session.
          </div>
        ) : (
          answeredQuestions.map((q) => {
            const index = q.orderIndex + 1;
            const qClarity = q.answer?.scores?.dimensions?.coherence
              ? Math.round(q.answer.scores.dimensions.coherence / 10)
              : q.answer?.scores?.clarity || 8;
            const qDelivery = q.answer?.scores?.dimensions?.fluency
              ? Math.round(q.answer.scores.dimensions.fluency / 10)
              : q.answer?.scores?.delivery || 8;
            
            return (
              <div key={q.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {/* Question Info Header */}
                <div className="p-stack-md bg-muted/10 border-b border-[#E5E5E3] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="font-label-sm text-label-sm text-brand-700 font-bold uppercase tracking-wider mb-1 block">
                      Question {index} • {formatRoundName(q.questionType)}
                    </span>
                    <h3 className="font-body-md text-body-md font-bold text-on-surface leading-snug">
                      &ldquo;{q.text}&rdquo;
                    </h3>
                  </div>
                  <div className="flex gap-4 shrink-0 font-bold">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Clarity</div>
                      <div className="font-display text-md text-[#006783] bg-[#006783]/10 px-2 py-0.5 rounded-full mt-0.5">
                        {qClarity}/10
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Delivery</div>
                      <div className="font-display text-md text-[#a73a00] bg-[#a73a00]/10 px-2 py-0.5 rounded-full mt-0.5">
                        {qDelivery}/10
                      </div>
                    </div>
                  </div>
                </div>

                {/* Excerpt vs Ideal split */}
                <div className="p-stack-md grid grid-cols-1 lg:grid-cols-2 gap-stack-md">
                  <div className="space-y-2">
                    <h4 className="font-label-sm text-label-sm text-muted-foreground/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 className="h-4 w-4" />
                      Recorded Transcript Excerpt
                    </h4>
                    <p className="text-caption text-foreground bg-surface-container-low border border-border p-4 rounded-lg italic font-medium leading-relaxed">
                      &ldquo;{q.answer?.transcript || "[Blank/Unrecognized response]"}&rdquo;
                    </p>
                  </div>
                  
                  <div className="bg-[#a73a00]/5 border border-[#a73a00]/20 rounded-lg p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-label-sm text-label-sm text-brand-700 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Lightbulb className="h-4 w-4" />
                        AI Analysis & Ideal Structure
                      </h4>
                      <div className="text-caption text-muted-foreground font-medium leading-relaxed">
                        {q.answer?.scores?.feedback 
                          ? renderStructuredMarkdown(q.answer.scores.feedback)
                          : `Excellent attempt at answering this ${q.questionType} question. Clear focus was shown on the core concepts.`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
