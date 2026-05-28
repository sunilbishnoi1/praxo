"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ChevronRight,
  FileText,
  Cpu,
  HeartHandshake,
  Network,
  Binary,
  MessageSquare,
  Info,
  ArrowUpRight,
  ArrowDownRight
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
import { Loader2 } from "lucide-react";

type TrendItem = {
  sessionId: string;
  sessionDate: string;
  roundType: string;
  difficulty: string;
  overallScore: number;
  fluencyScore: number;
  relevanceScore: number;
  depthScore: number;
  technicalScore: number;
  coherenceScore: number;
  averageWpm: number;
  fillerWordCount: number;
  pauseCount: number;
  questionCount: number;
  durationMs: number;
};

type ProgressData = {
  averageScore: number;
  growthPercentage: number;
  fillerWordChangePercentage: number;
  readinessLevel: "High" | "Medium" | "Low";
  totalSessions: number;
  totalDurationMs: number;
  averageWpm: number;
  averageFillerWordRate: number;
  domainReadiness: {
    systemDesign: number;
    behavioural: number;
    dsa: number;
    oop: number;
    technicalResume: number;
  };
  deliveryCoachAdvice: string;
  trend: TrendItem[];
};

export default function PerformancePage(): ReactElement {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  useEffect(() => {
    async function loadProgress(): Promise<void> {
      try {
        const response = await fetch("/api/progress");
        const json = await response.json();
        if (json.success && json.data && json.data.totalSessions > 0) {
          setData(json.data);
          setIsDemoMode(false);
        } else {
          // If no sessions exist yet, activate demo fallback mode for visual excellence
          setIsDemoMode(true);
          setData({
            averageScore: 85,
            growthPercentage: 14,
            fillerWordChangePercentage: -3.2,
            readinessLevel: "High",
            totalSessions: 4,
            totalDurationMs: 7200000,
            averageWpm: 138,
            averageFillerWordRate: 2.4,
            domainReadiness: {
              systemDesign: 92,
              behavioural: 85,
              dsa: 78,
              oop: 88,
              technicalResume: 82,
            },
            deliveryCoachAdvice: "Steady tempo! Your average pace is within the ideal range. To level up further, add brief deliberate 2-second pauses before complex technical design transitions.",
            trend: [
              { sessionId: "1", sessionDate: "2026-05-01T12:00:00Z", roundType: "technical-resume", difficulty: "junior", overallScore: 72, fluencyScore: 75, relevanceScore: 70, depthScore: 68, technicalScore: 71, coherenceScore: 73, averageWpm: 120, fillerWordCount: 8, pauseCount: 5, questionCount: 5, durationMs: 1200000 },
              { sessionId: "2", sessionDate: "2026-05-05T14:30:00Z", roundType: "oop-cs", difficulty: "mid", overallScore: 78, fluencyScore: 80, relevanceScore: 77, depthScore: 75, technicalScore: 79, coherenceScore: 80, averageWpm: 130, fillerWordCount: 6, pauseCount: 4, questionCount: 5, durationMs: 1500000 },
              { sessionId: "3", sessionDate: "2026-05-10T10:15:00Z", roundType: "dsa", difficulty: "mid", overallScore: 81, fluencyScore: 82, relevanceScore: 80, depthScore: 79, technicalScore: 82, coherenceScore: 82, averageWpm: 135, fillerWordCount: 5, pauseCount: 3, questionCount: 5, durationMs: 1800000 },
              { sessionId: "4", sessionDate: "2026-05-15T16:45:00Z", roundType: "system-design", difficulty: "senior", overallScore: 88, fluencyScore: 90, relevanceScore: 87, depthScore: 86, technicalScore: 89, coherenceScore: 88, averageWpm: 138, fillerWordCount: 4, pauseCount: 2, questionCount: 5, durationMs: 2700000 }
            ]
          });
        }
      } catch (err) {
        console.error("Failed to load progress analytics:", err);
        setIsDemoMode(true);
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-body text-muted-foreground animate-pulse font-medium">
          Compiling performance trends...
        </p>
      </div>
    );
  }

  const analytics = data!;
  const graphSessions = analytics.trend;

  // Dynamic Y-axis scale calculation
  const yMax = 100;
  const rawMin = graphSessions.length > 0 ? Math.min(...graphSessions.map((s) => s.overallScore)) : 50;
  // If the lowest score is below 55, dynamically lower the floor to a nice rounded buffer, e.g. 42% -> 30%
  const yMin = rawMin < 55 ? Math.max(0, Math.floor((rawMin - 10) / 10) * 10) : 50;

  // Generate 5 grid ticks beautifully spaced between yMax and yMin
  const gridTicks: number[] = [];
  const tickCount = 5;
  for (let i = 0; i < tickCount; i++) {
    const val = yMax - (i * (yMax - yMin)) / (tickCount - 1);
    gridTicks.push(Math.round(val));
  }

  // SVG Line coordinates computation
  const svgWidth = 1000;
  const svgHeight = 200;
  const paddingX = 80;
  const paddingY = 30;

  const points = graphSessions.map((s, index) => {
    const x = paddingX + (index * (svgWidth - 2 * paddingX)) / Math.max(graphSessions.length - 1, 1);
    const score = s.overallScore;
    const y = svgHeight - paddingY - ((score - yMin) * (svgHeight - 2 * paddingY)) / (yMax - yMin);
    return { x, y, score, ...s };
  });

  const pathD = points.reduce((acc, p, index) => {
    if (index === 0) return `M ${p.x} ${p.y}`;
    const prev = points[index - 1];
    const cpX1 = prev.x + (p.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (p.x - prev.x) / 2;
    const cpY2 = p.y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
  }, "");

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : "";

  return (
    <div className="flex flex-col gap-stack-lg flex-1">
      {/* Demo Banner */}
      {isDemoMode && (
        <div className="bg-[#006783]/10 border border-[#006783]/20 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#006783]/10 text-[#006783] flex items-center justify-center shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#006783]">Viewing Demo Analytics Mode</p>
              <p className="text-xs text-muted-foreground font-semibold">
                You haven&apos;t completed any interviews yet. Complete your first practice run to track real-time longitudinal growth!
              </p>
            </div>
          </div>
          <Button asChild className="bg-brand-500 hover:bg-brand-600 text-white font-semibold self-stretch sm:self-center">
            <Link href="/session/new" className="flex items-center gap-1.5">
              Start Practice Session
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-end border-b border-border pb-stack-md shrink-0">
        <div className="flex flex-col gap-1">
          <p className="font-label-sm text-label-sm text-muted-foreground/80 uppercase tracking-wider">Analytics</p>
          <h2 className="font-display text-4xl font-bold text-foreground">Performance Analytics</h2>
        </div>
      </header>

      {/* Dynamic Master Trend Chart */}
      <Card className="border-border bg-card shadow-sm overflow-hidden relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,103,131,0.04)_0%,_rgba(0,103,131,0)_60%)]"
        />
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-4 bg-muted/10 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#006783]/10 flex items-center justify-center text-[#006783]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-display text-lg font-bold text-foreground">Composite Score Trend</CardTitle>
              <CardDescription className="text-muted-foreground">Longitudinal grading progression over time</CardDescription>
            </div>
          </div>
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase border-[#006783]/30 bg-[#006783]/5 text-[#006783]">
            Last {graphSessions.length} Sessions
          </Badge>
        </CardHeader>
        
        <CardContent className="pt-8 space-y-6">
          {/* Chart Frame */}
          <div className="h-56 w-full relative select-none">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-muted-foreground/45 font-bold">
              {gridTicks.map((tick, i) => {
                const isLast = i === gridTicks.length - 1;
                return (
                  <div
                    key={i}
                    className={`${
                      isLast ? "border-b" : "border-t"
                    } border-border/60 w-full h-0 flex justify-end ${
                      isLast ? "pb-1" : "pt-1"
                    }`}
                  >
                    {tick}
                  </div>
                );
              })}
            </div>

            {/* Line SVG (animated & premium) */}
            {points.length > 0 && (
              <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="scoreAreaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0, 103, 131, 0.2)" />
                    <stop offset="100%" stopColor="rgba(0, 103, 131, 0)" />
                  </linearGradient>
                </defs>
                
                {areaD && <path d={areaD} fill="url(#scoreAreaGradient)" />}
                
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#006783"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {points.map((p, i) => (
                  <g key={p.sessionId || i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="6"
                      fill="#FFFFFF"
                      stroke="#006783"
                      strokeWidth="3.5"
                      className="transition-all hover:r-8 cursor-pointer"
                    />
                    <text
                      x={p.x}
                      y={p.y - 12}
                      textAnchor="middle"
                      className="font-mono text-[11px] font-bold fill-foreground"
                    >
                      {p.score}%
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>

          {/* Current Score Metrics row */}
          <div className="pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="font-label-sm text-label-sm text-muted-foreground uppercase tracking-wider">Current Avg</p>
              <p className="font-display text-4xl font-bold text-foreground mt-1">
                {analytics.averageScore}
                <span className="text-xs text-muted-foreground font-semibold">/100</span>
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-muted-foreground uppercase tracking-wider">Growth</p>
              <p className={`font-display text-4xl font-bold mt-1 flex items-center gap-1 ${
                analytics.growthPercentage >= 0 ? "text-emerald-500" : "text-brand-700"
              }`}>
                {analytics.growthPercentage >= 0 ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
                {analytics.growthPercentage >= 0 ? "+" : ""}{analytics.growthPercentage}%
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-muted-foreground uppercase tracking-wider">Filler words</p>
              <p className={`font-display text-4xl font-bold mt-1 ${
                analytics.fillerWordChangePercentage <= 0 ? "text-emerald-500" : "text-brand-700"
              }`}>
                {analytics.fillerWordChangePercentage > 0 ? "+" : ""}{analytics.fillerWordChangePercentage}%
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-muted-foreground uppercase tracking-wider">Readiness</p>
              <p className="font-display text-4xl font-bold text-[#006783] mt-1">
                {analytics.readinessLevel}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bento Grid layout */}
      <div className="grid gap-stack-md lg:grid-cols-2">
        {/* Domain readiness chart bars */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border pb-4 bg-muted/10">
            <CardTitle className="font-display text-lg font-bold text-foreground">Domain Competencies</CardTitle>
            <CardDescription className="text-muted-foreground">Calibrated scoring aggregates across round formats</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {/* Technical Resume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 text-[#006783]" />
                  Technical Experience & Resume
                </span>
                <span className="text-[#006783] font-bold">{analytics.domainReadiness.technicalResume}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[#006783] rounded-full" style={{ width: `${analytics.domainReadiness.technicalResume}%` }}></div>
              </div>
            </div>
            {/* Tech */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <Network className="h-4 w-4 text-brand-500" />
                  System Design & Architecture
                </span>
                <span className="text-brand-700 font-bold">{analytics.domainReadiness.systemDesign}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${analytics.domainReadiness.systemDesign}%` }}></div>
              </div>
            </div>

            {/* Behavioral */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <HeartHandshake className="h-4 w-4 text-rose-500" />
                  Behavioral STAR stories
                </span>
                <span className="text-rose-500 font-bold">{analytics.domainReadiness.behavioural}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${analytics.domainReadiness.behavioural}%` }}></div>
              </div>
            </div>

            {/* DSA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <Binary className="h-4 w-4 text-accent-600" />
                  Algorithms & Complexity (DSA)
                </span>
                <span className="text-accent-600 font-bold">{analytics.domainReadiness.dsa}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent-500 rounded-full" style={{ width: `${analytics.domainReadiness.dsa}%` }}></div>
              </div>
            </div>

            {/* OOP */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <Cpu className="h-4 w-4 text-teal-500" />
                  OOP & CS Foundations
                </span>
                <span className="text-teal-500 font-bold">{analytics.domainReadiness.oop}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${analytics.domainReadiness.oop}%` }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Communication analytics details */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border pb-4 bg-muted/10">
            <CardTitle className="font-display text-lg font-bold text-foreground">Communication Delivery</CardTitle>
            <CardDescription className="text-muted-foreground">Conversational clarity, filler word frequency, and verbal pacing</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border p-4 rounded-lg bg-muted/5 flex flex-col justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Avg Verbal Pace</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-display text-3xl font-bold text-foreground">{analytics.averageWpm}</span>
                  <span className="text-[10px] text-muted-foreground font-bold font-mono">WPM</span>
                </div>
                <Badge variant="muted" className="mt-3 text-[9px] font-bold text-emerald-500 border-emerald-500/20 bg-emerald-500/5 uppercase self-start">
                  Fluent Pace
                </Badge>
              </div>

              <div className="border border-border p-4 rounded-lg bg-muted/5 flex flex-col justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Filler Word Rate</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-display text-3xl font-bold text-foreground">{analytics.averageFillerWordRate}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">%</span>
                </div>
                <Badge variant="muted" className="mt-3 text-[9px] font-bold text-brand-700 border-brand-500/20 bg-brand-500/5 uppercase self-start">
                  {analytics.averageFillerWordRate <= 3.0 ? "Minimal fillers" : "Average fillers"}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 bg-muted/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-700 shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-caption text-foreground">Delivery Coach Advice</p>
                  <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed mt-0.5 whitespace-pre-line">
                    {analytics.deliveryCoachAdvice}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
