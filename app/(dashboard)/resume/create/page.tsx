"use client";
// app/(dashboard)/resume/create/page.tsx

import { useState } from "react";
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
function blankCert(): CertificationItem {
  return { id: uuid(), name: "", issuer: "", date: "", credentialId: "", link: "" };
}

export default function CreateResumePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title,     setTitle]    = useState("My Resume");
  const [template,  setTemplate] = useState<ResumeTemplate>("classic");
  const [personal,  setPersonal] = useState<PersonalInfo>(defaultPersonal);
  const [summary,   setSummary]  = useState("");
  const [experience,setExp]      = useState<ExperienceItem[]>([blankExp()]);
  const [education, setEdu]      = useState<EducationItem[]>([blankEdu()]);
  const [skills,    setSkills]   = useState<SkillItem[]>([blankSkill()]);
  const [projects,  setProjects] = useState<ProjectItem[]>([blankProject()]);
  const [certs,     setCerts]    = useState<CertificationItem[]>([]);
  const [saving,    setSaving]   = useState(false);

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
          Authorization: `Bearer ${user.idToken}`,
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

        <div className="builder-body">
          <div className="form-panel">
            <ResumeForm
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