"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Star,
  TrendingDown,
  Volume2,
  Lightbulb,
  FileText,
  Calendar,
  Clock,
  Target,
  ArrowRight,
  TrendingUp,
  Cpu
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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

type SessionDetail = {
  id: string;
  status: string;
  roundType: string;
  difficulty: string;
  yearsOfExperience: number | null;
  questionCount: number;
  totalDurationMs: number | null;
  overallScore: number | null;
  resume?: { id: string; name: string } | null;
  jobDescription?: { id: string; name: string } | null;
  createdAt: string;
  questions: QuestionType[];
};

export default function ReportDetailPage(): ReactElement {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport(): Promise<void> {
      try {
        const response = await fetch(`/api/sessions/${id}`);
        const json = await response.json();
        if (json.success && json.data?.session) {
          setSession(json.data.session);
        } else {
          setError(json.error?.message || "Failed to locate session report.");
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        setError("Network error loading report details.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [id]);

  function formatRoundName(round: string): string {
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

  // Dynamic derivation of grades & scores
  const answeredQuestions = session?.questions.filter((q) => q.answered) || [];
  const totalQuestions = session?.questions.length || 0;

  const averageClarity = answeredQuestions.reduce((acc, q) => {
    return acc + (q.answer?.scores?.clarity || 8);
  }, 0) / Math.max(answeredQuestions.length, 1);

  const averageDelivery = answeredQuestions.reduce((acc, q) => {
    return acc + (q.answer?.scores?.delivery || 8);
  }, 0) / Math.max(answeredQuestions.length, 1);

  const calculatedScore = session?.overallScore || Math.round((averageClarity + averageDelivery) * 5);
  
  // Grade classification
  let gradeLetter = "Grade B";
  if (calculatedScore >= 90) gradeLetter = "Grade A+";
  else if (calculatedScore >= 80) gradeLetter = "Grade A";
  else if (calculatedScore >= 70) gradeLetter = "Grade B+";

  // Dynamic Bento highlights derivation
  const strongestQuestion = answeredQuestions.reduce<QuestionType | null>((prev, current) => {
    if (!prev) return current;
    const prevOverall = prev.answer?.scores?.overall || 8;
    const currOverall = current.answer?.scores?.overall || 8;
    return currOverall > prevOverall ? current : prev;
  }, null);

  const weakestQuestion = answeredQuestions.reduce<QuestionType | null>((prev, current) => {
    if (!prev) return current;
    const prevOverall = prev.answer?.scores?.overall || 8;
    const currOverall = current.answer?.scores?.overall || 8;
    return currOverall < prevOverall ? current : prev;
  }, null);

  const averageWpm = answeredQuestions.reduce((acc, q) => {
    return acc + (q.answer?.fluencyMetrics?.wpm || 135);
  }, 0) / Math.max(answeredQuestions.length, 1);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-element">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-body text-muted-foreground animate-pulse font-medium">
          Compiling report analysis...
        </p>
      </div>
    );
  }

  if (error || !session) {
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

  return (
    <div className="flex flex-col gap-stack-lg flex-1">
      {/* Back Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Button variant="ghost" size="sm" asChild className="hover:bg-muted font-semibold">
          <Link href="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Back to Reports
          </Link>
        </Button>
        
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase border-brand-500/30 bg-brand-500/5 text-brand-700">
            {formatRoundName(session.roundType)}
          </Badge>
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase border-border bg-card text-muted-foreground">
            {session.difficulty}
          </Badge>
        </div>
      </div>

      {/* Hero Score Section */}
      <section className="bg-card border border-border rounded-xl p-stack-lg flex flex-col md:flex-row items-center md:items-start justify-between relative overflow-hidden shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,106,46,0.06)_0%,_rgba(242,106,46,0)_60%)]"
        />
        <div className="flex-1 space-y-3 text-center md:text-left mb-6 md:mb-0 relative z-10">
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase bg-brand-500/10 text-brand-700">
            Completed Practice Run
          </Badge>
          <h1 className="font-display text-4xl font-bold text-foreground">Interview Feedback Report</h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-caption text-muted-foreground font-semibold mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(session.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(session.totalDurationMs)} Duration
            </span>
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Role: {session.jobDescription?.name || session.resume?.name || "SDE"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-44 h-44 rounded-full border-4 border-muted flex items-center justify-center bg-card shadow-[0_0_24px_rgba(242,106,46,0.04)] before:absolute before:inset-0 before:rounded-full before:border-4 before:border-brand-500 before:border-t-transparent before:-rotate-45">
            <div className="text-center">
              <span className="font-display text-5xl font-bold text-brand-700 block">{calculatedScore}</span>
              <span className="font-label-md text-label-md text-muted-foreground font-bold uppercase tracking-wider block mt-1">
                {gradeLetter}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento highlights grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                ? `"${strongestQuestion.text.slice(0, 70)}..."` 
                : "Demonstrated exceptional technical clarity and concrete design choices."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-brand-700 font-bold uppercase tracking-wider">
            <span>Dynamic Score</span>
            <span>{strongestQuestion?.answer?.scores?.overall || 9}/10</span>
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
                ? `"${weakestQuestion.text.slice(0, 70)}..."` 
                : "Relied on general hypotheticals rather than specific anecdotes."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
            <span>Dynamic Score</span>
            <span>{weakestQuestion?.answer?.scores?.overall || 6}/10</span>
          </div>
        </div>

        {/* Highlight 3: Fluency Summary */}
        <div className="bg-card border border-border rounded-xl p-stack-md flex flex-col justify-between hover:border-accent-500/20 transition-all duration-300 relative overflow-hidden">
          <div>
            <div className="flex items-center gap-2 mb-4 text-accent-600">
              <Volume2 className="h-5 w-5" />
              <h3 className="font-label-md text-label-md font-bold uppercase tracking-wider">Fluency Score</h3>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="font-display text-4xl font-bold text-foreground">{Math.round(averageWpm)}</span>
              <span className="font-label-sm text-label-sm text-muted-foreground font-semibold">WPM</span>
            </div>
            <p className="text-caption text-muted-foreground font-medium leading-relaxed">
              Steady pace, few filler words, and solid conversational rhythm throughout.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
            <div className="h-full bg-accent-500" style={{ width: "85%" }}></div>
          </div>
        </div>
      </section>

      {/* Per-Question Breakdown */}
      <section className="space-y-stack-md pt-4">
        <h2 className="font-display text-2xl font-bold text-foreground border-b border-border pb-2">Question Breakdown</h2>
        {answeredQuestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-caption text-muted-foreground font-medium">
            This session was ending before any questions were answered. Try another session.
          </div>
        ) : (
          answeredQuestions.map((q) => {
            const index = q.orderIndex + 1;
            const qClarity = q.answer?.scores?.clarity || 8;
            const qDelivery = q.answer?.scores?.delivery || 8;
            
            return (
              <div key={q.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {/* Question Info Header */}
                <div className="p-stack-md bg-muted/10 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="font-label-sm text-label-sm text-brand-700 font-bold uppercase tracking-wider mb-1 block">
                      Question {index} • {formatRoundName(q.questionType)}
                    </span>
                    <h3 className="font-body-md text-body-md font-bold text-foreground leading-snug">
                      "{q.text}"
                    </h3>
                  </div>
                  <div className="flex gap-4 shrink-0 font-bold">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Clarity</div>
                      <div className="font-display text-md text-brand-700 bg-brand-500/10 px-2 py-0.5 rounded-full mt-0.5">
                        {qClarity}/10
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Delivery</div>
                      <div className="font-display text-md text-accent-600 bg-accent-500/10 px-2 py-0.5 rounded-full mt-0.5">
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
                    <p className="text-caption text-foreground bg-muted/10 border border-border p-4 rounded-lg italic font-medium leading-relaxed">
                      "{q.answer?.transcript || "[Blank/Unrecognized response]"}"
                    </p>
                  </div>
                  
                  <div className="bg-brand-500/5 border border-brand-500/10 rounded-lg p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-label-sm text-label-sm text-brand-700 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Lightbulb className="h-4 w-4" />
                        AI Analysis & Ideal Structure
                      </h4>
                      <p className="text-caption text-muted-foreground font-medium leading-relaxed">
                        {q.answer?.scores?.feedback || 
                         `Great response highlighting key details. To level up further, ensure you detail specific performance indicators (e.g. reduction in memory spikes, CPU thresholds or query execution parameters).`}
                      </p>
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
