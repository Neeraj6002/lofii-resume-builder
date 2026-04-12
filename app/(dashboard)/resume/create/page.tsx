"use client";
// app/(dashboard)/resume/create/page.tsx
// Updated to read pre-filled data from sessionStorage when ?import=1

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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

// ─── Inner page (needs useSearchParams) ──────────────────────
function CreateResumeInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useAuth();

  const [title,      setTitle]    = useState("My Resume");
  const [template,   setTemplate] = useState<ResumeTemplate>("classic");
  const [personal,   setPersonal] = useState<PersonalInfo>(defaultPersonal);
  const [summary,    setSummary]  = useState("");
  const [experience, setExp]      = useState<ExperienceItem[]>([blankExp()]);
  const [education,  setEdu]      = useState<EducationItem[]>([blankEdu()]);
  const [skills,     setSkills]   = useState<SkillItem[]>([blankSkill()]);
  const [projects,   setProjects] = useState<ProjectItem[]>([blankProject()]);
  const [certs,      setCerts]    = useState<CertificationItem[]>([]);
  const [saving,     setSaving]   = useState(false);
  const [imported,   setImported] = useState(false);

  // ── Load imported data if coming from /resume/new ────────────
  useEffect(() => {
    if (searchParams.get("import") !== "1") return;
    const raw = sessionStorage.getItem("import:resume");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.title)       setTitle(data.title);
      if (data.personalInfo) setPersonal(data.personalInfo);
      if (data.summary)     setSummary(data.summary);
      if (Array.isArray(data.experience) && data.experience.length > 0) setExp(data.experience);
      if (Array.isArray(data.education)  && data.education.length  > 0) setEdu(data.education);
      if (Array.isArray(data.skills)     && data.skills.length     > 0) setSkills(data.skills);
      if (Array.isArray(data.projects)   && data.projects.length   > 0) {
        // Filter out blank placeholder projects
        const realProjects = data.projects.filter((p: ProjectItem) => p.name || p.description);
        if (realProjects.length > 0) setProjects(realProjects);
      }
      if (Array.isArray(data.certifications) && data.certifications.length > 0) setCerts(data.certifications);
      setImported(true);
      sessionStorage.removeItem("import:resume");
      toast.success("Resume imported! Review and edit your details.");
    } catch {
      toast.error("Could not load imported data.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!user) return;
    if (!personal.fullName.trim()) {
      toast.error("Please enter your full name before saving.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${user.idToken}`,
        },
        body: JSON.stringify({
          title, template,
          personalInfo: personal,
          summary, summaryAiGenerated: false,
          experience, education, skills, projects,
          certifications: certs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Resume saved!");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
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
        .builder-topbar-left { display: flex; align-items: center; gap: var(--space-4); }
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

        .import-banner {
          display: flex; align-items: center; gap: var(--space-3);
          background: rgba(201,168,76,.07); border-bottom: 1px solid var(--gold-border);
          padding: var(--space-2) var(--space-5);
          font-size: var(--text-xs); color: var(--gold-light);
          flex-shrink: 0;
        }

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
        @media (max-width: 900px) {
          .builder-body { grid-template-columns: 1fr; }
          .preview-panel { display: none; }
          .template-switcher { display: none; }
        }
      `}</style>

      <div className="builder-layout">
        <header className="builder-topbar">
          <div className="builder-topbar-left">
            <Link href="/dashboard" className="back-link">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Dashboard
            </Link>
            <input
              className="title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={60}
              aria-label="Resume title"
            />
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

          <button
            className={`btn btn-primary btn-sm${saving ? " btn-loading" : ""}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "" : "Save Resume"}
          </button>
        </header>

        {/* Imported data notice */}
        {imported && (
          <div className="import-banner">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M6.5 6v3M6.5 4h.01" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            Resume imported — review your details and click Save when ready.
          </div>
        )}

        <div className="builder-body">
          <div className="form-panel">
            <ResumeForm
              resumeId=""
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
      </div>
    </>
  );
}

function CreateResumeFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}

export default function CreateResumePage() {
  return (
    <Suspense fallback={<CreateResumeFallback />}>
      <CreateResumeInner />
    </Suspense>
  );
}