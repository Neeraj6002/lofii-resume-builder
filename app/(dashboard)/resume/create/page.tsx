"use client";
// app/(dashboard)/resume/create/page.tsx
// ============================================================
// RESUME BUILDER
// Left: multi-section form (Personal Info, Summary, Experience,
//        Education, Skills, Projects, Certifications)
// Right: live resume preview (switches between 6 templates)
// AI: generates content per section via /api/ai/generate-content
// Save: POST /api/resume
// ============================================================

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import type {
  PersonalInfo, ExperienceItem, EducationItem,
  SkillItem, ProjectItem, CertificationItem, ResumeTemplate,
} from "@/types";

// ─── Default values ───────────────────────────────────────────
const defaultPersonal: PersonalInfo = {
  fullName: "", email: "", phone: "", location: "",
  linkedin: "", github: "", website: "", jobTitle: "",
};

const blankExp = (): ExperienceItem => ({
  id: uuid(), company: "", role: "", location: "",
  startDate: "", endDate: "", current: false,
  description: "", aiGenerated: false,
});

const blankEdu = (): EducationItem => ({
  id: uuid(), institution: "", degree: "", field: "",
  location: "", startDate: "", endDate: "", current: false,
  description: "", aiGenerated: false,
});

const blankSkill = (): SkillItem => ({
  id: uuid(), name: "", level: "intermediate", category: "",
});

const blankProject = (): ProjectItem => ({
  id: uuid(), name: "", description: "", tech: [],
  link: "", githubLink: "", aiGenerated: false,
});

const blankCert = (): CertificationItem => ({
  id: uuid(), name: "", issuer: "", date: "",
  credentialId: "", link: "",
});

const TEMPLATES: { id: ResumeTemplate; label: string }[] = [
  { id: "classic",   label: "Classic"   },
  { id: "modern",    label: "Modern"    },
  { id: "minimal",   label: "Minimal"   },
  { id: "executive", label: "Executive" },
  { id: "creative",  label: "Creative"  },
  { id: "tech",      label: "Tech"      },
];

const SECTIONS = [
  "personal", "summary", "experience",
  "education", "skills", "projects", "certifications",
] as const;
type Section = typeof SECTIONS[number];

const SECTION_LABELS: Record<Section, string> = {
  personal: "Personal Info", summary: "Summary",
  experience: "Experience", education: "Education",
  skills: "Skills", projects: "Projects", certifications: "Certifications",
};

// ─── AI generate helper ───────────────────────────────────────
async function aiGenerate(
  type: string,
  context: Record<string, string>,
  getIdToken: () => Promise<string | null>
): Promise<string> {
  const token = await getIdToken();
  if (!token) throw new Error("UNAUTHORIZED");

  const res = await fetch("/api/ai/generate-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, context }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.code === "PREMIUM_REQUIRED") throw new Error("PREMIUM");
    throw new Error(data.error ?? "AI error");
  }
  return data.content as string;
}

