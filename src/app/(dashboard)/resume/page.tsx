"use client";

import { useState, useEffect, useRef, type ReactElement, type ChangeEvent, type DragEvent } from "react";
import { 
  FileUser, 
  Upload, 
  Trash2, 
  Eye, 
  Loader2, 
  Sparkles, 
  FileText, 
  X, 
  AlertCircle,
  Search,
  ArrowUpDown,
  Calendar,
  Briefcase,
  GraduationCap,
  FolderKanban
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
  const [viewingUploadDrawer, setViewingUploadDrawer] = useState<boolean>(false);
  const [fetchingDetailId, setFetchingDetailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "name">("recent");

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
        setViewingUploadDrawer(false);
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

  // Filter & Sort
  const filteredResumes = resumes
    .filter((resume) => {
      const query = searchQuery.toLowerCase();
      return (
        resume.name.toLowerCase().includes(query) ||
        (resume.experienceLevel && resume.experienceLevel.toLowerCase().includes(query)) ||
        resume.parsedSkills.some((skill) => skill.toLowerCase().includes(query))
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
          <h2 className="font-display text-4xl font-bold text-foreground">Resume Library</h2>
        </div>
        <button
          onClick={() => setViewingUploadDrawer(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-all active:scale-95 hover:shadow-sm border border-transparent cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          Upload Resume
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
            placeholder="Search resumes by skill, title, or level..."
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

      {/* Resume Catalog Grid */}
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
        ) : filteredResumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-stack-lg border border-dashed border-border rounded-lg bg-card/50 text-center py-16">
            <FileUser className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="font-display text-xl font-bold text-foreground mb-1">No Resumes Found</h3>
            <p className="font-body-md text-body-md text-muted-foreground max-w-md mb-6">
              Upload your resume PDFs or paste raw text to let our AI personalize your mock interview scenarios.
            </p>
            <Button onClick={() => setViewingUploadDrawer(true)} className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload Your First Resume
            </Button>
          </div>
        ) : (
          filteredResumes.map((resume) => (
            <div
              key={resume.id}
              onClick={() => handleViewDetails(resume.id)}
              className="group bg-card border border-border rounded-lg p-stack-md flex items-center justify-between transition-all duration-300 hover:border-brand-500/40 hover:shadow-[0_0_20px_rgba(242,106,46,0.04)] cursor-pointer relative overflow-hidden"
            >
              {resume.experienceLevel && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 opacity-55"></div>
              )}
              {/* Left: Metadata */}
              <div className="flex flex-col gap-2 pl-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-display text-lg font-bold text-foreground group-hover:text-brand-700 transition-colors">
                    {resume.name}
                  </h3>
                  {resume.experienceLevel && (
                    <span className="px-2 py-0.5 rounded-full bg-muted border border-border font-label-sm text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {resume.experienceLevel}
                    </span>
                  )}
                  {resume.yearsOfExperience !== null && resume.yearsOfExperience !== 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-accent-500/10 border border-accent-500/20 font-label-sm text-[10px] text-accent-600 uppercase tracking-wider font-semibold">
                      {resume.yearsOfExperience} Yrs Exp
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-muted-foreground font-body-md text-label-sm">
                  {resume.parsedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-w-lg">
                      {resume.parsedSkills.slice(0, 6).map((skill) => (
                        <span key={skill} className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium border border-border">
                          {skill}
                        </span>
                      ))}
                      {resume.parsedSkills.length > 6 && (
                        <span className="text-[10px] text-muted-foreground font-semibold self-center pl-1">
                          +{resume.parsedSkills.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground/80 font-medium ml-auto">
                    <Calendar className="h-4 w-4" />
                    Added {new Date(resume.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleViewDetails(resume.id)}
                    className="p-2 text-muted-foreground hover:text-brand-700 transition-colors rounded-lg hover:bg-muted cursor-pointer"
                    title="View details"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(resume.id, e)}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10 cursor-pointer"
                    title="Delete resume"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto pt-stack-md border-t border-border flex justify-between items-center text-muted-foreground/80 font-label-sm text-label-sm shrink-0 font-medium">
        <span>Showing {filteredResumes.length} of {resumes.length} Resumes</span>
      </div>

      {/* Profile Details Side-Drawer */}
      {viewingDetail && selectedResume && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setViewingDetail(false)} />
          
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl transition-all duration-300 ease-out border-l border-border z-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-card py-4 bg-muted/40">
              <div className="flex flex-col">
                <span className="text-caption text-brand-700 font-semibold tracking-wider uppercase">Parsed Profile</span>
                <h2 className="font-display text-xl font-bold text-foreground mt-0.5">{selectedResume.name}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer" onClick={() => setViewingDetail(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-card space-y-stack-lg">
              {/* Quick stats grid */}
              <div className="grid grid-cols-3 gap-element rounded-lg border border-border bg-card p-card text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Skills Extracted</p>
                  <p className="text-3xl font-bold mt-1 text-brand-700">{selectedResume.parsedSkills.length}</p>
                </div>
                <div className="border-x border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Experience Level</p>
                  <p className="text-body font-semibold mt-2.5 capitalize">{selectedResume.experienceLevel || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Est. Years Exp</p>
                  <p className="text-3xl font-bold mt-1 text-foreground">{selectedResume.yearsOfExperience ?? "--"}</p>
                </div>
              </div>

              {/* Technical Skills Section */}
              <div className="space-y-element">
                <h3 className="font-semibold text-body border-b border-border pb-1">Technical Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedResume.parsedSkills.map((skill) => (
                    <Badge key={skill} variant="default" className="px-2.5 py-1 text-[11px] bg-muted hover:bg-muted border border-border text-foreground font-medium">
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
                <div className="flex flex-col gap-element relative pl-4 border-l border-border ml-2 mt-4">
                  {selectedResume.parsedExperience?.map((exp, idx) => (
                    <div key={idx} className="relative flex flex-col gap-1 pb-4">
                      {/* Timeline dot */}
                      <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-background" />
                      
                      <div className="flex items-baseline justify-between flex-wrap gap-1">
                        <h4 className="font-bold text-body text-foreground">
                          {exp.role || "Software Engineer"}
                        </h4>
                        <span className="text-caption text-muted-foreground font-semibold">
                          {exp.duration || "N/A"}
                        </span>
                      </div>
                      <p className="text-caption text-brand-700 font-semibold flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
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
                    <div key={idx} className="rounded-lg border border-border bg-card p-card flex flex-col gap-1.5">
                      <div className="flex justify-between items-baseline flex-wrap">
                        <h4 className="font-bold text-body text-foreground flex items-center gap-1.5">
                          <FolderKanban className="h-4 w-4 text-accent-600" />
                          {proj.name || "Project Name"}
                        </h4>
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
                    <div key={idx} className="flex justify-between items-baseline flex-wrap gap-1 bg-card border border-border rounded-lg p-card">
                      <div>
                        <h4 className="font-bold text-body text-foreground flex items-center gap-1.5">
                          <GraduationCap className="h-4 w-4 text-accent-600" />
                          {edu.degree || "Degree"}
                        </h4>
                        <p className="text-caption text-muted-foreground pl-5.5">{edu.institution || "Institution"}</p>
                      </div>
                      <span className="text-caption text-muted-foreground font-semibold">{edu.year || "Year"}</span>
                    </div>
                  ))}
                  {(!selectedResume.parsedEducation || selectedResume.parsedEducation.length === 0) && (
                    <p className="text-caption text-muted-foreground italic">No education entries found.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-card py-4 flex gap-element justify-end bg-muted/40">
              <Button variant="secondary" className="cursor-pointer" onClick={() => setViewingDetail(false)}>
                Close Profile
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 border-red-500 text-red-500 hover:bg-red-500/10 cursor-pointer"
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

      {/* Upload New Resume Side-Drawer */}
      {viewingUploadDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setViewingUploadDrawer(false)} />
          
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl transition-all duration-300 ease-out border-l border-border z-10">
            {submitting && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-brand-500" aria-hidden />
                <p className="mt-4 font-semibold text-heading">{parserStep}</p>
                <p className="mt-1 text-caption text-muted-foreground">This can take up to 20 seconds</p>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-card py-4 bg-muted/40">
              <div className="flex flex-col">
                <span className="text-caption text-brand-700 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> Create Profile
                </span>
                <h2 className="font-display text-xl font-bold text-foreground mt-0.5">Add New Resume</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer" onClick={() => setViewingUploadDrawer(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-card space-y-stack-md">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resume-name">Resume Profile Name</Label>
                  <Input
                    id="resume-name"
                    placeholder="e.g. Senior Frontend Engineer Resume"
                    value={resumeName}
                    onChange={(e) => setResumeName(e.target.value)}
                    required
                  />
                </div>

                <div className="mt-2">
                  <div className="flex rounded-lg border border-border bg-card p-0.5">
                    <button
                      type="button"
                      className={`flex-1 rounded-[6px] py-1.5 text-center text-caption font-medium transition-all cursor-pointer ${
                        uploadMode === "file"
                          ? "bg-muted text-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setUploadMode("file")}
                    >
                      PDF Upload
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded-[6px] py-1.5 text-center text-caption font-medium transition-all cursor-pointer ${
                        uploadMode === "text"
                          ? "bg-muted text-foreground shadow-sm font-semibold"
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
                      className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-all ${
                        dragActive
                          ? "border-brand-500 bg-brand-500/5 scale-[0.99]"
                          : "border-border bg-muted/20 hover:bg-muted/40"
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
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-700 mb-3">
                        <Upload className="h-6 w-6" aria-hidden />
                      </div>
                      <p className="font-semibold text-body">
                        {selectedFile ? selectedFile.name : "Drag & drop your PDF resume"}
                      </p>
                      <p className="text-caption text-muted-foreground mt-1 font-medium">
                        {selectedFile
                          ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                          : "Supports PDF format up to 5MB"}
                      </p>
                      {!selectedFile && (
                        <Button type="button" variant="secondary" size="sm" className="mt-4 cursor-pointer">
                          Browse Files
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 flex-1 min-h-[250px]">
                    <Label htmlFor="resume-text">Resume Raw Text</Label>
                    <textarea
                      id="resume-text"
                      placeholder="Paste your full resume text details here..."
                      className="flex-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-body shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[200px]"
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-card py-4 flex gap-element justify-end bg-muted/40 shrink-0">
                <Button type="button" variant="secondary" className="cursor-pointer" onClick={() => setViewingUploadDrawer(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white cursor-pointer" disabled={submitting}>
                  {submitting ? "Processing..." : "Parse & Save Resume"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
