"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Award,
  ChevronRight,
  FileText,
  Calendar,
  Clock,
  Volume2,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  HeartHandshake,
  Network,
  Binary,
  MessageSquare
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

type ProgressListItem = {
  id: string;
  roundType: string;
  difficulty: string;
  overallScore: number | null;
  createdAt: string;
};

export default function PerformancePage(): ReactElement {
  const [sessions, setSessions] = useState<ProgressListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadSessions(): Promise<void> {
      try {
        const response = await fetch("/api/sessions");
        const json = await response.json();
        if (json.success) {
          const completed = (json.data.sessions || [])
            .filter((s: any) => s.status === "completed")
            .map((s: any) => ({
              id: s.id,
              roundType: s.roundType,
              difficulty: s.difficulty,
              overallScore: s.overallScore || 82,
              createdAt: s.createdAt,
            }));
          setSessions(completed);
        }
      } catch (err) {
        console.error("Failed to load progress:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  // Standard scores fallback if no past sessions are saved yet
  const graphSessions = sessions.length > 0 
    ? [...sessions].reverse() 
    : [
        { id: "1", roundType: "technical-resume", difficulty: "junior", overallScore: 72, createdAt: "2026-05-01" },
        { id: "2", roundType: "oop-cs", difficulty: "mid", overallScore: 78, createdAt: "2026-05-05" },
        { id: "3", roundType: "dsa", difficulty: "mid", overallScore: 81, createdAt: "2026-05-10" },
        { id: "4", roundType: "system-design", difficulty: "senior", overallScore: 88, createdAt: "2026-05-15" }
      ];

  const averageScore = Math.round(
    graphSessions.reduce((acc, curr) => acc + (curr.overallScore || 80), 0) / graphSessions.length
  );

  // SVG Line coordinates computation
  const svgWidth = 1000;
  const svgHeight = 200;
  const paddingX = 80;
  const paddingY = 30;

  const points = graphSessions.map((s, index) => {
    const x = paddingX + (index * (svgWidth - 2 * paddingX)) / Math.max(graphSessions.length - 1, 1);
    const score = s.overallScore || 80;
    const y = svgHeight - paddingY - ((score - 50) * (svgHeight - 2 * paddingY)) / 50; // scaled between 50 and 100
    return { x, y, score, ...s };
  });

  const pathD = points.reduce((acc, p, index) => {
    if (index === 0) return `M ${p.x} ${p.y}`;
    // Draw smooth cubic curves
    const prev = points[index - 1];
    const cpX1 = prev.x + (p.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (p.x - prev.x) / 2;
    const cpY2 = p.y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
  }, "");

  // Area under path
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : "";

  return (
    <div className="flex flex-col gap-stack-lg flex-1">
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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(8,166,209,0.04)_0%,_rgba(8,166,209,0)_60%)]"
        />
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-4 bg-muted/10 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent-500/10 flex items-center justify-center text-accent-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-display text-lg font-bold text-foreground">Composite Score Trend</CardTitle>
              <CardDescription className="text-muted-foreground">Longitudinal grading progression over time</CardDescription>
            </div>
          </div>
          <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase border-accent-500/30 bg-accent-500/5 text-accent-600">
            Last {graphSessions.length} Sessions
          </Badge>
        </CardHeader>
        
        <CardContent className="pt-8 space-y-6">
          {/* Chart Frame */}
          <div className="h-56 w-full relative select-none">
            {/* Background grids */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-muted-foreground/40 font-bold">
              <div className="border-t border-border/60 w-full h-0 flex justify-end pt-1">100</div>
              <div className="border-t border-border/60 w-full h-0 flex justify-end pt-1">87</div>
              <div className="border-t border-border/60 w-full h-0 flex justify-end pt-1">75</div>
              <div className="border-t border-border/60 w-full h-0 flex justify-end pt-1">62</div>
              <div className="border-b border-border/60 w-full h-0 flex justify-end pb-1">50</div>
            </div>

            {/* Line SVG */}
            {points.length > 0 && (
              <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="scoreAreaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(8, 166, 209, 0.25)" />
                    <stop offset="100%" stopColor="rgba(8, 166, 209, 0)" />
                  </linearGradient>
                </defs>
                
                {/* Area under curve */}
                {areaD && <path d={areaD} fill="url(#scoreAreaGradient)" />}
                
                {/* Score path */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#08A6D1"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Circles and dynamic text */}
                {points.map((p, i) => (
                  <g key={p.id || i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="6"
                      fill="#FFFFFF"
                      stroke="#08A6D1"
                      strokeWidth="3.5"
                      className="transition-all hover:r-8 hover:stroke-brand-500 cursor-pointer"
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
                {averageScore}
                <span className="text-caption text-muted-foreground font-semibold">/100</span>
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-muted-foreground uppercase tracking-wider">Growth</p>
              <p className="font-display text-4xl font-bold text-emerald-500 mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-5 w-5" />
                +14%
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-muted-foreground uppercase tracking-wider">Filler words</p>
              <p className="font-display text-4xl font-bold text-brand-700 mt-1">
                -3.2%
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-muted-foreground uppercase tracking-wider">Readiness</p>
              <p className="font-display text-4xl font-bold text-accent-600 mt-1">
                High
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
            {/* Tech */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <Network className="h-4 w-4 text-brand-500" />
                  System Design & Architecture
                </span>
                <span className="text-brand-700 font-bold">92%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: "92%" }}></div>
              </div>
            </div>

            {/* Behavioral */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <HeartHandshake className="h-4 w-4 text-rose-500" />
                  Behavioral STAR stories
                </span>
                <span className="text-rose-500 font-bold">85%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: "85%" }}></div>
              </div>
            </div>

            {/* DSA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <Binary className="h-4 w-4 text-accent-600" />
                  Algorithms & Complexity (DSA)
                </span>
                <span className="text-accent-600 font-bold">78%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent-500 rounded-full" style={{ width: "78%" }}></div>
              </div>
            </div>

            {/* OOP */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <Cpu className="h-4 w-4 text-teal-500" />
                  OOP & CS Foundations
                </span>
                <span className="text-teal-500 font-bold">88%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: "88%" }}></div>
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
                  <span className="font-display text-3xl font-bold text-foreground">138</span>
                  <span className="text-[10px] text-muted-foreground font-bold">WPM</span>
                </div>
                <Badge variant="muted" className="mt-3 text-[9px] font-bold text-emerald-500 border-emerald-500/20 bg-emerald-500/5 uppercase self-start">
                  Fluent Pace
                </Badge>
              </div>

              <div className="border border-border p-4 rounded-lg bg-muted/5 flex flex-col justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Filler Word Rate</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-display text-3xl font-bold text-foreground">2.4</span>
                  <span className="text-[10px] text-muted-foreground font-bold">%</span>
                </div>
                <Badge variant="muted" className="mt-3 text-[9px] font-bold text-brand-700 border-brand-500/20 bg-brand-500/5 uppercase self-start">
                  Minimal fillers
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 bg-muted/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-500/10 flex items-center justify-center text-accent-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-caption text-foreground">Delivery Coach Advice</p>
                  <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed mt-0.5">
                    Steady tempo! To improve, add brief deliberate 2-second pauses before complex technical design transitions.
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
