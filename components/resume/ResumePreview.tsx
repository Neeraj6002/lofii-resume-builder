"use client";
// components/resume/ResumePreview.tsx
// ============================================================
// RESUME PREVIEW
// Right panel of the builder — renders the resume in real time.
// Switches styles based on selected template.
// ============================================================

import type {
  PersonalInfo, ExperienceItem, EducationItem,
  SkillItem, ProjectItem, CertificationItem, ResumeTemplate,
} from "@/types";

interface Props {
  template:     ResumeTemplate;
  personal:     PersonalInfo;
  summary:      string;
  experience:   ExperienceItem[];
  education:    EducationItem[];
  skills:       SkillItem[];
  projects:     ProjectItem[];
  certifications: CertificationItem[];
}

// ─── Template accent colours ──────────────────────────────────
const ACCENTS: Record<ResumeTemplate, { primary: string; secondary: string }> = {
  classic:   { primary: "#1a1a2e", secondary: "#444"    },
  modern:    { primary: "#2563eb", secondary: "#3b82f6" },
  minimal:   { primary: "#374151", secondary: "#6b7280" },
  executive: { primary: "#7c3aed", secondary: "#8b5cf6" },
  creative:  { primary: "#db2777", secondary: "#ec4899" },
  tech:      { primary: "#059669", secondary: "#10b981" },
};

// ─── Bullet parser ────────────────────────────────────────────
function parseBullets(text: string): string[] {
  return text.split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
}

export default function ResumePreview({
  template, personal, summary, experience,
  education, skills, projects, certifications,
}: Props) {
  const accent = ACCENTS[template];

  const hasContent =
    personal.fullName || summary ||
    experience.some(e => e.company || e.role) ||
    education.some(e => e.institution) ||
    skills.some(s => s.name) ||
    projects.some(p => p.name);

  return (
    <>
      <style>{`
        .preview-doc {
          background: #fff;
          width: 100%; max-width: 680px;
          min-height: 920px;
          box-shadow: 0 4px 32px rgba(0,0,0,.2);
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 10px; line-height: 1.55;
          color: #1a1a1a; position: relative;
        }
        /* Template variants */
        .preview-doc[data-t="classic"]   { padding: 48px 52px; }
        .preview-doc[data-t="modern"]    { padding: 0; }
        .preview-doc[data-t="minimal"]   { padding: 40px 48px; }
        .preview-doc[data-t="executive"] { padding: 48px 52px; }
        .preview-doc[data-t="creative"]  { padding: 0; }
        .preview-doc[data-t="tech"]      { padding: 40px 48px; font-family: 'Courier New', monospace; }

        /* Modern template — coloured left strip */
        .modern-strip {
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 6px;
        }
        .modern-inner { padding: 48px 52px; }

        /* Creative template — full colour header */
        .creative-header-band {
          padding: 36px 48px 28px;
          margin-bottom: 0;
        }
        .creative-body { padding: 28px 48px; }

        /* Shared header */
        .prev-name {
          font-size: 22px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          margin-bottom: 3px;
        }
        .prev-role { font-size: 11px; margin-bottom: 8px; }
        .prev-contacts {
          display: flex; flex-wrap: wrap; gap: 10px;
          font-size: 8.5px; color: #555;
        }
        .prev-contacts span { display: flex; align-items: center; gap: 3px; }

        /* Divider */
        .prev-div { height: 1px; margin: 10px 0; }

        /* Section */
        .prev-sec { margin-bottom: 14px; }
        .prev-sec-title {
          font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding-bottom: 3px; margin-bottom: 7px;
          border-bottom: 1.5px solid currentColor;
        }

        /* Entry */
        .prev-entry { margin-bottom: 9px; }
        .prev-entry-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1px; }
        .prev-entry-title { font-size: 10px; font-weight: 700; }
        .prev-entry-sub   { font-size: 9px; color: #555; }
        .prev-entry-date  { font-size: 8.5px; color: #666; white-space: nowrap; margin-left: 6px; flex-shrink: 0; }

        /* Bullets */
        .prev-bullets { margin-top: 3px; display: flex; flex-direction: column; gap: 2px; }
        .prev-bullet  { font-size: 9px; color: #333; padding-left: 8px; line-height: 1.5; }

        /* Skills */
        .prev-skills { display: flex; flex-wrap: wrap; gap: 4px; }
        .prev-skill  { font-size: 8.5px; padding: 2px 7px; border: 1px solid; border-radius: 99px; }

        /* Watermark */
        .prev-watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 11px; color: #ccc; text-align: center;
          pointer-events: none; width: 220px; line-height: 1.6;
          font-family: system-ui;
        }

        /* Tech template monospace tweaks */
        [data-t="tech"] .prev-name     { font-family: 'Courier New', monospace; }
        [data-t="tech"] .prev-sec-title { font-family: 'Courier New', monospace; letter-spacing: 0.06em; }
      `}</style>

      <div className="preview-doc" data-t={template}>

        {/* ── Modern: coloured side strip ── */}
        {template === "modern" && (
          <div className="modern-strip" style={{ background: accent.primary }} />
        )}

        {/* ── Creative: coloured header band ── */}
        {template === "creative" ? (
          <>
            <div className="creative-header-band" style={{ background: accent.primary }}>
              <div className="prev-name" style={{ color: "#fff" }}>
                {personal.fullName || "Your Name"}
              </div>
              <div className="prev-role" style={{ color: "rgba(255,255,255,.8)" }}>
                {personal.jobTitle || "Your Job Title"}
              </div>
              <div className="prev-contacts" style={{ color: "rgba(255,255,255,.7)" }}>
                {personal.email    && <span>{personal.email}</span>}
                {personal.phone    && <span>{personal.phone}</span>}
                {personal.location && <span>{personal.location}</span>}
                {personal.linkedin && <span>LinkedIn</span>}
                {personal.github   && <span>GitHub</span>}
              </div>
            </div>
            <div className="creative-body">
              <ResumeBody
                accent={accent} summary={summary}
                experience={experience} education={education}
                skills={skills} projects={projects}
                certifications={certifications}
              />
            </div>
          </>
        ) : (
          <div className={template === "modern" ? "modern-inner" : ""}>
            {/* Standard header */}
            <div style={{ textAlign: template === "minimal" ? "left" : "center", borderBottom: `2px solid ${accent.primary}`, paddingBottom: 12, marginBottom: 14 }}>
              <div className="prev-name" style={{ color: accent.primary }}>
                {personal.fullName || "Your Name"}
              </div>
              <div className="prev-role" style={{ color: accent.secondary }}>
                {personal.jobTitle || "Your Job Title"}
              </div>
              <div className="prev-contacts" style={{ justifyContent: template === "minimal" ? "flex-start" : "center" }}>
                {personal.email    && <span>{personal.email}</span>}
                {personal.phone    && <span>{personal.phone}</span>}
                {personal.location && <span>{personal.location}</span>}
                {personal.linkedin && <span>LinkedIn</span>}
                {personal.github   && <span>GitHub</span>}
                {personal.website  && <span>Portfolio</span>}
              </div>
            </div>

            <ResumeBody
              accent={accent} summary={summary}
              experience={experience} education={education}
              skills={skills} projects={projects}
              certifications={certifications}
            />
          </div>
        )}

        {/* Watermark when empty */}
        {!hasContent && (
          <div className="prev-watermark">
            Your resume will appear here as you fill the form →
          </div>
        )}
      </div>
    </>
  );
}

