import type { ReactElement } from "react";

import Link from "next/link";
import { FileText, FileUser, Settings, TrendingUp } from "lucide-react";

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
};

const stats: StatCard[] = [
  { label: "Sessions", value: "0", detail: "This week" },
  { label: "Average score", value: "--", detail: "No sessions yet" },
  { label: "Active streak", value: "0", detail: "Days active" },
];

const quickActions = [
  {
    title: "Resume library",
    description: "Upload and manage resumes for personalization.",
    href: "/resume",
    cta: "Manage resumes",
    icon: FileUser,
  },
  {
    title: "Job descriptions",
    description: "Store target roles and compare your fit.",
    href: "/jd",
    cta: "Add a JD",
    icon: FileText,
  },
  {
    title: "Provider settings",
    description: "Connect your LLM and voice providers.",
    href: "/settings",
    cta: "Configure",
    icon: Settings,
  },
];

export default function DashboardPage(): ReactElement {
  return (
    <div className="flex flex-col gap-section">
      <section className="grid gap-section lg:grid-cols-[7fr_5fr]">
        <div className="relative overflow-hidden rounded-card border border-border bg-surface px-card py-card">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,106,46,0.18)_0%,_rgba(242,106,46,0)_55%)]"
          />
          <div className="relative flex flex-col gap-element">
            <p className="text-caption uppercase tracking-[0.2em] text-muted-foreground">
              Welcome back
            </p>
            <h1 className="font-display text-display">
              Practice interviews that feel real
            </h1>
            <p className="max-w-xl text-body text-muted-foreground">
              Launch a mock interview, hear the questions out loud, and track
              your fluency and scoring with every session.
            </p>
            <div className="flex flex-wrap gap-element">
              <Button asChild>
                <Link href="/session/new">Start New Session</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/resume">Upload Resume</Link>
              </Button>
            </div>
          </div>
        </div>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardDescription>Session snapshot</CardDescription>
            <CardTitle className="text-heading">Your momentum</CardTitle>
          </CardHeader>
          <CardContent className="grid flex-1 gap-element sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-button border border-border bg-surface px-element py-element"
              >
                <p className="text-caption text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-score-large leading-none">{stat.value}</p>
                <p className="text-caption text-muted-foreground">
                  {stat.detail}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-element md:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.title} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-accent-500/10 text-accent-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button variant="ghost" asChild>
                  <Link href={action.href}>{action.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-section lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>Latest interviews and scores.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-button border border-dashed border-border bg-surface px-card py-element text-body text-muted-foreground">
              No sessions yet. Start your first interview to populate this list.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress snapshot</CardTitle>
            <CardDescription>Quick view of your trends.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-element">
            <div className="rounded-button border border-dashed border-border bg-surface px-card py-element">
              <div className="flex items-center gap-element text-body text-muted-foreground">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Score trend will appear here once sessions are completed.
              </div>
            </div>
            <div className="rounded-button border border-dashed border-border bg-surface px-card py-element">
              <div className="flex items-center gap-element text-body text-muted-foreground">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Fluency trend will appear here once sessions are completed.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