// ─── Small reusable field components ─────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function AIButton({
  loading, onClick, premium, small,
}: {
  loading: boolean; onClick: () => void; premium: boolean; small?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn-ai${small ? " btn-ai-sm" : ""}${loading ? " btn-ai-loading" : ""}`}
      onClick={onClick}
      disabled={loading}
      title={premium ? "Generate with AI" : "Preview AI (free) — upgrade for full access"}
    >
      {loading ? (
        <span className="spinner" style={{ width: 12, height: 12 }} />
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.2 3.8H11L8.1 7.1l1.1 3.4L6 8.4l-3.2 2.1 1.1-3.4L1 4.8h3.8L6 1z"
              fill="currentColor"/>
          </svg>
          {premium ? "AI Write" : "AI Preview"}
        </>
      )}
    </button>
  );
}

// ─── Resume Preview ───────────────────────────────────────────
function ResumePreview({
  template, personal, summary, experience, education, skills, projects,
}: {
  template: ResumeTemplate;
  personal: PersonalInfo;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillItem[];
  projects: ProjectItem[];
}) {
  const accent = {
    classic: "#1a1a2e", modern: "#2563eb", minimal: "#374151",
    executive: "#7c3aed", creative: "#db2777", tech: "#059669",
  }[template];

  const name = personal.fullName || "Your Name";
  const role = personal.jobTitle || "Your Job Title";

  return (
    <div className="preview-doc" data-template={template}>
      {/* Header */}
      <div className="prev-header" style={{ borderBottom: `3px solid ${accent}` }}>
        <div className="prev-name" style={{ color: accent }}>{name}</div>
        <div className="prev-role">{role}</div>
        <div className="prev-contacts">
          {personal.email    && <span>{personal.email}</span>}
          {personal.phone    && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
          {personal.linkedin && <span>LinkedIn</span>}
          {personal.github   && <span>GitHub</span>}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="prev-section">
          <div className="prev-section-title" style={{ color: accent }}>SUMMARY</div>
          <p className="prev-body">{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.filter(e => e.company || e.role).length > 0 && (
        <div className="prev-section">
          <div className="prev-section-title" style={{ color: accent }}>EXPERIENCE</div>
          {experience.filter(e => e.company || e.role).map(exp => (
            <div key={exp.id} className="prev-entry">
              <div className="prev-entry-header">
                <div>
                  <div className="prev-entry-title">{exp.role || "Role"}</div>
                  <div className="prev-entry-sub">{exp.company}</div>
                </div>
                <div className="prev-entry-date">
                  {exp.startDate} {exp.startDate && "—"} {exp.current ? "Present" : exp.endDate}
                </div>
              </div>
              {exp.description && (
                <div className="prev-body prev-bullets">
                  {exp.description.split("\n").filter(Boolean).map((line, i) => (
                    <div key={i} className="prev-bullet">• {line.replace(/^[-•]\s*/, "")}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {education.filter(e => e.institution).length > 0 && (
        <div className="prev-section">
          <div className="prev-section-title" style={{ color: accent }}>EDUCATION</div>
          {education.filter(e => e.institution).map(edu => (
            <div key={edu.id} className="prev-entry">
              <div className="prev-entry-header">
                <div>
                  <div className="prev-entry-title">{edu.institution}</div>
                  <div className="prev-entry-sub">{edu.degree} {edu.field && `in ${edu.field}`}</div>
                </div>
                <div className="prev-entry-date">
                  {edu.startDate} {edu.startDate && "—"} {edu.current ? "Present" : edu.endDate}
                </div>
              </div>
              {edu.description && <p className="prev-body">{edu.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {skills.filter(s => s.name).length > 0 && (
        <div className="prev-section">
          <div className="prev-section-title" style={{ color: accent }}>SKILLS</div>
          <div className="prev-skills">
            {skills.filter(s => s.name).map(s => (
              <span key={s.id} className="prev-skill-pill" style={{ borderColor: accent, color: accent }}>
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.filter(p => p.name).length > 0 && (
        <div className="prev-section">
          <div className="prev-section-title" style={{ color: accent }}>PROJECTS</div>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} className="prev-entry">
              <div className="prev-entry-title">{proj.name}</div>
              {proj.tech.length > 0 && (
                <div className="prev-entry-sub">{proj.tech.join(" · ")}</div>
              )}
              {proj.description && (
                <div className="prev-body prev-bullets">
                  {proj.description.split("\n").filter(Boolean).map((line, i) => (
                    <div key={i} className="prev-bullet">• {line.replace(/^[-•]\s*/, "")}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Watermark if empty */}
      {!personal.fullName && !summary && experience.length === 0 && (
        <div className="prev-watermark">
          Your resume will appear here as you fill in the form →
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function CreateResumePage() {
  const router      = useRouter();
  const { user, getIdToken }    = useAuth();
  const isPremium   = user?.isPremium ?? false;

  // Form state
  const [title,     setTitle]    = useState("My Resume");
  const [template,  setTemplate] = useState<ResumeTemplate>("classic");
  const [section,   setSection]  = useState<Section>("personal");
  const [personal,  setPersonal] = useState<PersonalInfo>(defaultPersonal);
  const [summary,   setSummary]  = useState("");
  const [experience,setExp]      = useState<ExperienceItem[]>([blankExp()]);
  const [education, setEdu]      = useState<EducationItem[]>([blankEdu()]);
  const [skills,    setSkills]   = useState<SkillItem[]>([blankSkill()]);
  const [projects,  setProjects] = useState<ProjectItem[]>([blankProject()]);
  const [certs,     setCerts]    = useState<CertificationItem[]>([]);

  // UI state
  const [saving,    setSaving]   = useState(false);
  const [aiLoading, setAiLoading]= useState<string | null>(null); // key of loading item

  // ── Save resume ─────────────────────────────────────────────
  async function handleSave() {
    if (!user) return;
    if (!personal.fullName.trim()) {
      toast.error("Please enter your full name before saving.");
      setSection("personal");
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
          title,
          template,
          personalInfo: personal,
          summary,
          summaryAiGenerated: false,
          experience,
          education,
          skills,
          projects,
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

  // ── AI: generate summary ────────────────────────────────────
  async function handleAISummary() {
    if (!user) return;
    setAiLoading("summary");
    try {
      const content = await aiGenerate("summary", {
        jobTitle:   personal.jobTitle,
        skills:     skills.map(s => s.name).filter(Boolean).join(", "),
        yearsExp:   experience.length > 0 ? `${experience.length}+` : "0",
        industry:   "",
        targetRole: personal.jobTitle,
        __preview:  isPremium ? "false" : "true",
      }, getIdToken);
      setSummary(content);
      toast.success(isPremium ? "Summary generated!" : "Preview generated — upgrade for full access.");
    } catch (err: unknown) {
      if ((err as Error).message === "PREMIUM") {
        toast.error("Premium required for full AI generation.");
      } else {
        toast.error("AI unavailable. Try again.");
      }
    } finally {
      setAiLoading(null);
    }
  }

  // ── AI: generate experience bullet points ───────────────────
  async function handleAIExp(exp: ExperienceItem) {
    if (!user) return;
    setAiLoading(`exp-${exp.id}`);
    try {
      const content = await aiGenerate("experience", {
        company:          exp.company,
        role:             exp.role,
        duration:         `${exp.startDate} - ${exp.current ? "Present" : exp.endDate}`,
        responsibilities: "",
        tech:             "",
        achievements:     "",
        __preview:        isPremium ? "false" : "true",
      }, getIdToken);
      setExp(prev => prev.map(e =>
        e.id === exp.id ? { ...e, description: content, aiGenerated: true } : e
      ));
      toast.success(isPremium ? "Bullets generated!" : "Preview generated — upgrade for full.");
    } catch (err: unknown) {
      if ((err as Error).message === "PREMIUM") toast.error("Premium required.");
      else toast.error("AI unavailable. Try again.");
    } finally {
      setAiLoading(null);
    }
  }

  // ── AI: generate project description ───────────────────────
  async function handleAIProject(proj: ProjectItem) {
    if (!user) return;
    setAiLoading(`proj-${proj.id}`);
    try {
      const content = await aiGenerate("project", {
        name:        proj.name,
        description: proj.description,
        tech:        proj.tech.join(", "),
        impact:      "",
        __preview:   isPremium ? "false" : "true",
      }, getIdToken);
      setProjects(prev => prev.map(p =>
        p.id === proj.id ? { ...p, description: content, aiGenerated: true } : p
      ));
      toast.success(isPremium ? "Description generated!" : "Preview generated — upgrade for full.");
    } catch (err: unknown) {
      if ((err as Error).message === "PREMIUM") toast.error("Premium required.");
      else toast.error("AI unavailable. Try again.");
    } finally {
      setAiLoading(null);
    }
  }

  // ── Update personal field ────────────────────────────────────
  const updatePersonal = useCallback((key: keyof PersonalInfo, val: string) => {
    setPersonal(prev => ({ ...prev, [key]: val }));
  }, []);

  return (
    <>
      <style>{`
        /* ── Layout ── */
        .builder-layout {
          display: flex; flex-direction: column; height: 100vh; overflow: hidden;
        }

        /* ── Topbar ── */
        .builder-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 var(--space-5);
          height: var(--nav-height);
          background: var(--bg-overlay); backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0; z-index: var(--z-sticky);
        }
        .builder-topbar-left { display: flex; align-items: center; gap: var(--space-4); }
        .back-link { color: var(--text-secondary); text-decoration: none; display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); transition: color var(--duration-base); }
        .back-link:hover { color: var(--text-primary); }
        .title-input {
          background: transparent; border: none; outline: none;
          font-family: var(--font-body); font-size: var(--text-base);
          font-weight: 600; color: var(--text-primary);
          width: 180px; border-bottom: 1px solid transparent;
          transition: border-color var(--duration-base);
          padding-bottom: 2px;
        }
        .title-input:focus { border-bottom-color: var(--gold); }

        /* Template switcher */
        .template-switcher { display: flex; align-items: center; gap: var(--space-2); }
        .tmpl-btn {
          padding: 4px 10px; border-radius: var(--radius-sm);
          font-size: var(--text-xs); font-weight: 500;
          background: transparent; border: 1px solid var(--border);
          color: var(--text-secondary); cursor: pointer;
          transition: all var(--duration-fast);
        }
        .tmpl-btn:hover { border-color: var(--border-hover); color: var(--text-primary); }
        .tmpl-btn.active { background: var(--gold-dim); border-color: var(--gold-border); color: var(--gold-light); }

        /* ── Body (form + preview) ── */
        .builder-body {
          display: grid; grid-template-columns: 420px 1fr;
          flex: 1; overflow: hidden;
        }

        /* ── Form panel ── */
        .form-panel {
          display: flex; flex-direction: column;
          border-right: 1px solid var(--border);
          overflow: hidden;
        }

        /* Section nav */
        .section-nav {
          display: flex; gap: 2px; padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border);
          overflow-x: auto; flex-shrink: 0;
          scrollbar-width: none;
        }
        .section-nav::-webkit-scrollbar { display: none; }
        .snav-btn {
          padding: 5px 10px; border-radius: var(--radius-sm);
          font-size: var(--text-xs); font-weight: 500;
          background: transparent; border: none;
          color: var(--text-secondary); cursor: pointer; white-space: nowrap;
          transition: background var(--duration-fast), color var(--duration-fast);
        }
        .snav-btn:hover  { background: var(--bg-elevated); color: var(--text-primary); }
        .snav-btn.active { background: var(--bg-elevated); color: var(--gold-light); }

        /* Form scroll area */
        .form-scroll {
          flex: 1; overflow-y: auto; padding: var(--space-5) var(--space-5);
          scrollbar-width: thin;
        }

        /* Fields */
        .field { margin-bottom: var(--space-4); }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
        .field-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3); }

        /* AI button */
        .btn-ai {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: var(--radius-sm);
          font-size: var(--text-xs); font-weight: 600;
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          color: var(--gold-light); cursor: pointer;
          transition: all var(--duration-fast);
        }
        .btn-ai:hover:not(:disabled) { background: rgba(201,168,76,.25); }
        .btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ai-sm { padding: 3px 8px; font-size: 0.68rem; }
        .ai-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }

        /* Entry card (experience/education/project/cert) */
        .entry-card {
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: var(--space-4);
          margin-bottom: var(--space-4); position: relative;
        }
        .entry-remove {
          position: absolute; top: var(--space-3); right: var(--space-3);
          background: none; border: none; cursor: pointer;
          color: var(--text-disabled); transition: color var(--duration-fast); padding: 2px;
        }
        .entry-remove:hover { color: var(--error); }

        .add-btn {
          display: flex; align-items: center; gap: var(--space-2);
          width: 100%; padding: var(--space-3);
          background: transparent; border: 1px dashed var(--border);
          border-radius: var(--radius-md);
          font-size: var(--text-sm); color: var(--text-secondary);
          cursor: pointer; transition: all var(--duration-fast);
          justify-content: center;
        }
        .add-btn:hover { border-color: var(--gold-border); color: var(--gold-light); }

        /* Checkbox row */
        .check-row { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
        .check-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--gold); cursor: pointer; }
        .check-row label { font-size: var(--text-sm); color: var(--text-secondary); cursor: pointer; }

        /* Skill row */
        .skill-row { display: grid; grid-template-columns: 1fr 140px 32px; gap: var(--space-2); align-items: center; margin-bottom: var(--space-2); }

        /* ── Preview panel ── */
        .preview-panel {
          background: #e8e8e0;
          overflow-y: auto; display: flex;
          align-items: flex-start; justify-content: center;
          padding: var(--space-8) var(--space-6);
        }
        .preview-doc {
          background: #fff; width: 100%; max-width: 680px;
          min-height: 900px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.2);
          padding: 48px 52px; font-family: 'Georgia', serif;
          font-size: 10px; line-height: 1.5; color: #1a1a1a;
        }
        .prev-header { padding-bottom: 12px; margin-bottom: 14px; text-align: center; }
        .prev-name   { font-size: 22px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 3px; }
        .prev-role   { font-size: 11px; color: #555; margin-bottom: 6px; }
        .prev-contacts { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; font-size: 9px; color: #666; }
        .prev-contacts span::before { content: ""; }

        .prev-section { margin-bottom: 16px; }
        .prev-section-title { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; margin-bottom: 6px; padding-bottom: 2px; border-bottom: 1px solid currentColor; }
        .prev-entry { margin-bottom: 10px; }
        .prev-entry-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px; }
        .prev-entry-title  { font-size: 10px; font-weight: 700; }
        .prev-entry-sub    { font-size: 9px; color: #555; }
        .prev-entry-date   { font-size: 9px; color: #666; white-space: nowrap; margin-left: 8px; }
        .prev-body   { font-size: 9.5px; color: #333; line-height: 1.55; }
        .prev-bullets { display: flex; flex-direction: column; gap: 2px; margin-top: 3px; }
        .prev-bullet  { padding-left: 6px; }
        .prev-skills  { display: flex; flex-wrap: wrap; gap: 5px; }
        .prev-skill-pill { font-size: 8.5px; padding: 2px 7px; border: 1px solid; border-radius: 99px; }
        .prev-watermark {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          font-size: 11px; color: #bbb; text-align: center; pointer-events: none;
          width: 200px; line-height: 1.6;
        }
        .preview-doc { position: relative; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .builder-body { grid-template-columns: 1fr; }
          .preview-panel { display: none; }
          .builder-topbar .template-switcher { display: none; }
        }
      `}</style>

      <div className="builder-layout">

        {/* ── Topbar ─────────────────────────────────────── */}
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

          {/* Template switcher */}
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

          {/* ── Form panel ─────────────────────────────── */}
          <div className="form-panel">

            {/* Section nav */}
            <nav className="section-nav">
              {SECTIONS.map(s => (
                <button
                  key={s}
                  className={`snav-btn${section === s ? " active" : ""}`}
                  onClick={() => setSection(s)}
                >
                  {SECTION_LABELS[s]}
                </button>
              ))}
            </nav>

            {/* Scrollable form area */}
            <div className="form-scroll">

              {/* ── Personal Info ── */}
              {section === "personal" && (
                <div>
                  <div className="field-row">
                    <Field label="Full Name *">
                      <input className="input" value={personal.fullName} onChange={e => updatePersonal("fullName", e.target.value)} placeholder="Arjun Sharma" />
                    </Field>
                    <Field label="Job Title">
                      <input className="input" value={personal.jobTitle} onChange={e => updatePersonal("jobTitle", e.target.value)} placeholder="Software Engineer" />
                    </Field>
                  </div>
                  <div className="field-row">
                    <Field label="Email">
                      <input className="input" type="email" value={personal.email} onChange={e => updatePersonal("email", e.target.value)} placeholder="you@email.com" />
                    </Field>
                    <Field label="Phone">
                      <input className="input" value={personal.phone} onChange={e => updatePersonal("phone", e.target.value)} placeholder="+91 98765 43210" />
                    </Field>
                  </div>
                  <Field label="Location">
                    <input className="input" value={personal.location} onChange={e => updatePersonal("location", e.target.value)} placeholder="Bangalore, India" />
                  </Field>
                  <Field label="LinkedIn URL">
                    <input className="input" value={personal.linkedin} onChange={e => updatePersonal("linkedin", e.target.value)} placeholder="https://linkedin.com/in/yourname" />
                  </Field>
                  <Field label="GitHub URL">
                    <input className="input" value={personal.github} onChange={e => updatePersonal("github", e.target.value)} placeholder="https://github.com/yourname" />
                  </Field>
                  <Field label="Website / Portfolio">
                    <input className="input" value={personal.website} onChange={e => updatePersonal("website", e.target.value)} placeholder="https://yoursite.com" />
                  </Field>
                </div>
              )}

              {/* ── Summary ── */}
              {section === "summary" && (
                <div>
                  <div className="ai-row">
                    <label className="label" style={{ margin: 0 }}>Professional Summary</label>
                    <AIButton
                      loading={aiLoading === "summary"}
                      onClick={handleAISummary}
                      premium={isPremium}
                    />
                  </div>
                  <textarea
                    className="input"
                    rows={6}
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    placeholder="A results-driven software engineer with 3+ years of experience building scalable web applications..."
                  />
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
                    {summary.length} / 1000 characters
                  </p>
                </div>
              )}

              {/* ── Experience ── */}
              {section === "experience" && (
                <div>
                  {experience.map((exp, i) => (
                    <div key={exp.id} className="entry-card">
                      {experience.length > 1 && (
                        <button className="entry-remove" onClick={() => setExp(prev => prev.filter(e => e.id !== exp.id))} title="Remove">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </button>
                      )}
                      <div className="field-row">
                        <Field label="Company">
                          <input className="input" value={exp.company} onChange={e => setExp(prev => prev.map(x => x.id === exp.id ? { ...x, company: e.target.value } : x))} placeholder="Google" />
                        </Field>
                        <Field label="Role / Title">
                          <input className="input" value={exp.role} onChange={e => setExp(prev => prev.map(x => x.id === exp.id ? { ...x, role: e.target.value } : x))} placeholder="Software Engineer" />
                        </Field>
                      </div>
                      <Field label="Location">
                        <input className="input" value={exp.location} onChange={e => setExp(prev => prev.map(x => x.id === exp.id ? { ...x, location: e.target.value } : x))} placeholder="Bangalore, India" />
                      </Field>
                      <div className="field-row">
                        <Field label="Start Date">
                          <input className="input" value={exp.startDate} onChange={e => setExp(prev => prev.map(x => x.id === exp.id ? { ...x, startDate: e.target.value } : x))} placeholder="Jan 2022" />
                        </Field>
                        <Field label="End Date">
                          <input className="input" value={exp.endDate} disabled={exp.current} onChange={e => setExp(prev => prev.map(x => x.id === exp.id ? { ...x, endDate: e.target.value } : x))} placeholder="Dec 2024" />
                        </Field>
                      </div>
                      <div className="check-row">
                        <input type="checkbox" id={`cur-${exp.id}`} checked={exp.current} onChange={e => setExp(prev => prev.map(x => x.id === exp.id ? { ...x, current: e.target.checked } : x))} />
                        <label htmlFor={`cur-${exp.id}`}>Currently working here</label>
                      </div>
                      <div className="ai-row">
                        <label className="label" style={{ margin: 0 }}>Description / Bullet Points</label>
                        <AIButton loading={aiLoading === `exp-${exp.id}`} onClick={() => handleAIExp(exp)} premium={isPremium} small />
                      </div>
                      <textarea
                        className="input"
                        rows={4}
                        value={exp.description}
                        onChange={e => setExp(prev => prev.map(x => x.id === exp.id ? { ...x, description: e.target.value } : x))}
                        placeholder={"- Built REST APIs serving 1M+ requests/day\n- Reduced deployment time by 60%"}
                      />
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setExp(prev => [...prev, blankExp()])}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Add Experience
                  </button>
                </div>
              )}

              {/* ── Education ── */}
              {section === "education" && (
                <div>
                  {education.map(edu => (
                    <div key={edu.id} className="entry-card">
                      {education.length > 1 && (
                        <button className="entry-remove" onClick={() => setEdu(prev => prev.filter(e => e.id !== edu.id))}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </button>
                      )}
                      <Field label="Institution">
                        <input className="input" value={edu.institution} onChange={e => setEdu(prev => prev.map(x => x.id === edu.id ? { ...x, institution: e.target.value } : x))} placeholder="IIT Bombay" />
                      </Field>
                      <div className="field-row">
                        <Field label="Degree">
                          <input className="input" value={edu.degree} onChange={e => setEdu(prev => prev.map(x => x.id === edu.id ? { ...x, degree: e.target.value } : x))} placeholder="B.Tech" />
                        </Field>
                        <Field label="Field of Study">
                          <input className="input" value={edu.field} onChange={e => setEdu(prev => prev.map(x => x.id === edu.id ? { ...x, field: e.target.value } : x))} placeholder="Computer Science" />
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Start Date">
                          <input className="input" value={edu.startDate} onChange={e => setEdu(prev => prev.map(x => x.id === edu.id ? { ...x, startDate: e.target.value } : x))} placeholder="Aug 2019" />
                        </Field>
                        <Field label="End Date">
                          <input className="input" value={edu.endDate} disabled={edu.current} onChange={e => setEdu(prev => prev.map(x => x.id === edu.id ? { ...x, endDate: e.target.value } : x))} placeholder="May 2023" />
                        </Field>
                      </div>
                      <div className="check-row">
                        <input type="checkbox" id={`cedu-${edu.id}`} checked={edu.current} onChange={e => setEdu(prev => prev.map(x => x.id === edu.id ? { ...x, current: e.target.checked } : x))} />
                        <label htmlFor={`cedu-${edu.id}`}>Currently studying here</label>
                      </div>
                      <Field label="Achievements / Description">
                        <textarea className="input" rows={3} value={edu.description} onChange={e => setEdu(prev => prev.map(x => x.id === edu.id ? { ...x, description: e.target.value } : x))} placeholder="CGPA: 8.9 / 10. Relevant coursework: Data Structures, Algorithms, DBMS" />
                      </Field>
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setEdu(prev => [...prev, blankEdu()])}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Add Education
                  </button>
                </div>
              )}

              {/* ── Skills ── */}
              {section === "skills" && (
                <div>
                  {skills.map(skill => (
                    <div key={skill.id} className="skill-row">
                      <input
                        className="input"
                        value={skill.name}
                        onChange={e => setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, name: e.target.value } : s))}
                        placeholder="React.js"
                      />
                      <select
                        className="input"
                        value={skill.level}
                        onChange={e => setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, level: e.target.value as SkillItem["level"] } : s))}
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                      </select>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => setSkills(prev => prev.filter(s => s.id !== skill.id))}
                        disabled={skills.length === 1}
                        title="Remove skill"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setSkills(prev => [...prev, blankSkill()])}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Add Skill
                  </button>
                </div>
              )}

              {/* ── Projects ── */}
              {section === "projects" && (
                <div>
                  {projects.map(proj => (
                    <div key={proj.id} className="entry-card">
                      {projects.length > 1 && (
                        <button className="entry-remove" onClick={() => setProjects(prev => prev.filter(p => p.id !== proj.id))}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </button>
                      )}
                      <Field label="Project Name">
                        <input className="input" value={proj.name} onChange={e => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, name: e.target.value } : p))} placeholder="RESUFII" />
                      </Field>
                      <Field label="Technologies (comma separated)">
                        <input
                          className="input"
                          value={proj.tech.join(", ")}
                          onChange={e => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, tech: e.target.value.split(",").map(t => t.trim()).filter(Boolean) } : p))}
                          placeholder="React, Node.js, Firebase"
                        />
                      </Field>
                      <Field label="Live URL">
                        <input className="input" value={proj.link} onChange={e => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, link: e.target.value } : p))} placeholder="https://RESUFII.app" />
                      </Field>
                      <div className="ai-row">
                        <label className="label" style={{ margin: 0 }}>Description</label>
                        <AIButton loading={aiLoading === `proj-${proj.id}`} onClick={() => handleAIProject(proj)} premium={isPremium} small />
                      </div>
                      <textarea
                        className="input"
                        rows={3}
                        value={proj.description}
                        onChange={e => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, description: e.target.value } : p))}
                        placeholder="- Built a full-stack resume builder using React and Firebase&#10;- Integrated AI content generation via OpenRouter API"
                      />
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setProjects(prev => [...prev, blankProject()])}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Add Project
                  </button>
                </div>
              )}

              {/* ── Certifications ── */}
              {section === "certifications" && (
                <div>
                  {certs.length === 0 && (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
                      Add any certifications, licenses, or courses you have completed.
                    </p>
                  )}
                  {certs.map(cert => (
                    <div key={cert.id} className="entry-card">
                      <button className="entry-remove" onClick={() => setCerts(prev => prev.filter(c => c.id !== cert.id))}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      </button>
                      <div className="field-row">
                        <Field label="Certification Name">
                          <input className="input" value={cert.name} onChange={e => setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, name: e.target.value } : c))} placeholder="AWS Solutions Architect" />
                        </Field>
                        <Field label="Issuing Organization">
                          <input className="input" value={cert.issuer} onChange={e => setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, issuer: e.target.value } : c))} placeholder="Amazon Web Services" />
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Date">
                          <input className="input" value={cert.date} onChange={e => setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, date: e.target.value } : c))} placeholder="Mar 2024" />
                        </Field>
                        <Field label="Credential ID">
                          <input className="input" value={cert.credentialId} onChange={e => setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, credentialId: e.target.value } : c))} placeholder="ABC-12345" />
                        </Field>
                      </div>
                    </div>
                  ))}
                  <button className="add-btn" onClick={() => setCerts(prev => [...prev, blankCert()])}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Add Certification
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* ── Preview panel ───────────────────────────── */}
          <div className="preview-panel">
            <ResumePreview
              template={template}
              personal={personal}
              summary={summary}
              experience={experience}
              education={education}
              skills={skills}
              projects={projects}
            />
          </div>

        </div>
      </div>
    </>
  );
}