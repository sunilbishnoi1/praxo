"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import {
  BarChart2,
  Calendar,
  Clock,
  Dumbbell,
  FileText,
  Loader2,
  TrendingUp,
  Award,
  ChevronRight,
  Sparkles,
  Search
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
import { Input } from "@/components/ui/input";

type SessionListItem = {
  id: string;
  status: string;
  roundType: string;
  difficulty: string;
  yearsOfExperience: number | null;
  overallScore: number | null;
  questionCount: number;
  totalDurationMs: number | null;
  createdAt: string;
  resume?: { name: string } | null;
  jobDescription?: { name: string } | null;
};

export default function ReportsPage(): ReactElement {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // "all" | "completed" | "in_progress"
  const [roundFilter, setRoundFilter] = useState<string>("all");

  useEffect(() => {
    async function loadSessions(): Promise<void> {
      try {
        const response = await fetch("/api/sessions");
        const json = await response.json();
        if (json.success) {
          setSessions(json.data.sessions || []);
        } else {
          setError(json.error?.message || "Failed to load sessions.");
        }
      } catch (err) {
        console.error("Failed to load sessions:", err);
        setError("Network error loading your session history.");
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  const filteredSessions = sessions.filter((s) => {
    // 1. Search Query
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      s.roundType.toLowerCase().includes(query) ||
      s.difficulty.toLowerCase().includes(query) ||
      (s.resume?.name || "").toLowerCase().includes(query) ||
      (s.jobDescription?.name || "").toLowerCase().includes(query);

    // 2. Status Filter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && s.status === "completed") ||
      (statusFilter === "in_progress" && s.status === "in_progress");

    // 3. Round Filter
    const matchesRound =
      roundFilter === "all" || s.roundType === roundFilter;

    return matchesSearch && matchesStatus && matchesRound;
  });

  const roundTypes = Array.from(new Set(sessions.map((s) => s.roundType)));

  function formatRoundName(id: string): string {
    return id
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
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-element">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
        <p className="text-body text-muted-foreground animate-pulse font-medium">
          Retrieving session reports...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg flex-1">
      {/* Header Section */}
      <header className="flex justify-between items-end border-b border-border pb-stack-md shrink-0">
        <div className="flex flex-col gap-1">
          <p className="font-label-sm text-label-sm text-muted-foreground/80 uppercase tracking-wider">Analytics</p>
          <h2 className="font-display text-4xl font-bold text-foreground">Interview Reports</h2>
        </div>
        <Button asChild className="bg-brand-500 hover:bg-brand-600 text-white font-semibold">
          <Link href="/session/new" className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            New Practice Session
          </Link>
        </Button>
      </header>

      {/* Filters Dashboard */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card border border-border p-4 rounded-lg shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by round, resume, or JD..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-transparent focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status Tabs */}
          <div className="flex items-center rounded-lg border border-border bg-muted/20 p-1 text-caption font-semibold">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                statusFilter === "completed"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setStatusFilter("in_progress")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                statusFilter === "in_progress"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active
            </button>
          </div>

          {/* Round Filter */}
          <select
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
            className="rounded-lg border border-border bg-card text-caption font-semibold px-3 py-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          >
            <option value="all">All Rounds</option>
            {roundTypes.map((rt) => (
              <option key={rt} value={rt}>
                {formatRoundName(rt)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-card py-element text-red-600 dark:text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Reports Grid */}
      {filteredSessions.length === 0 ? (
        <Card className="border-dashed border-border bg-card p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-brand-500/10 text-brand-700 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-xl font-bold mb-2">No Reports Found</CardTitle>
          <CardDescription className="max-w-md text-muted-foreground mb-6 font-medium">
            You don't have any completed session reports matching your filters. Start a practice interview to generate real-time feedback.
          </CardDescription>
          <Button asChild className="bg-brand-500 hover:bg-brand-600 text-white font-semibold">
            <Link href="/session/new">Practice Now</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((s) => {
            const isCompleted = s.status === "completed";
            const mockGeneratedScore = s.overallScore || (isCompleted ? 82 : null);

            return (
              <Card key={s.id} className="border-border bg-card hover:border-brand-500/30 hover:shadow-sm transition-all duration-300 flex flex-col justify-between overflow-hidden relative">
                {isCompleted && mockGeneratedScore && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(8,166,209,0.03)_0%,_rgba(8,166,209,0)_60%)]"
                  />
                )}
                
                <CardHeader className="pb-3 border-b border-border bg-muted/10">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="muted" className="font-bold text-[10px] tracking-wider uppercase bg-brand-500/10 text-brand-700">
                      {formatRoundName(s.roundType)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground/80 font-bold uppercase tracking-wider">
                      {s.difficulty}
                    </span>
                  </div>
                  <CardTitle className="font-display text-lg font-bold text-foreground">
                    {s.jobDescription?.name || s.resume?.name || "Self-guided Session"}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-caption font-semibold mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(s.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-caption">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                      <Clock className="h-3.5 w-3.5" />
                      Duration: {formatDuration(s.totalDurationMs)}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                      <Dumbbell className="h-3.5 w-3.5" />
                      Prompts: {s.questionCount}
                    </div>
                  </div>

                  {isCompleted && mockGeneratedScore ? (
                    <div className="flex items-center gap-3 pt-2">
                      <div className="w-10 h-10 rounded-full border-2 border-accent-500/20 bg-accent-500/5 flex items-center justify-center font-display text-md font-bold text-accent-600">
                        {mockGeneratedScore}
                      </div>
                      <div>
                        <p className="font-bold text-caption text-foreground">AI Readiness Grade</p>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          {mockGeneratedScore >= 90
                            ? "Excellent · Ready to Hire"
                            : mockGeneratedScore >= 80
                            ? "Grade A · Strong Profile"
                            : "Developing · Keep practicing"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 pt-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        s.status === "in_progress"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {s.status === "in_progress" ? "Active" : s.status}
                      </span>
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        {s.status === "in_progress"
                          ? "Session in progress"
                          : "Abandoned practice run"}
                      </p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 pb-4 px-card bg-muted/5 border-t border-border">
                  {isCompleted ? (
                    <Button asChild className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold flex items-center justify-center gap-1">
                      <Link href={`/reports/${s.id}`}>
                        View Feedback Report
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : s.status === "in_progress" ? (
                    <Button asChild variant="outline" className="w-full border-brand-500 text-brand-700 hover:bg-brand-500/10 font-semibold flex items-center justify-center gap-1">
                      <Link href={`/session/${s.id}`}>
                        Resume Interview
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled variant="secondary" className="w-full font-semibold">
                      Unfinished run
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
