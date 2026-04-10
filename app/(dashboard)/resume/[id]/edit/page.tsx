"use client";
// app/(dashboard)/resume/[id]/edit/page.tsx

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import ResumeForm from "@/components/resume/ResumeForm";
import ResumePreview from "@/components/resume/ResumePreview";
import type {
  PersonalInfo, ExperienceItem, EducationItem,
  SkillItem, ProjectItem, CertificationItem, ResumeTemplate,
} from "@/types";

const TEMPLATES: { id: ResumeTemplate; label: string }[] = [
  { id: "classic",   label: "Classic"   },
  { id: "modern",    label: "Modern"    },
  { id: "minimal",   label: "Minimal"   },
  { id: "executive", label: "Executive" },
  { id: "creative",  label: "Creative"  },
  { id: "tech",      label: "Tech"      },
];

const defaultPersonal: PersonalInfo = {
  fullName: "", email: "", phone: "", location: "",
  linkedin: "", github: "", website: "", jobTitle: "",
};

// ─── Resume data → plain text (same as dashboard) ─────────────

function resumeDataToText(resume: {
  personalInfo?: PersonalInfo;
  summary?: string;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  skills?: SkillItem[];
  projects?: ProjectItem[];
  certifications?: CertificationItem[];
}): string {
  const lines: string[] = [];

  const p = resume.personalInfo;
  if (p) {
    if (p.fullName)  lines.push(p.fullName);
    if (p.jobTitle)  lines.push(p.jobTitle);
    if (p.email)     lines.push(p.email);
    if (p.phone)     lines.push(p.phone);
    if (p.location)  lines.push(p.location);
    if (p.linkedin)  lines.push(p.linkedin);
    if (p.github)    lines.push(p.github);
    if (p.website)   lines.push(p.website);
    lines.push("");
  }

  if (resume.summary) {
    lines.push("SUMMARY");
    lines.push(resume.summary);
    lines.push("");
  }

  if (resume.experience?.length) {
    lines.push("EXPERIENCE");
    for (const e of resume.experience) {
      if (e.role || e.company) lines.push(`${e.role ?? ""} at ${e.company ?? ""}`.trim());
      if (e.location)          lines.push(e.location);
      if (e.startDate)         lines.push(`${e.startDate} - ${e.current ? "Present" : e.endDate ?? ""}`);
      if (e.description)       lines.push(e.description);
      lines.push("");
    }
  }

  if (resume.education?.length) {
    lines.push("EDUCATION");
    for (const e of resume.education) {
      if (e.institution) lines.push(e.institution);
      if (e.degree)      lines.push(`${e.degree} ${e.field ?? ""}`.trim());
      if (e.startDate)   lines.push(`${e.startDate} - ${e.current ? "Present" : e.endDate ?? ""}`);
      if (e.description) lines.push(e.description);
      lines.push("");
    }
  }

  if (resume.skills?.length) {
    lines.push("SKILLS");
    lines.push(resume.skills.filter(s => s.name).map(s => s.name).join(", "));
    lines.push("");
  }

  if (resume.projects?.length) {
    lines.push("PROJECTS");
    for (const pr of resume.projects) {
      if (pr.name)        lines.push(pr.name);
      if (pr.tech.length) lines.push(pr.tech.join(", "));
      if (pr.description) lines.push(pr.description);
      lines.push("");
    }
  }

  if (resume.certifications?.length) {
    lines.push("CERTIFICATIONS");
    for (const c of resume.certifications) {
      if (c.name)   lines.push(c.name);
      if (c.issuer) lines.push(c.issuer);
      if (c.date)   lines.push(c.date);
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

export default function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router   = useRouter();
  const { user, getIdToken } = useAuth();

  const [resumeId,    setResumeId]    = useState<string | null>(null);
  const [fetching,    setFetching]    = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [notFound,    setNotFound]    = useState(false);
  const [reviewing,   setReviewing]   = useState(false);
  const [reviewStep,  setReviewStep]  = useState<string>("");

  // Form state
  const [title,     setTitle]    = useState("My Resume");
  const [template,  setTemplate] = useState<ResumeTemplate>("classic");
  const [personal,  setPersonal] = useState<PersonalInfo>(defaultPersonal);
  const [summary,   setSummary]  = useState("");
  const [experience,setExp]      = useState<ExperienceItem[]>([]);
  const [education, setEdu]      = useState<EducationItem[]>([]);
  const [skills,    setSkills]   = useState<SkillItem[]>([]);
  const [projects,  setProjects] = useState<ProjectItem[]>([]);
  const [certs,     setCerts]    = useState<CertificationItem[]>([]);

  // ── Resolve params ─────────────────────────────────────────
  useEffect(() => {
    params.then(({ id }) => setResumeId(id));
  }, [params]);

  // ── Fetch resume ───────────────────────────────────────────
  const fetchResume = useCallback(async () => {
    if (!user || !resumeId) return;
    setFetching(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        setFetching(false);
        return;
      }
      const res  = await fetch(`/api/resume/${resumeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) { setNotFound(true); return; }
      if (res.status === 403) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Failed to load");

      const { resume } = await res.json();

      setTitle(resume.title ?? "My Resume");
      setTemplate(resume.template ?? "classic");
      setPersonal(resume.personalInfo ?? defaultPersonal);
      setSummary(resume.summary ?? "");
      setExp(resume.experience?.length   ? resume.experience   : [blankExp()]);
      setEdu(resume.education?.length    ? resume.education    : [blankEdu()]);
      setSkills(resume.skills?.length    ? resume.skills       : [blankSkill()]);
      setProjects(resume.projects?.length ? resume.projects    : [blankProject()]);
      setCerts(resume.certifications     ?? []);
    } catch {
      toast.error("Could not load resume. Please try again.");
    } finally {
      setFetching(false);
    }
  }, [user, resumeId, getIdToken]);

  useEffect(() => {
    if (user && resumeId) fetchResume();
  }, [user, resumeId, fetchResume]);

  // ── Save (PATCH) ───────────────────────────────────────────
  async function handleSave() {
    if (!user || !resumeId) return;
    if (!personal.fullName.trim()) {
      toast.error("Please enter your full name before saving.");
      return;
    }

    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        return;
      }
      const res = await fetch(`/api/resume/${resumeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title, template,
          personalInfo: personal,
          summary, experience, education, skills, projects,
          certifications: certs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }

      toast.success("Resume updated!");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Review — uses the current in-memory resume state ───────
  async function handleReview() {
    if (!user || !resumeId) return;

    setReviewing(true);
    try {
      setReviewStep("Preparing…");
      const token = await getIdToken();
      if (!token) throw new Error("Session expired.");

      let resumeText = resumeDataToText({
        personalInfo: personal,
        summary,
        experience,
        education,
        skills,
        projects,
        certifications: certs,
      });

      if (!resumeText || resumeText.length < 50) {
        throw new Error("Resume has too little content to review. Please fill in more details first.");
      }
      if (resumeText.length > 15000) resumeText = resumeText.slice(0, 15000);

      setReviewStep("Analysing with AI…");
      const res  = await fetch("/api/ai/review-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ resumeText, resumeId }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) throw new Error("Too many review requests. Please wait.");
        if (res.status === 503) throw new Error("AI service temporarily unavailable.");
        throw new Error(data.error ?? "Review failed.");
      }

      const reviewId = crypto.randomUUID();
      sessionStorage.setItem(`review:${reviewId}`, JSON.stringify({
        ...data,
        fileName:   title,
        reviewedAt: new Date().toISOString(),
        resumeId,
      }));

      router.push(`/review/${reviewId}`);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setReviewing(false);
      setReviewStep("");
    }
  }

  // ── Not found ──────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "var(--space-4)", background: "var(--bg-base)",
      }}>
        <div className="bg-mesh" />
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
          Resume not found
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          This resume doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link href="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .builder-layout {
          display: flex; flex-direction: column;
          height: 100vh; overflow: hidden;
        }
        .builder-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 var(--space-5);
          height: var(--nav-height);
          background: var(--bg-overlay); backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0; z-index: var(--z-sticky);
        }
        .builder-topbar-left  { display: flex; align-items: center; gap: var(--space-4); }
        .builder-topbar-right { display: flex; align-items: center; gap: var(--space-2); }
        .back-link {
          color: var(--text-secondary); text-decoration: none;
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-sm); transition: color var(--duration-base);
        }
        .back-link:hover { color: var(--text-primary); }
        .title-input {
          background: transparent; border: none; outline: none;
          font-family: var(--font-body); font-size: var(--text-base);
          font-weight: 600; color: var(--text-primary);
          width: 180px; border-bottom: 1px solid transparent;
          transition: border-color var(--duration-base); padding-bottom: 2px;
        }
        .title-input:focus { border-bottom-color: var(--gold); }
        .template-switcher { display: flex; align-items: center; gap: var(--space-2); }
        .tmpl-btn {
          padding: 4px 10px; border-radius: var(--radius-sm);
          font-size: var(--text-xs); font-weight: 500;
          background: transparent; border: 1px solid var(--border);
          color: var(--text-secondary); cursor: pointer;
          transition: all var(--duration-fast);
        }
        .tmpl-btn:hover  { border-color: var(--border-hover); color: var(--text-primary); }
        .tmpl-btn.active { background: var(--gold-dim); border-color: var(--gold-border); color: var(--gold-light); }
        .builder-body {
          display: grid; grid-template-columns: 420px 1fr;
          flex: 1; overflow: hidden;
        }
        .form-panel {
          display: flex; flex-direction: column;
          border-right: 1px solid var(--border); overflow: hidden;
        }
        .preview-panel {
          background: #e8e8e0; overflow-y: auto;
          display: flex; align-items: flex-start; justify-content: center;
          padding: var(--space-8) var(--space-6);
        }
        .builder-loading {
          flex: 1; display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: var(--space-4);
        }
        .edit-badge {
          font-size: var(--text-xs); font-weight: 600;
          padding: 3px 8px; border-radius: var(--radius-sm);
          background: var(--info-dim); color: var(--info);
          border: 1px solid rgba(96,165,250,.2);
        }
        .reviewing-status {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-xs); color: var(--text-secondary);
          padding: 0 var(--space-2);
        }
        @media (max-width: 900px) {
          .builder-body { grid-template-columns: 1fr; }
          .preview-panel { display: none; }
          .template-switcher { display: none; }
        }
      `}</style>

      <div className="builder-layout">

        {/* ── Topbar ──────────────────────────────────────── */}
        <header className="builder-topbar">
          <div className="builder-topbar-left">
            <Link href="/dashboard" className="back-link">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Dashboard
            </Link>
            <span className="edit-badge">Editing</span>
            {!fetching && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                {user?.unlockedResumes?.includes(resumeId || "") && (
                  <div title="Premium Resume" style={{ color: "var(--gold)", display: "flex", alignItems: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1l1.35 2.73 3.01.44-2.18 2.12.51 3-2.69-1.42L3.31 9.29l.51-3L1.64 4.17l3.01-.44z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <input
                  className="title-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={60}
                  aria-label="Resume title"
                />
              </div>
            )}
          </div>

          <div className="template-switcher">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                className={`tmpl-btn${template === t.id ? " active" : ""}`}
                onClick={() => setTemplate(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="builder-topbar-right">
            {/* Review button — reviews the resume as currently built */}
            {reviewing ? (
              <div className="reviewing-status">
                <span className="spinner" style={{ width: 13, height: 13 }} />
                <span>{reviewStep || "Reviewing…"}</span>
              </div>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleReview}
                disabled={fetching || saving}
                title="Review this resume with AI"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6.5 4v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Review
              </button>
            )}

            <button
              className={`btn btn-primary btn-sm${saving ? " btn-loading" : ""}`}
              onClick={handleSave}
              disabled={saving || fetching}
            >
              {saving ? "" : "Save Changes"}
            </button>
          </div>
        </header>

        {/* ── Body ────────────────────────────────────────── */}
        {fetching ? (
          <div className="builder-loading">
            <span className="spinner" style={{ width: 28, height: 28 }} />
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Loading your resume…
            </p>
          </div>
        ) : (
          <div className="builder-body">
            <div className="form-panel">
              <ResumeForm
                resumeId={resumeId || ""}
                personal={personal}
                summary={summary}
                experience={experience}
                education={education}
                skills={skills}
                projects={projects}
                certs={certs}
                onPersonalChange={setPersonal}
                onSummaryChange={setSummary}
                onExpChange={setExp}
                onEduChange={setEdu}
                onSkillsChange={setSkills}
                onProjectsChange={setProjects}
                onCertsChange={setCerts}
              />
            </div>
            <div className="preview-panel">
              <ResumePreview
                template={template}
                personal={personal}
                summary={summary}
                experience={experience}
                education={education}
                skills={skills}
                projects={projects}
                certifications={certs}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Blank item helpers ───────────────────────────────────────
function blankExp(): ExperienceItem {
  return { id: uuid(), company: "", role: "", location: "", startDate: "", endDate: "", current: false, description: "", aiGenerated: false };
}
function blankEdu(): EducationItem {
  return { id: uuid(), institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", current: false, description: "", aiGenerated: false };
}
function blankSkill(): SkillItem {
  return { id: uuid(), name: "", level: "intermediate", category: "" };
}
function blankProject(): ProjectItem {
  return { id: uuid(), name: "", description: "", tech: [], link: "", githubLink: "", aiGenerated: false };
}