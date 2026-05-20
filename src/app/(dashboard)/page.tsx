import type { ReactElement } from "react";
import Link from "next/link";
import { FileText, FileUser, Settings, TrendingUp, Sparkles, Flame, CheckCircle, GraduationCap, ArrowRight, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StatCard = {
  label: string;
  value: string;
  detail: string;
  icon: any;
};

const stats: StatCard[] = [
  { label: "Sessions", value: "0", detail: "This week", icon: Activity },
  { label: "Average Score", value: "--", detail: "No sessions yet", icon: GraduationCap },
  { label: "Active Streak", value: "0", detail: "Days active", icon: Flame },
];

const quickActions = [
  {
    title: "Resume Library",
    description: "Upload and structure your resumes to enable customized, highly personalized scenarios.",
    href: "/resume",
    cta: "Manage Resumes",
    icon: FileUser,
    color: "text-brand-700 bg-brand-500/10",
  },
  {
    title: "Job Descriptions",
    description: "Save and analyze target roles to compare fit, match tech stack skills, and build scenarios.",
    href: "/jd",
    cta: "Add Target JD",
    icon: FileText,
    color: "text-accent-600 bg-accent-500/10",
  },
  {
    title: "Service Settings",
    description: "Connect primary LLM gateway, models, voice transcription services, and latency tokens.",
    href: "/settings",
    cta: "Configure Services",
    icon: Settings,
    color: "text-muted-foreground/80 bg-muted",
  },
];

export default function DashboardPage(): ReactElement {
  return (
    <div className="flex flex-col gap-stack-lg flex-1">
      {/* Welcome Hero & Momentum snapshot */}
      <section className="grid gap-stack-md lg:grid-cols-[7fr_5fr]">
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-stack-lg flex flex-col justify-between min-h-[300px]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,106,46,0.08)_0%,_rgba(242,106,46,0)_60%)]"
          />
          <div className="relative flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-700 font-label-sm text-[10px] uppercase tracking-wider font-bold">
                Workspace Active
              </span>
              <span className="text-caption text-muted-foreground font-semibold">• Praxo AI v1.0</span>
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground leading-tight tracking-tight mt-2">
              Practice interviews <br />
              that feel <span className="text-brand-700">extremely real.</span>
            </h1>
            <p className="max-w-xl text-body-md text-body-md text-muted-foreground mt-2 leading-relaxed">
              Launch live mock voice sessions, receive structural technical grading, and pinpoint key vocabulary gaps immediately.
            </p>
          </div>
          <div className="relative flex flex-wrap gap-3 mt-6">
            <Link
              href="/session/new"
              className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-all active:scale-95 hover:shadow-sm font-semibold"
            >
              Start Practice Session
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/resume"
              className="bg-transparent border border-border hover:bg-muted text-foreground px-6 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-all active:scale-95 font-semibold"
            >
              Upload Resume
            </Link>
          </div>
        </div>

        <Card className="flex h-full flex-col border-border bg-card overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border pb-4">
            <CardDescription className="font-semibold text-caption text-brand-700 uppercase tracking-wider">Metrics Panel</CardDescription>
            <CardTitle className="font-display text-2xl font-bold text-foreground">Your Momentum</CardTitle>
          </CardHeader>
          <CardContent className="grid flex-1 gap-3 p-stack-md sm:grid-cols-3 bg-card">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-muted/20 p-stack-md flex flex-col justify-between transition-all hover:border-brand-500/20"
                >
                  <div className="flex justify-between items-start text-muted-foreground">
                    <span className="font-label-sm text-label-sm font-semibold">{stat.label}</span>
                    <Icon className="h-4 w-4 text-brand-500/60" />
                  </div>
                  <div className="my-3">
                    <p className="font-display text-3xl font-bold text-foreground leading-none">{stat.value}</p>
                  </div>
                  <span className="font-label-sm text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">
                    {stat.detail}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Quick Action Navigation Grid */}
      <section className="grid gap-stack-md md:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.title} className="flex h-full flex-col border-border bg-card group hover:border-brand-500/30 transition-all duration-300">
              <CardHeader className="pb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color} mb-3`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <CardTitle className="font-display text-lg font-bold text-foreground group-hover:text-brand-700 transition-colors">
                  {action.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-caption mt-1.5 leading-relaxed">
                  {action.description}
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto pt-2 pb-5 px-6">
                <Link
                  href={action.href}
                  className="text-brand-700 font-label-md text-label-md font-semibold flex items-center gap-1 hover:underline"
                >
                  {action.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      {/* Recent Sessions & Progress Trends */}
      <section className="grid gap-stack-md lg:grid-cols-[2fr_1fr]">
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border pb-4 bg-muted/10">
            <CardTitle className="font-display text-xl font-bold text-foreground">Recent Sessions</CardTitle>
            <CardDescription className="text-muted-foreground">Latest interviews and diagnostic reports.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-card py-10 text-center text-body-md text-muted-foreground font-medium">
              No sessions yet. Start your first practice mock session to populate this catalog.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border pb-4 bg-muted/10">
            <CardTitle className="font-display text-xl font-bold text-foreground">Skill Progress</CardTitle>
            <CardDescription className="text-muted-foreground">Category-specific diagnostic insights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 bg-card">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-card py-6">
              <div className="flex items-center gap-3 text-caption text-muted-foreground font-medium">
                <TrendingUp className="h-4 w-4 text-brand-500" aria-hidden />
                Score trend metrics will appear here.
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-card py-6">
              <div className="flex items-center gap-3 text-caption text-muted-foreground font-medium">
                <TrendingUp className="h-4 w-4 text-accent-600" aria-hidden />
                Fluency ratings will appear here.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
