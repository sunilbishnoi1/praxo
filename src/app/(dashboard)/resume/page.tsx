"use client";

import { useState, useEffect, useRef, type ReactElement, type ChangeEvent, type DragEvent } from "react";
import { FileUser, Upload, Trash2, Eye, Loader2, Sparkles, FileText, ChevronRight, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ParsedExperience = {
  company: string | null;
  role: string | null;
  duration: string | null;
  highlights: string[];
};

type ParsedEducation = {
  institution: string | null;
  degree: string | null;
  year: string | null;
};

type ParsedProject = {
  name: string | null;
  description: string | null;
  technologies: string[];
};

type ResumeDetail = {
  id: string;
  name: string;
  experienceLevel: string | null;
  yearsOfExperience: number | null;
  parsedSkills: string[];
  parsedExperience?: ParsedExperience[];
  parsedEducation?: ParsedEducation[];
  parsedProjects?: ParsedProject[];
  rawText?: string;
  createdAt: string;
};

export default function ResumePage(): ReactElement {
  const [resumes, setResumes] = useState<ResumeDetail[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file");
  const [resumeName, setResumeName] = useState<string>("");
  const [resumeText, setResumeText] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [parserStep, setParserStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [selectedResume, setSelectedResume] = useState<ResumeDetail | null>(null);
  const [viewingDetail, setViewingDetail] = useState<boolean>(false);
  const [fetchingDetailId, setFetchingDetailId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchResumes();
  }, []);

  async function fetchResumes(): Promise<void> {
    setLoadingList(true);
    try {
      const res = await fetch("/api/resumes");
      const json = await res.json();
      if (json.success) {
        setResumes(json.data.resumes);
      } else {
        setErrorMsg(json.error?.message || "Failed to load resumes.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while loading resumes.");
    } finally {
      setLoadingList(false);
    }
  }

  // Handle Drag Over
  function handleDrag(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  // Handle Drag Drop
  function handleDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        if (!resumeName) {
          setResumeName(file.name.replace(/\.pdf$/i, ""));
        }
      } else {
        setErrorMsg("Only PDF files are supported.");
      }
    }
  }

  // Handle File Selector Change
  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        if (!resumeName) {
          setResumeName(file.name.replace(/\.pdf$/i, ""));
        }
      } else {
        setErrorMsg("Only PDF files are supported.");
      }
    }
  }

  // Trigger File Input Click
  function triggerFileInput(): void {
    fileInputRef.current?.click();
  }

  // Handle Submit
  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErrorMsg("");

    if (!resumeName.trim()) {
      setErrorMsg("Resume name is required.");
      return;
    }

    if (uploadMode === "file" && !selectedFile) {
      setErrorMsg("Please select a PDF file.");
      return;
    }

    if (uploadMode === "text" && !resumeText.trim()) {
      setErrorMsg("Please paste some resume text.");
      return;
    }

    setSubmitting(true);
    setParserStep("Reading document...");

    try {
      const formData = new FormData();
      formData.append("name", resumeName);

      if (uploadMode === "file" && selectedFile) {
        formData.append("file", selectedFile);
      } else {
        formData.append("text", resumeText);
      }

      // Shifting progress text to look premium
      const interval = setInterval(() => {
        setParserStep((current) => {
          if (current === "Reading document...") return "Extracting raw text...";
          if (current === "Extracting raw text...") return "LLM analyzing skills...";
          if (current === "LLM analyzing skills...") return "Structuring work history...";
          if (current === "Structuring work history...") return "Validating parsed fields...";
          return "Finalizing resume profile...";
        });
      }, 2500);

      const response = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      const json = await response.json();

      if (json.success) {
        setResumeName("");
        setResumeText("");
        setSelectedFile(null);
        setParserStep("");
        fetchResumes();
      } else {
        setErrorMsg(json.error?.message || "Failed to parse resume.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while parsing the resume.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Delete
  async function handleDelete(id: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this resume?")) {
      return;
    }

    try {
      const response = await fetch(`/api/resumes/${id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (json.success) {
        setResumes(resumes.filter((r) => r.id !== id));
        if (selectedResume?.id === id) {
          setViewingDetail(false);
          setSelectedResume(null);
        }
      } else {
        setErrorMsg(json.error?.message || "Failed to delete resume.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while deleting the resume.");
    }
  }

  // Handle View Details
  async function handleViewDetails(id: string): Promise<void> {
    setFetchingDetailId(id);
    try {
      const response = await fetch(`/api/resumes/${id}`);
      const json = await response.json();
      if (json.success) {
        setSelectedResume(json.data.resume);
        setViewingDetail(true);
      } else {
        setErrorMsg(json.error?.message || "Failed to load resume details.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while fetching resume details.");
    } finally {
      setFetchingDetailId(null);
    }
  }

  // Helper for experience badges
  function getLevelBadgeVariant(level: string | null): "default" | "success" | "warning" | "muted" {
    if (!level) return "muted";
    const l = level.toLowerCase();
    if (l === "senior") return "warning";
    if (l === "mid") return "default";
    return "muted";
  }

  return (
    <div className="flex flex-col gap-section">
      {/* Page Header */}
      <div className="flex flex-col gap-element md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-display text-foreground">Resume Library</h1>
          <p className="text-body text-muted-foreground">
            Upload and parse your resumes to automatically customize interview sessions.
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
        
        {/* Left Column: Upload / Paste Form */}
        <div className="flex flex-col gap-element">
          <Card className="relative overflow-hidden">
            {submitting && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-accent-600" aria-hidden />
                <p className="mt-4 font-semibold text-heading">{parserStep}</p>
                <p className="mt-1 text-caption text-muted-foreground">This can take up to 20 seconds</p>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-element">
                <Sparkles className="h-5 w-5 text-accent-500" aria-hidden /> Add New Resume
              </CardTitle>
              <CardDescription>
                Import a resume so the system can analyze your skills and background.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-element">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resume-name">Resume Profile Name</Label>
                  <Input
                    id="resume-name"
                    placeholder="e.g. SDE-2 Fullstack Resume"
                    value={resumeName}
                    onChange={(e) => setResumeName(e.target.value)}
                    required
                  />
                </div>

                <div className="mt-2">
                  <div className="flex rounded-button border border-border bg-surface p-0.5">
                    <button
                      type="button"
                      className={`flex-1 rounded-[6px] py-1.5 text-center text-caption font-medium transition-all ${
                        uploadMode === "file"
                          ? "bg-surface-raised text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setUploadMode("file")}
                    >
                      PDF Upload
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded-[6px] py-1.5 text-center text-caption font-medium transition-all ${
                        uploadMode === "text"
                          ? "bg-surface-raised text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setUploadMode("text")}
                    >
                      Paste Text
                    </button>
                  </div>
                </div>

                {uploadMode === "file" ? (
                  <div className="flex flex-col gap-element">
                    <div
                      className={`flex flex-col items-center justify-center rounded-card border border-dashed p-8 text-center transition-all ${
                        dragActive
                          ? "border-accent-500 bg-accent-500/5 scale-[0.99]"
                          : "border-border bg-surface-raised hover:bg-surface-raised/80"
                      } cursor-pointer`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={triggerFileInput}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="application/pdf"
                        onChange={handleFileChange}
                      />
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/10 text-accent-600 mb-3">
                        <Upload className="h-6 w-6" aria-hidden />
                      </div>
                      <p className="font-medium text-body">
                        {selectedFile ? selectedFile.name : "Drag & drop your PDF resume"}
                      </p>
                      <p className="text-caption text-muted-foreground mt-1">
                        {selectedFile
                          ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                          : "Supports PDF format up to 5MB"}
                      </p>
                      {!selectedFile && (
                        <Button type="button" variant="secondary" size="sm" className="mt-4">
                          Browse Files
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="resume-text">Resume Raw Text</Label>
                    <textarea
                      id="resume-text"
                      rows={8}
                      placeholder="Paste your full resume text details here..."
                      className="flex w-full rounded-button border border-input bg-transparent px-3 py-2 text-body shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                    />
                  </div>
                )}

                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? "Processing..." : "Parse & Save Resume"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Existing Resumes list */}
        <div className="flex flex-col gap-element">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-heading flex items-center gap-element">
                <FileUser className="h-5 w-5 text-accent-500" aria-hidden /> Your Resumes
              </CardTitle>
              <CardDescription>
                Select a resume to view its structured analysis, or remove profiles.
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
                        <div className="h-6 w-16 animate-pulse bg-muted rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : resumes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden />
                  <p className="font-semibold text-body">No resumes parsed yet</p>
                  <p className="text-caption mt-1 max-w-xs">
                    Upload your first resume PDF or paste raw text to build your profile.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-element">
                  {resumes.map((resume) => (
                    <div
                      key={resume.id}
                      className="group flex items-start justify-between rounded-card border border-border bg-surface p-card transition-all hover:border-accent-500/50 hover:bg-surface-raised cursor-pointer"
                      onClick={() => handleViewDetails(resume.id)}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-element flex-wrap">
                          <h3 className="font-medium text-body text-foreground group-hover:text-accent-600 transition-colors">
                            {resume.name}
                          </h3>
                          {resume.experienceLevel && (
                            <Badge variant={getLevelBadgeVariant(resume.experienceLevel)} className="text-[10px]">
                              {resume.experienceLevel}
                            </Badge>
                          )}
                          {resume.yearsOfExperience !== null && resume.yearsOfExperience !== 0 && (
                            <span className="text-caption text-muted-foreground">
                              ({resume.yearsOfExperience} yrs exp)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {resume.parsedSkills.slice(0, 5).map((skill) => (
                            <Badge key={skill} variant="default" className="text-[10px] bg-background">
                              {skill}
                            </Badge>
                          ))}
                          {resume.parsedSkills.length > 5 && (
                            <span className="text-[10px] text-muted-foreground font-medium self-center ml-1">
                              +{resume.parsedSkills.length - 5} more
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Added on {new Date(resume.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          disabled={fetchingDetailId === resume.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(resume.id);
                          }}
                        >
                          {fetchingDetailId === resume.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                          onClick={(e) => handleDelete(resume.id, e)}
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

      {/* Details Side-Drawer/Modal (Custom implementation to match Radix overlays beautifully) */}
      {viewingDetail && selectedResume && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
          {/* Backdrop Click Dismisses */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setViewingDetail(false)} />
          
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl transition-all duration-300 ease-out border-l border-border z-10">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border px-card py-4 bg-surface-raised">
              <div className="flex flex-col">
                <span className="text-caption text-accent-600 font-semibold tracking-wider uppercase">Parsed Profile</span>
                <h2 className="font-display text-subheading text-foreground mt-0.5">{selectedResume.name}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setViewingDetail(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-card space-y-section">
              
              {/* Quick stats grid */}
              <div className="grid grid-cols-3 gap-element rounded-card border border-border bg-surface p-card text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Skills Extracted</p>
                  <p className="text-score-large font-bold mt-1 text-accent-600">{selectedResume.parsedSkills.length}</p>
                </div>
                <div className="border-x border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Experience Level</p>
                  <p className="text-body font-semibold mt-2.5 capitalize">{selectedResume.experienceLevel || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Est. Years Exp</p>
                  <p className="text-score-large font-bold mt-1 text-foreground">{selectedResume.yearsOfExperience ?? "--"}</p>
                </div>
              </div>

              {/* Technical Skills Section */}
              <div className="space-y-element">
                <h3 className="font-semibold text-body border-b border-border pb-1">Technical Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedResume.parsedSkills.map((skill) => (
                    <Badge key={skill} variant="default" className="px-2.5 py-1 text-[11px]">
                      {skill}
                    </Badge>
                  ))}
                  {selectedResume.parsedSkills.length === 0 && (
                    <p className="text-caption text-muted-foreground italic">No technical skills detected.</p>
                  )}
                </div>
              </div>

              {/* Experience Timeline */}
              <div className="space-y-element">
                <h3 className="font-semibold text-body border-b border-border pb-1">Work History</h3>
                <div className="flex flex-col gap-element relative pl-4 border-l border-border ml-2">
                  {selectedResume.parsedExperience?.map((exp, idx) => (
                    <div key={idx} className="relative flex flex-col gap-1">
                      {/* Timeline dot */}
                      <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent-500 ring-4 ring-background" />
                      
                      <div className="flex items-baseline justify-between flex-wrap gap-1">
                        <h4 className="font-medium text-body text-foreground">
                          {exp.role || "Software Engineer"}
                        </h4>
                        <span className="text-caption text-muted-foreground font-medium">
                          {exp.duration || "N/A"}
                        </span>
                      </div>
                      <p className="text-caption text-accent-600 font-medium">
                        {exp.company || "Company"}
                      </p>
                      
                      {exp.highlights && exp.highlights.length > 0 ? (
                        <ul className="list-disc pl-4 text-caption text-muted-foreground mt-1 space-y-1">
                          {exp.highlights.map((highlight, hIdx) => (
                            <li key={hIdx}>{highlight}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">No highlights provided.</p>
                      )}
                    </div>
                  ))}
                  {(!selectedResume.parsedExperience || selectedResume.parsedExperience.length === 0) && (
                    <p className="text-caption text-muted-foreground italic -ml-4">No experience entries found.</p>
                  )}
                </div>
              </div>

              {/* Projects Section */}
              <div className="space-y-element">
                <h3 className="font-semibold text-body border-b border-border pb-1">Projects</h3>
                <div className="grid gap-element">
                  {selectedResume.parsedProjects?.map((proj, idx) => (
                    <div key={idx} className="rounded-button border border-border bg-surface p-card flex flex-col gap-1.5">
                      <div className="flex justify-between items-baseline flex-wrap">
                        <h4 className="font-medium text-body text-foreground">{proj.name || "Project Name"}</h4>
                      </div>
                      <p className="text-caption text-muted-foreground">{proj.description}</p>
                      {proj.technologies && proj.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {proj.technologies.map((tech) => (
                            <Badge key={tech} variant="default" className="text-[9px] px-1.5 py-0.5">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!selectedResume.parsedProjects || selectedResume.parsedProjects.length === 0) && (
                    <p className="text-caption text-muted-foreground italic">No projects found.</p>
                  )}
                </div>
              </div>

              {/* Education Section */}
              <div className="space-y-element">
                <h3 className="font-semibold text-body border-b border-border pb-1">Education</h3>
                <div className="flex flex-col gap-element">
                  {selectedResume.parsedEducation?.map((edu, idx) => (
                    <div key={idx} className="flex justify-between items-baseline flex-wrap gap-1">
                      <div>
                        <h4 className="font-medium text-body text-foreground">{edu.degree || "Degree"}</h4>
                        <p className="text-caption text-muted-foreground">{edu.institution || "Institution"}</p>
                      </div>
                      <span className="text-caption text-muted-foreground font-medium">{edu.year || "Year"}</span>
                    </div>
                  ))}
                  {(!selectedResume.parsedEducation || selectedResume.parsedEducation.length === 0) && (
                    <p className="text-caption text-muted-foreground italic">No education entries found.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="border-t border-border px-card py-4 flex gap-element justify-end bg-surface-raised">
              <Button variant="secondary" onClick={() => setViewingDetail(false)}>
                Close Profile
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 border-red-500 text-red-500 hover:bg-red-500/10"
                onClick={(e) => {
                  if (selectedResume) handleDelete(selectedResume.id, e);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete Resume
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
