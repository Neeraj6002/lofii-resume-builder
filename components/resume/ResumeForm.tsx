"use client";
// components/resume/ResumeForm.tsx
// ============================================================
// RESUME FORM
// Left panel of the resume builder.
// Handles all section inputs + AI modal trigger.
// Parent passes state down and receives updates via callbacks.
// ============================================================

import { useState } from "react";
import { v4 as uuid } from "uuid";
import AIGenerateModal from "./AIGenerateModal";
import type {
  PersonalInfo, ExperienceItem, EducationItem,
  SkillItem, ProjectItem, CertificationItem, AIContentType,
} from "@/types";

// ─── Section types ────────────────────────────────────────────
export type Section =
  | "personal" | "summary" | "experience"
  | "education" | "skills" | "projects" | "certifications";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "personal",       label: "Personal Info"   },
  { id: "summary",        label: "Summary"         },
  { id: "experience",     label: "Experience"      },
  { id: "education",      label: "Education"       },
  { id: "skills",         label: "Skills"          },
  { id: "projects",       label: "Projects"        },
  { id: "certifications", label: "Certifications"  },
];

// ─── Props ────────────────────────────────────────────────────
interface Props {
  personal:    PersonalInfo;
  summary:     string;
  experience:  ExperienceItem[];
  education:   EducationItem[];
  skills:      SkillItem[];
  projects:    ProjectItem[];
  certs:       CertificationItem[];

  onPersonalChange:  (val: PersonalInfo)        => void;
  onSummaryChange:   (val: string)              => void;
  onExpChange:       (val: ExperienceItem[])    => void;
  onEduChange:       (val: EducationItem[])     => void;
  onSkillsChange:    (val: SkillItem[])         => void;
  onProjectsChange:  (val: ProjectItem[])       => void;
  onCertsChange:     (val: CertificationItem[]) => void;
}

// ─── Small helpers ────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
      {children}
    </div>
  );
}

function AIBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "4px 10px", borderRadius: "var(--radius-sm)",
        fontSize: "var(--text-xs)", fontWeight: 600,
        background: "var(--gold-dim)", border: "1px solid var(--gold-border)",
        color: "var(--gold-light)", cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.5 : 1,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M5.5 1l1 3.5H10L7.3 6.5l1 3L5.5 7.8 2.7 9.5l1-3L1 4.5h3.5L5.5 1z" fill="currentColor"/>
      </svg>
      {loading ? "Writing…" : "AI Write"}
    </button>
  );
}