// ─── Shared body sections ─────────────────────────────────────
function ResumeBody({
  accent, summary, experience, education, skills, projects, certifications,
}: {
  accent: { primary: string; secondary: string };
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
}) {
  return (
    <>
      {/* Summary */}
      {summary && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Summary</div>
          <p style={{ fontSize: 9.5, color: "#333", lineHeight: 1.6 }}>{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.filter(e => e.company || e.role).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Experience</div>
          {experience.filter(e => e.company || e.role).map(exp => (
            <div key={exp.id} className="prev-entry">
              <div className="prev-entry-top">
                <div>
                  <div className="prev-entry-title">{exp.role || "Role"}</div>
                  <div className="prev-entry-sub">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</div>
                </div>
                <div className="prev-entry-date">
                  {exp.startDate}{exp.startDate && " – "}{exp.current ? "Present" : exp.endDate}
                </div>
              </div>
              {exp.description && (
                <div className="prev-bullets">
                  {parseBullets(exp.description).map((b, i) => (
                    <div key={i} className="prev-bullet">• {b}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {education.filter(e => e.institution).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Education</div>
          {education.filter(e => e.institution).map(edu => (
            <div key={edu.id} className="prev-entry">
              <div className="prev-entry-top">
                <div>
                  <div className="prev-entry-title">{edu.institution}</div>
                  <div className="prev-entry-sub">
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                  </div>
                </div>
                <div className="prev-entry-date">
                  {edu.startDate}{edu.startDate && " – "}{edu.current ? "Present" : edu.endDate}
                </div>
              </div>
              {edu.description && (
                <p style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{edu.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {skills.filter(s => s.name).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Skills</div>
          <div className="prev-skills">
            {skills.filter(s => s.name).map(s => (
              <span
                key={s.id}
                className="prev-skill"
                style={{ borderColor: accent.primary, color: accent.primary }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.filter(p => p.name).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Projects</div>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} className="prev-entry">
              <div className="prev-entry-title">
                {proj.name}
                {proj.tech.length > 0 && (
                  <span style={{ fontWeight: 400, color: "#666", marginLeft: 5 }}>
                    · {proj.tech.join(", ")}
                  </span>
                )}
              </div>
              {proj.description && (
                <div className="prev-bullets">
                  {parseBullets(proj.description).map((b, i) => (
                    <div key={i} className="prev-bullet">• {b}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {certifications.filter(c => c.name).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Certifications</div>
          {certifications.filter(c => c.name).map(cert => (
            <div key={cert.id} className="prev-entry">
              <div className="prev-entry-top">
                <div>
                  <div className="prev-entry-title">{cert.name}</div>
                  <div className="prev-entry-sub">{cert.issuer}</div>
                </div>
                <div className="prev-entry-date">{cert.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}