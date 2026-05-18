"use client";

import { useState, useEffect, type ReactElement } from "react";
import { FileText, Plus, Trash2, Eye, Loader2, Sparkles, ChevronRight, X, AlertCircle, Link as LinkIcon, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type JdDetail = {
  id: string;
  name: string;
  rawText: string;
  sourceUrl: string | null;
  parsedRequiredSkills: string[];
  parsedNiceToHave: string[];
  parsedKeywords: string[];
  parsedRoleLevel: string | null;
  parsedCompanyName: string | null;
  parsedCompanyTier: string | null;
  createdAt: string;
};

export default function JdPage(): ReactElement {
  const [jds, setJds] = useState<JdDetail[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [jdName, setJdName] = useState<string>("");
  const [jdUrl, setJdUrl] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");
  const [parserStep, setParserStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [selectedJd, setSelectedJd] = useState<JdDetail | null>(null);
  const [viewingDetail, setViewingDetail] = useState<boolean>(false);
  const [fetchingDetailId, setFetchingDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetchJds();
  }, []);

  async function fetchJds(): Promise<void> {
    setLoadingList(true);
    try {
      const res = await fetch("/api/job-descriptions");
      const json = await res.json();
      if (json.success) {
        setJds(json.data.jobDescriptions);
      } else {
        setErrorMsg(json.error?.message || "Failed to load job descriptions.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while loading job descriptions.");
    } finally {
      setLoadingList(false);
    }
  }

  // Handle Submit
  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErrorMsg("");

    if (!jdName.trim()) {
      setErrorMsg("Job name is required.");
      return;
    }

    if (!jdText.trim()) {
      setErrorMsg("Job description text content is required.");
      return;
    }

    setSubmitting(true);
    setParserStep("Analyzing role requirements...");

    try {
      // Shifting progress text to look premium
      const interval = setInterval(() => {
        setParserStep((current) => {
          if (current === "Analyzing role requirements...") return "LLM parsing required skills...";
          if (current === "LLM parsing required skills...") return "Extracting nice-to-have qualifications...";
          if (current === "Extracting nice-to-have qualifications...") return "Classifying company tier & keywords...";
          return "Finalizing target JD profile...";
        });
      }, 2500);

      const response = await fetch("/api/job-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: jdName,
          text: jdText,
          sourceUrl: jdUrl || null,
        }),
      });

      clearInterval(interval);
      const json = await response.json();

      if (json.success) {
        setJdName("");
        setJdUrl("");
        setJdText("");
        setParserStep("");
        fetchJds();
      } else {
        setErrorMsg(json.error?.message || "Failed to parse job description.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while parsing the job description.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Delete
  async function handleDelete(id: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this job description?")) {
      return;
    }

    try {
      const response = await fetch(`/api/job-descriptions/${id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (json.success) {
        setJds(jds.filter((j) => j.id !== id));
        if (selectedJd?.id === id) {
          setViewingDetail(false);
          setSelectedJd(null);
        }
      } else {
        setErrorMsg(json.error?.message || "Failed to delete job description.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while deleting the job description.");
    }
  }

  // Handle View Details
  async function handleViewDetails(id: string): Promise<void> {
    setFetchingDetailId(id);
    try {
      const response = await fetch(`/api/job-descriptions/${id}`);
      const json = await response.json();
      if (json.success) {
        setSelectedJd(json.data.jobDescription);
        setViewingDetail(true);
      } else {
        setErrorMsg(json.error?.message || "Failed to load job description details.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while fetching details.");
    } finally {
      setFetchingDetailId(null);
    }
  }

  // Helper for company tier badges
  function getTierBadgeColor(tier: string | null): string {
    if (!tier) return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    const t = tier.toLowerCase();
    if (t === "faang") return "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400";
    if (t === "mid-tier") return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400";
    return "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400"; // startup
  }

  return (
    <div className="flex flex-col gap-section">
      {/* Page Header */}
      <div className="flex flex-col gap-element md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-display text-foreground">Target Roles (JDs)</h1>
          <p className="text-body text-muted-foreground">
            Save target job descriptions to analyze resume gaps and generate context-focused interview questions.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-element rounded-button border border-red-500/20 bg-red-500/10 px-card py-element text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
          <p className="text-body">{errorMsg}</p>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid gap-section lg:grid-cols-[5fr_7fr]">
        
        {/* Left Column: Form */}
        <div className="flex flex-col gap-element">
          <Card className="relative overflow-hidden">
            {submitting && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-accent-600" aria-hidden />
                <p className="mt-4 font-semibold text-heading">{parserStep}</p>
                <p className="mt-1 text-caption text-muted-foreground">This can take up to 15 seconds</p>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-element">
                <Sparkles className="h-5 w-5 text-accent-500" aria-hidden /> Add Target JD
              </CardTitle>
              <CardDescription>
                Paste the requirements of the job you are targeting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-element">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="jd-name">Target Role / Listing Name</Label>
                  <Input
                    id="jd-name"
                    placeholder="e.g. Google SDE-2 Fullstack"
                    value={jdName}
                    onChange={(e) => setJdName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="jd-url">Listing URL (Optional)</Label>
                  <Input
                    id="jd-url"
                    placeholder="e.g. https://careers.google.com/jobs/..."
                    value={jdUrl}
                    onChange={(e) => setJdUrl(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="jd-text">Job Description Text</Label>
                  <textarea
                    id="jd-text"
                    rows={8}
                    placeholder="Paste the full job requirements, skills, and qualifications text details here..."
                    className="flex w-full rounded-button border border-input bg-transparent px-3 py-2 text-body shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? "Analyzing JD..." : "Add & Structure JD"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Existing JDs */}
        <div className="flex flex-col gap-element">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-element">
                <FileText className="h-5 w-5 text-accent-500" aria-hidden /> Target Roles Catalog
              </CardTitle>
              <CardDescription>
                Catalog of saved listings, used as benchmark templates for interview evaluations.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-element">
              {loadingList ? (
                <div className="flex flex-col gap-element">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-button border border-border p-4">
                      <div className="h-5 w-40 animate-pulse bg-muted rounded" />
                      <div className="h-4 w-60 animate-pulse bg-muted rounded" />
                      <div className="flex gap-2 mt-2">
                        <div className="h-6 w-16 animate-pulse bg-muted rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : jds.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden />
                  <p className="font-semibold text-body">No target roles yet</p>
                  <p className="text-caption mt-1 max-w-xs">
                    Paste your target job descriptions to analyze core skills alignment.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-element">
                  {jds.map((jd) => (
                    <div
                      key={jd.id}
                      className="group flex items-start justify-between rounded-card border border-border bg-surface p-card transition-all hover:border-accent-500/50 hover:bg-surface-raised cursor-pointer"
                      onClick={() => handleViewDetails(jd.id)}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-element flex-wrap">
                          <h3 className="font-medium text-body text-foreground group-hover:text-accent-600 transition-colors">
                            {jd.name}
                          </h3>
                          {jd.parsedCompanyName && (
                            <span className="text-caption text-muted-foreground flex items-center gap-1 font-medium bg-background border border-border px-1.5 py-0.5 rounded-button">
                              <Building2 className="h-3 w-3" /> {jd.parsedCompanyName}
                            </span>
                          )}
                          {jd.parsedCompanyTier && (
                            <Badge variant="default" className={`text-[9px] capitalize ${getTierBadgeColor(jd.parsedCompanyTier)}`}>
                              {jd.parsedCompanyTier}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {jd.parsedRequiredSkills.slice(0, 5).map((skill) => (
                            <Badge key={skill} variant="default" className="text-[10px] bg-background">
                              {skill}
                            </Badge>
                          ))}
                          {jd.parsedRequiredSkills.length > 5 && (
                            <span className="text-[10px] text-muted-foreground font-medium self-center ml-1">
                              +{jd.parsedRequiredSkills.length - 5} more
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Created on {new Date(jd.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          disabled={fetchingDetailId === jd.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(jd.id);
                          }}
                        >
                          {fetchingDetailId === jd.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                          onClick={(e) => handleDelete(jd.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Details Side-Drawer/Modal (Custom UI matching premium layouts) */}
      {viewingDetail && selectedJd && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setViewingDetail(false)} />
          
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl transition-all duration-300 ease-out border-l border-border z-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-card py-4 bg-surface-raised">
              <div className="flex flex-col">
                <span className="text-caption text-accent-600 font-semibold tracking-wider uppercase">Parsed Job Description</span>
                <h2 className="font-display text-subheading text-foreground mt-0.5">{selectedJd.name}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setViewingDetail(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-card space-y-section">
              
              {/* Info stats */}
              <div className="grid grid-cols-3 gap-element rounded-card border border-border bg-surface p-card text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Company</p>
                  <p className="text-body font-semibold mt-2.5 truncate">{selectedJd.parsedCompanyName || "--"}</p>
                </div>
                <div className="border-x border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Company Tier</p>
                  <p className="text-body font-semibold mt-2.5 capitalize">{selectedJd.parsedCompanyTier || "--"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Role Level</p>
                  <p className="text-body font-semibold mt-2.5 capitalize">{selectedJd.parsedRoleLevel || "--"}</p>
                </div>
              </div>

              {/* Required & Nice to Have side by side */}
              <div className="grid gap-element md:grid-cols-2">
                <Card className="border-border">
                  <CardHeader className="py-3 px-card bg-surface-raised border-b border-border">
                    <CardTitle className="text-body font-semibold text-emerald-600 dark:text-emerald-400">Required Skills</CardTitle>
                  </CardHeader>
                  <CardContent className="p-card flex flex-wrap gap-1.5">
                    {selectedJd.parsedRequiredSkills.map((s) => (
                      <Badge key={s} variant="success" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                    {selectedJd.parsedRequiredSkills.length === 0 && (
                      <p className="text-caption text-muted-foreground italic">No required skills parsed.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="py-3 px-card bg-surface-raised border-b border-border">
                    <CardTitle className="text-body font-semibold text-blue-600 dark:text-blue-400">Nice-to-Have Skills</CardTitle>
                  </CardHeader>
                  <CardContent className="p-card flex flex-wrap gap-1.5">
                    {selectedJd.parsedNiceToHave.map((s) => (
                      <Badge key={s} variant="default" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                    {selectedJd.parsedNiceToHave.length === 0 && (
                      <p className="text-caption text-muted-foreground italic">No nice-to-have skills parsed.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Keywords Extracted */}
              <div className="space-y-element">
                <h3 className="font-semibold text-body border-b border-border pb-1">Extracted Core Keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJd.parsedKeywords?.map((keyword) => (
                    <Badge key={keyword} variant="default" className="text-[10px] px-2 py-0.5 border-dashed bg-background">
                      {keyword}
                    </Badge>
                  ))}
                  {(!selectedJd.parsedKeywords || selectedJd.parsedKeywords.length === 0) && (
                    <p className="text-caption text-muted-foreground italic">No keywords extracted.</p>
                  )}
                </div>
              </div>

              {/* Original text */}
              <div className="space-y-element">
                <h3 className="font-semibold text-body border-b border-border pb-1">Original Job Description</h3>
                <div className="rounded-button border border-border bg-surface-raised p-card text-caption font-mono text-muted-foreground max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {selectedJd.rawText}
                </div>
              </div>

              {/* Source url */}
              {selectedJd.sourceUrl && (
                <div className="flex items-center gap-element text-caption text-muted-foreground">
                  <LinkIcon className="h-4 w-4" />
                  <span>Source URL:</span>
                  <a href={selectedJd.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline truncate max-w-md">
                    {selectedJd.sourceUrl}
                  </a>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="border-t border-border px-card py-4 flex gap-element justify-end bg-surface-raised">
              <Button variant="secondary" onClick={() => setViewingDetail(false)}>
                Close Details
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 border-red-500 text-red-500 hover:bg-red-500/10"
                onClick={(e) => {
                  if (selectedJd) handleDelete(selectedJd.id, e);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete JD
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