function EntryCard({ onRemove, children }: { onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)", padding: "var(--space-4)",
      marginBottom: "var(--space-4)", position: "relative",
    }}>
      {onRemove && (
        <button
          type="button" onClick={onRemove}
          style={{
            position: "absolute", top: "var(--space-3)", right: "var(--space-3)",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-disabled)", padding: 2,
            transition: "color var(--duration-fast)",
          }}
          onMouseOver={e => (e.currentTarget.style.color = "var(--error)")}
          onMouseOut={e  => (e.currentTarget.style.color = "var(--text-disabled)")}
          title="Remove"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "var(--space-2)", width: "100%",
        padding: "var(--space-3)", background: "transparent",
        border: "1px dashed var(--border)", borderRadius: "var(--radius-md)",
        fontSize: "var(--text-sm)", color: "var(--text-secondary)", cursor: "pointer",
        transition: "all var(--duration-fast)",
      }}
      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--gold-light)"; }}
      onMouseOut={e  => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function ResumeForm({
  personal, summary, experience, education, skills, projects, certs,
  onPersonalChange, onSummaryChange, onExpChange, onEduChange,
  onSkillsChange, onProjectsChange, onCertsChange,
}: Props) {
  const [activeSection, setActiveSection] = useState<Section>("personal");
  const [aiModal, setAiModal] = useState<{
    type: AIContentType;
    prefill: Record<string, string>;
    onInsert: (content: string) => void;
  } | null>(null);

  // ── Personal ──────────────────────────────────────────────
  function updateP(key: keyof PersonalInfo, val: string) {
    onPersonalChange({ ...personal, [key]: val });
  }

  // ── Experience ────────────────────────────────────────────
  function updateExp(id: string, key: keyof ExperienceItem, val: string | boolean) {
    onExpChange(experience.map(e => e.id === id ? { ...e, [key]: val } : e));
  }

  // ── Education ─────────────────────────────────────────────
  function updateEdu(id: string, key: keyof EducationItem, val: string | boolean) {
    onEduChange(education.map(e => e.id === id ? { ...e, [key]: val } : e));
  }

  // ── Skills ────────────────────────────────────────────────
  function updateSkill(id: string, key: keyof SkillItem, val: string) {
    onSkillsChange(skills.map(s => s.id === id ? { ...s, [key]: val } : s));
  }

  // ── Projects ──────────────────────────────────────────────
  function updateProj(id: string, key: keyof ProjectItem, val: string | string[]) {
    onProjectsChange(projects.map(p => p.id === id ? { ...p, [key]: val } : p));
  }

  // ── Certs ─────────────────────────────────────────────────
  function updateCert(id: string, key: keyof CertificationItem, val: string) {
    onCertsChange(certs.map(c => c.id === id ? { ...c, [key]: val } : c));
  }

  const checkStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "var(--space-2)",
    marginBottom: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-secondary)",
  };

  return (
    <>
      <style>{`
        .form-nav {
          display: flex; gap: 2px; padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0;
          scrollbar-width: none;
        }
        .form-nav::-webkit-scrollbar { display: none; }
        .fnav-btn {
          padding: 5px 10px; border-radius: var(--radius-sm);
          font-size: var(--text-xs); font-weight: 500;
          background: transparent; border: none;
          color: var(--text-secondary); cursor: pointer; white-space: nowrap;
          transition: background var(--duration-fast), color var(--duration-fast);
        }
        .fnav-btn:hover  { background: var(--bg-elevated); color: var(--text-primary); }
        .fnav-btn.active { background: var(--bg-elevated); color: var(--gold-light);   }
        .form-scroll { flex: 1; overflow-y: auto; padding: var(--space-5); scrollbar-width: thin; }
        .ai-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
      `}</style>

      {/* Section nav */}
      <nav className="form-nav">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`fnav-btn${activeSection === s.id ? " active" : ""}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Form scroll area */}
      <div className="form-scroll">

        {/* ── Personal ── */}
        {activeSection === "personal" && (
          <div>
            <Row>
              <Field label="Full Name *">
                <input className="input" value={personal.fullName} onChange={e => updateP("fullName", e.target.value)} placeholder="Arjun Sharma"/>
              </Field>
              <Field label="Job Title">
                <input className="input" value={personal.jobTitle} onChange={e => updateP("jobTitle", e.target.value)} placeholder="Software Engineer"/>
              </Field>
            </Row>
            <Row>
              <Field label="Email">
                <input className="input" type="email" value={personal.email} onChange={e => updateP("email", e.target.value)} placeholder="you@email.com"/>
              </Field>
              <Field label="Phone">
                <input className="input" value={personal.phone} onChange={e => updateP("phone", e.target.value)} placeholder="+91 98765 43210"/>
              </Field>
            </Row>
            <Field label="Location">
              <input className="input" value={personal.location} onChange={e => updateP("location", e.target.value)} placeholder="Bangalore, India"/>
            </Field>
            <Field label="LinkedIn URL">
              <input className="input" value={personal.linkedin} onChange={e => updateP("linkedin", e.target.value)} placeholder="https://linkedin.com/in/yourname"/>
            </Field>
            <Field label="GitHub URL">
              <input className="input" value={personal.github} onChange={e => updateP("github", e.target.value)} placeholder="https://github.com/yourname"/>
            </Field>
            <Field label="Website / Portfolio">
              <input className="input" value={personal.website} onChange={e => updateP("website", e.target.value)} placeholder="https://yoursite.com"/>
            </Field>
          </div>
        )}

        {/* ── Summary ── */}
        {activeSection === "summary" && (
          <div>
            <div className="ai-row">
              <label className="label" style={{ margin: 0 }}>Professional Summary</label>
              <AIBtn
                loading={false}
                onClick={() => setAiModal({
                  type: "summary",
                  prefill: { jobTitle: personal.jobTitle, skills: skills.map(s => s.name).join(", ") },
                  onInsert: onSummaryChange,
                })}
              />
            </div>
            <textarea
              className="input" rows={6} value={summary}
              onChange={e => onSummaryChange(e.target.value)}
              placeholder="A results-driven software engineer with 3+ years of experience..."
            />
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
              {summary.length} / 1000
            </p>
          </div>
        )}

        {/* ── Experience ── */}
        {activeSection === "experience" && (
          <div>
            {experience.map((exp) => (
              <EntryCard
                key={exp.id}
                onRemove={experience.length > 1 ? () => onExpChange(experience.filter(e => e.id !== exp.id)) : undefined}
              >
                <Row>
                  <Field label="Company">
                    <input className="input" value={exp.company} onChange={e => updateExp(exp.id, "company", e.target.value)} placeholder="Google"/>
                  </Field>
                  <Field label="Role / Title">
                    <input className="input" value={exp.role} onChange={e => updateExp(exp.id, "role", e.target.value)} placeholder="Software Engineer"/>
                  </Field>
                </Row>
                <Field label="Location">
                  <input className="input" value={exp.location} onChange={e => updateExp(exp.id, "location", e.target.value)} placeholder="Bangalore, India"/>
                </Field>
                <Row>
                  <Field label="Start Date">
                    <input className="input" value={exp.startDate} onChange={e => updateExp(exp.id, "startDate", e.target.value)} placeholder="Jan 2022"/>
                  </Field>
                  <Field label="End Date">
                    <input className="input" value={exp.endDate} disabled={exp.current} onChange={e => updateExp(exp.id, "endDate", e.target.value)} placeholder="Dec 2024"/>
                  </Field>
                </Row>
                <div style={checkStyle}>
                  <input type="checkbox" id={`cur-${exp.id}`} checked={exp.current} onChange={e => updateExp(exp.id, "current", e.target.checked)} style={{ accentColor: "var(--gold)", width: 14, height: 14 }}/>
                  <label htmlFor={`cur-${exp.id}`}>Currently working here</label>
                </div>
                <div className="ai-row">
                  <label className="label" style={{ margin: 0 }}>Description / Bullets</label>
                  <AIBtn
                    loading={false}
                    onClick={() => setAiModal({
                      type: "experience",
                      prefill: { company: exp.company, role: exp.role, duration: `${exp.startDate} - ${exp.current ? "Present" : exp.endDate}` },
                      onInsert: (c) => updateExp(exp.id, "description", c),
                    })}
                  />
                </div>
                <textarea className="input" rows={4} value={exp.description} onChange={e => updateExp(exp.id, "description", e.target.value)} placeholder={"- Built REST APIs serving 1M+ requests/day\n- Reduced load time by 40%"}/>
              </EntryCard>
            ))}
            <AddBtn label="Add Experience" onClick={() => onExpChange([...experience, { id: uuid(), company: "", role: "", location: "", startDate: "", endDate: "", current: false, description: "", aiGenerated: false }])}/>
          </div>
        )}

        {/* ── Education ── */}
        {activeSection === "education" && (
          <div>
            {education.map((edu) => (
              <EntryCard
                key={edu.id}
                onRemove={education.length > 1 ? () => onEduChange(education.filter(e => e.id !== edu.id)) : undefined}
              >
                <Field label="Institution">
                  <input className="input" value={edu.institution} onChange={e => updateEdu(edu.id, "institution", e.target.value)} placeholder="IIT Bombay"/>
                </Field>
                <Row>
                  <Field label="Degree">
                    <input className="input" value={edu.degree} onChange={e => updateEdu(edu.id, "degree", e.target.value)} placeholder="B.Tech"/>
                  </Field>
                  <Field label="Field of Study">
                    <input className="input" value={edu.field} onChange={e => updateEdu(edu.id, "field", e.target.value)} placeholder="Computer Science"/>
                  </Field>
                </Row>
                <Row>
                  <Field label="Start Date">
                    <input className="input" value={edu.startDate} onChange={e => updateEdu(edu.id, "startDate", e.target.value)} placeholder="Aug 2019"/>
                  </Field>
                  <Field label="End Date">
                    <input className="input" value={edu.endDate} disabled={edu.current} onChange={e => updateEdu(edu.id, "endDate", e.target.value)} placeholder="May 2023"/>
                  </Field>
                </Row>
                <div style={checkStyle}>
                  <input type="checkbox" id={`cedu-${edu.id}`} checked={edu.current} onChange={e => updateEdu(edu.id, "current", e.target.checked)} style={{ accentColor: "var(--gold)", width: 14, height: 14 }}/>
                  <label htmlFor={`cedu-${edu.id}`}>Currently studying here</label>
                </div>
                <Field label="Description / Achievements">
                  <textarea className="input" rows={3} value={edu.description} onChange={e => updateEdu(edu.id, "description", e.target.value)} placeholder="CGPA: 8.9/10. Relevant coursework: DSA, DBMS"/>
                </Field>
              </EntryCard>
            ))}
            <AddBtn label="Add Education" onClick={() => onEduChange([...education, { id: uuid(), institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", current: false, description: "", aiGenerated: false }])}/>
          </div>
        )}

        {/* ── Skills ── */}
        {activeSection === "skills" && (
          <div>
            {skills.map((skill) => (
              <div key={skill.id} style={{ display: "grid", gridTemplateColumns: "1fr 140px 32px", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <input className="input" value={skill.name} onChange={e => updateSkill(skill.id, "name", e.target.value)} placeholder="React.js"/>
                <select className="input" value={skill.level} onChange={e => updateSkill(skill.id, "level", e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
                <button
                  type="button" className="btn btn-ghost btn-icon"
                  onClick={() => onSkillsChange(skills.filter(s => s.id !== skill.id))}
                  disabled={skills.length === 1} title="Remove"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
            <AddBtn label="Add Skill" onClick={() => onSkillsChange([...skills, { id: uuid(), name: "", level: "intermediate", category: "" }])}/>
          </div>
        )}

        {/* ── Projects ── */}
        {activeSection === "projects" && (
          <div>
            {projects.map((proj) => (
              <EntryCard
                key={proj.id}
                onRemove={projects.length > 1 ? () => onProjectsChange(projects.filter(p => p.id !== proj.id)) : undefined}
              >
                <Field label="Project Name">
                  <input className="input" value={proj.name} onChange={e => updateProj(proj.id, "name", e.target.value)} placeholder="RESUFII"/>
                </Field>
                <Field label="Technologies (comma separated)">
                  <input
                    className="input"
                    value={proj.tech.join(", ")}
                    onChange={e => updateProj(proj.id, "tech", e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean))}
                    placeholder="React, Firebase, Node.js"
                  />
                </Field>
                <Field label="Live URL">
                  <input className="input" value={proj.link} onChange={e => updateProj(proj.id, "link", e.target.value)} placeholder="https://RESUFII.app"/>
                </Field>
                <div className="ai-row">
                  <label className="label" style={{ margin: 0 }}>Description</label>
                  <AIBtn
                    loading={false}
                    onClick={() => setAiModal({
                      type: "project",
                      prefill: { name: proj.name, tech: proj.tech.join(", "), description: proj.description },
                      onInsert: (c) => updateProj(proj.id, "description", c),
                    })}
                  />
                </div>
                <textarea className="input" rows={3} value={proj.description} onChange={e => updateProj(proj.id, "description", e.target.value)} placeholder="- Built an AI resume builder with React and Firebase&#10;- Integrated OpenRouter API for content generation"/>
              </EntryCard>
            ))}
            <AddBtn label="Add Project" onClick={() => onProjectsChange([...projects, { id: uuid(), name: "", description: "", tech: [], link: "", githubLink: "", aiGenerated: false }])}/>
          </div>
        )}

        {/* ── Certifications ── */}
        {activeSection === "certifications" && (
          <div>
            {certs.length === 0 && (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
                Add certifications, licenses, or courses you have completed.
              </p>
            )}
            {certs.map((cert) => (
              <EntryCard key={cert.id} onRemove={() => onCertsChange(certs.filter(c => c.id !== cert.id))}>
                <Row>
                  <Field label="Name">
                    <input className="input" value={cert.name} onChange={e => updateCert(cert.id, "name", e.target.value)} placeholder="AWS Solutions Architect"/>
                  </Field>
                  <Field label="Issuer">
                    <input className="input" value={cert.issuer} onChange={e => updateCert(cert.id, "issuer", e.target.value)} placeholder="Amazon Web Services"/>
                  </Field>
                </Row>
                <Row>
                  <Field label="Date">
                    <input className="input" value={cert.date} onChange={e => updateCert(cert.id, "date", e.target.value)} placeholder="Mar 2024"/>
                  </Field>
                  <Field label="Credential ID">
                    <input className="input" value={cert.credentialId} onChange={e => updateCert(cert.id, "credentialId", e.target.value)} placeholder="ABC-12345"/>
                  </Field>
                </Row>
              </EntryCard>
            ))}
            <AddBtn label="Add Certification" onClick={() => onCertsChange([...certs, { id: uuid(), name: "", issuer: "", date: "", credentialId: "", link: "" }])}/>
          </div>
        )}

      </div>

      {/* AI Modal */}
      {aiModal && (
        <AIGenerateModal
          type={aiModal.type}
          prefill={aiModal.prefill}
          onInsert={aiModal.onInsert}
          onClose={() => setAiModal(null)}
        />
      )}
    </>
  );
}