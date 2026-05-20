"use client";

import { useState, useEffect, type ReactElement } from "react";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Eye, 
  Loader2, 
  Sparkles, 
  X, 
  AlertCircle, 
  Link as LinkIcon, 
  Building2, 
  Search, 
  ArrowUpDown, 
  Play, 
  CheckCircle2,
  Calendar,
  Briefcase
} from "lucide-react";
import Link from "next/link";
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
  const [viewingAddDrawer, setViewingAddDrawer] = useState<boolean>(false);
  const [fetchingDetailId, setFetchingDetailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "name">("recent");

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
        setViewingAddDrawer(false);
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

  // Filter & Sort
  const filteredJds = jds
    .filter((jd) => {
      const query = searchQuery.toLowerCase();
      return (
        jd.name.toLowerCase().includes(query) ||
        (jd.parsedCompanyName && jd.parsedCompanyName.toLowerCase().includes(query)) ||
        jd.parsedKeywords.some((kw) => kw.toLowerCase().includes(query)) ||
        jd.parsedRequiredSkills.some((skill) => skill.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <>
      {/* Header Section */}
      <header className="flex justify-between items-end border-b border-border pb-stack-md shrink-0">
        <div className="flex flex-col gap-1">
          <p className="font-label-sm text-label-sm text-muted-foreground/80 uppercase tracking-wider">Workspace</p>
          <h2 className="font-display text-4xl font-bold text-foreground">Role Library</h2>
        </div>
        <button
          onClick={() => setViewingAddDrawer(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-all active:scale-95 hover:shadow-sm border border-transparent cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Job Description
        </button>
      </header>

      {errorMsg && (
        <div className="flex items-center gap-element rounded-lg border border-red-500/20 bg-red-500/10 px-card py-element text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
          <p className="text-body">{errorMsg}</p>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="flex justify-between items-center bg-card border border-border rounded-lg p-2 shrink-0">
        <div className="flex items-center gap-2 px-3 flex-1">
          <Search className="h-5 w-5 text-muted-foreground/80" />
          <input
            className="w-full bg-transparent border-none focus:outline-none font-body-md text-body-md text-foreground placeholder:text-muted-foreground/80 p-0"
            placeholder="Search by title, company, or keyword..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="h-6 w-px bg-border mx-2"></div>
        <div className="flex gap-2 pr-2">
          <button 
            onClick={() => setSortBy(sortBy === "recent" ? "name" : "recent")}
            className="px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer font-label-sm text-label-sm"
          >
            <ArrowUpDown className="h-4 w-4 text-muted-foreground/80" />
            {sortBy === "recent" ? "Recent" : "Name"}
          </button>
        </div>
      </div>

      {/* Role Index Grid */}
      <div className="flex flex-col gap-stack-sm flex-1 overflow-y-auto">
        {loadingList ? (
          <div className="flex flex-col gap-stack-sm">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-stack-md flex items-center justify-between animate-pulse">
                <div className="flex flex-col gap-2">
                  <div className="h-6 w-48 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
                <div className="h-10 w-28 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filteredJds.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-stack-lg border border-dashed border-border rounded-lg bg-card/50 text-center py-16">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="font-display text-xl font-bold text-foreground mb-1">No Roles Added Yet</h3>
            <p className="font-body-md text-body-md text-muted-foreground max-w-md mb-6">
              Build your practice library by adding job descriptions you want to prepare for.
            </p>
            <Button onClick={() => setViewingAddDrawer(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Your First JD
            </Button>
          </div>
        ) : (
          filteredJds.map((jd) => (
            <div
              key={jd.id}
              onClick={() => handleViewDetails(jd.id)}
              className="group bg-card border border-border rounded-lg p-stack-md flex items-center justify-between transition-all duration-300 hover:border-brand-500/40 hover:shadow-[0_0_20px_rgba(242,106,46,0.04)] cursor-pointer relative overflow-hidden"
            >
              {jd.parsedCompanyName && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-500/50"></div>
              )}
              {/* Left: Metadata */}
              <div className="flex flex-col gap-2 pl-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-display text-lg font-bold text-foreground group-hover:text-brand-700 transition-colors">
                    {jd.name}
                  </h3>
                  {jd.parsedRoleLevel && (
                    <span className="px-2 py-0.5 rounded-full bg-muted border border-border font-label-sm text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {jd.parsedRoleLevel}
                    </span>
                  )}
                  {jd.parsedCompanyTier && (
                    <span className="px-2 py-0.5 rounded-full bg-accent-500/10 border border-accent-500/20 font-label-sm text-[10px] text-accent-600 uppercase tracking-wider font-semibold">
                      {jd.parsedCompanyTier}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-muted-foreground font-body-md text-label-sm">
                  {jd.parsedCompanyName && (
                    <div className="flex items-center gap-1 font-medium">
                      <Building2 className="h-4 w-4 text-muted-foreground/80" />
                      {jd.parsedCompanyName}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground/80 font-medium">
                    <Calendar className="h-4 w-4" />
                    Added {new Date(jd.createdAt).toLocaleDateString()}
                  </div>
                  {jd.parsedRequiredSkills.length > 0 && (
                    <div className="flex items-center gap-1 text-accent-600 font-label-sm text-label-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      Prep Ready
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleViewDetails(jd.id)}
                    className="p-2 text-muted-foreground hover:text-brand-700 transition-colors rounded-lg hover:bg-muted"
                    title="View"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(jd.id, e)}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="h-8 w-px bg-border hidden group-hover:block transition-all"></div>
                <Link
                  href={`/session/new?jdId=${jd.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card border border-brand-500 text-brand-700 hover:text-brand-800 px-4 py-2 rounded-lg font-label-md text-label-md flex items-center gap-2 hover:bg-brand-500/10 transition-colors active:scale-95 font-semibold"
                >
                  <Play className="h-4 w-4" />
                  Start Session
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination / Footer subtle */}
      <div className="mt-auto pt-stack-md border-t border-border flex justify-between items-center text-muted-foreground/80 font-label-sm text-label-sm shrink-0 font-medium">
        <span>Showing {filteredJds.length} of {jds.length} Roles</span>
      </div>

      {/* Details Side-Drawer/Modal */}
      {viewingDetail && selectedJd && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setViewingDetail(false)} />
          
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl transition-all duration-300 ease-out border-l border-border z-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-card py-4 bg-muted/40">
              <div className="flex flex-col">
                <span className="text-caption text-brand-700 font-semibold tracking-wider uppercase">Parsed Job Description</span>
                <h2 className="font-display text-xl font-bold text-foreground mt-0.5">{selectedJd.name}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setViewingDetail(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-card space-y-stack-lg">
              {/* Info stats */}
              <div className="grid grid-cols-3 gap-element rounded-lg border border-border bg-card p-card text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Company</p>
                  <p className="text-body font-semibold mt-2.5 truncate">{selectedJd.parsedCompanyName || "--"}</p>
                </div>
                <div className="border-x border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Company Tier</p>
                  <p className="text-body font-semibold mt-2.5 capitalize">{selectedJd.parsedCompanyTier || "--"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Role Level</p>
                  <p className="text-body font-semibold mt-2.5 capitalize">{selectedJd.parsedRoleLevel || "--"}</p>
                </div>
              </div>

              {/* Required & Nice to Have side by side */}
              <div className="grid gap-stack-md md:grid-cols-2">
                <Card className="border-border">
                  <CardHeader className="py-3 px-card bg-muted/30 border-b border-border">
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
                  <CardHeader className="py-3 px-card bg-muted/30 border-b border-border">
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
                <div className="rounded-lg border border-border bg-muted/20 p-card text-caption font-mono text-muted-foreground max-h-60 overflow-y-auto whitespace-pre-wrap">
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
            <div className="border-t border-border px-card py-4 flex gap-element justify-end bg-muted/40">
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

      {/* Add New JD Side-Drawer */}
      {viewingAddDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setViewingAddDrawer(false)} />
          
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl transition-all duration-300 ease-out border-l border-border z-10">
            {submitting && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-brand-500" aria-hidden />
                <p className="mt-4 font-semibold text-heading">{parserStep}</p>
                <p className="mt-1 text-caption text-muted-foreground">This can take up to 15 seconds</p>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-card py-4 bg-muted/40">
              <div className="flex flex-col">
                <span className="text-caption text-brand-700 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> Create Profile
                </span>
                <h2 className="font-display text-xl font-bold text-foreground mt-0.5">Add Target JD</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setViewingAddDrawer(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-card space-y-stack-md">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="jd-name">Target Role / Listing Name</Label>
                  <Input
                    id="jd-name"
                    placeholder="e.g. Stripe Senior Frontend Engineer"
                    value={jdName}
                    onChange={(e) => setJdName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="jd-url">Listing URL (Optional)</Label>
                  <Input
                    id="jd-url"
                    placeholder="e.g. https://careers.stripe.com/jobs/..."
                    value={jdUrl}
                    onChange={(e) => setJdUrl(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-h-[250px]">
                  <Label htmlFor="jd-text">Job Description Text</Label>
                  <textarea
                    id="jd-text"
                    placeholder="Paste the full job requirements, skills, and qualifications text details here..."
                    className="flex-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-body shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[200px]"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border px-card py-4 flex gap-element justify-end bg-muted/40 shrink-0">
                <Button type="button" variant="secondary" onClick={() => setViewingAddDrawer(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white" disabled={submitting}>
                  {submitting ? "Analyzing JD..." : "Add & Structure JD"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
