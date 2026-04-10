"use client";
// components/resume/ResumePreview.tsx

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

const ACCENTS: Record<ResumeTemplate, { primary: string; secondary: string }> = {
  classic:   { primary: "#1a1a2e", secondary: "#444"    },
  modern:    { primary: "#2563eb", secondary: "#3b82f6" },
  minimal:   { primary: "#374151", secondary: "#6b7280" },
  executive: { primary: "#7c3aed", secondary: "#8b5cf6" },
  creative:  { primary: "#db2777", secondary: "#ec4899" },
  tech:      { primary: "#059669", secondary: "#10b981" },
};

function parseBullets(text: string): string[] {
  return text.split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
}

const CATEGORY_LABELS: Record<string, string> = {
  coding: "Coding / Programming",
  tools:  "Tools & Software",
  design: "Design",
  other:  "Other",
  "":     "Skills",
};

function groupSkills(skills: SkillItem[]): { category: string; label: string; names: string[] }[] {
  const map = new Map<string, string[]>();
  skills.filter(s => s.name).forEach(s => {
    const cat = s.category || "";
    if (!map.has(cat)) map.set(cat, []);
    const names = s.name.split(",").map(n => n.trim()).filter(Boolean);
    map.get(cat)!.push(...names);
  });
  return Array.from(map.entries()).map(([category, names]) => ({
    category,
    label: CATEGORY_LABELS[category] || category,
    names,
  }));
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
          width: 100%;
          max-width: 680px;
          min-height: 920px;
          box-shadow: 0 4px 32px rgba(0,0,0,.2);
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 10px;
          line-height: 1.55;
          color: #1a1a1a;
          position: relative;
          overflow: hidden;
          word-break: break-word;
          overflow-wrap: break-word;
          word-wrap: break-word;
          box-sizing: border-box;
        }

        .preview-doc * {
          word-break: break-word;
          overflow-wrap: break-word;
          word-wrap: break-word;
          max-width: 100%;
          box-sizing: border-box;
        }

        .preview-doc[data-t="classic"]   { padding: 48px 52px; }
        .preview-doc[data-t="modern"]    { padding: 0; }
        .preview-doc[data-t="minimal"]   { padding: 40px 48px; }
        .preview-doc[data-t="executive"] { padding: 48px 52px; }
        .preview-doc[data-t="creative"]  { padding: 0; }
        .preview-doc[data-t="tech"]      { padding: 40px 48px; font-family: 'Courier New', monospace; }

        .modern-strip {
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 6px; flex-shrink: 0;
        }
        .modern-inner { padding: 48px 52px; }

        .creative-header-band {
          padding: 36px 48px 28px;
        }
        .creative-body { padding: 28px 48px; }

        .prev-name {
          font-size: 22px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          margin-bottom: 3px;
          word-break: break-word;
        }
        .prev-role {
          font-size: 11px; margin-bottom: 8px;
          word-break: break-word;
        }

        .prev-contacts {
          display: flex; flex-wrap: wrap; gap: 4px 0;
          font-size: 8.5px; color: #555;
          word-break: break-word;
        }
        .prev-contact-item {
          display: inline;
          color: inherit;
          text-decoration: none;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .prev-contact-sep {
          margin: 0 5px;
          color: #999;
        }

        .prev-sec { margin-bottom: 14px; }
        .prev-sec-title {
          font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding-bottom: 3px; margin-bottom: 7px;
          border-bottom: 1.5px solid currentColor;
        }

        .prev-entry { margin-bottom: 9px; }
        .prev-entry-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1px;
          gap: 8px;
        }
        .prev-entry-left { flex: 1; min-width: 0; }
        .prev-entry-title {
          font-size: 10px; font-weight: 700;
          word-break: break-word;
        }
        .prev-entry-sub   { font-size: 9px; color: #555; word-break: break-word; }
        .prev-entry-date  {
          font-size: 8.5px; color: #666;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .prev-bullets { margin-top: 3px; display: flex; flex-direction: column; gap: 2px; }
        .prev-bullet  {
          font-size: 9px; color: #333;
          padding-left: 8px; line-height: 1.5;
          word-break: break-word;
        }

        .prev-skill-row {
          display: flex; flex-wrap: wrap; align-items: baseline;
          gap: 0; margin-bottom: 4px; font-size: 9px; color: #333;
        }
        .prev-skill-category {
          font-weight: 700; color: #333; margin-right: 6px;
          flex-shrink: 0;
        }
        .prev-skill-names { color: #444; word-break: break-word; }

        .prev-proj-link {
          font-size: 8px; color: #555;
          text-decoration: underline;
          display: inline-block; margin-top: 2px;
          word-break: break-word;
        }

        .prev-watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 11px; color: #ccc; text-align: center;
          pointer-events: none; width: 220px; line-height: 1.6;
          font-family: system-ui;
        }

        [data-t="tech"] .prev-name     { font-family: 'Courier New', monospace; }
        [data-t="tech"] .prev-sec-title { font-family: 'Courier New', monospace; letter-spacing: 0.06em; }
      `}</style>

      <div className="preview-doc" data-t={template} id="resume-preview-root">

        {template === "modern" && (
          <div className="modern-strip" style={{ background: accent.primary }} />
        )}

        {template === "creative" ? (
          <>
            <div className="creative-header-band" style={{ background: accent.primary }}>
              <div className="prev-name" style={{ color: "#fff" }}>
                {personal.fullName || "Your Name"}
              </div>
              <div className="prev-role" style={{ color: "rgba(255,255,255,.8)" }}>
                {personal.jobTitle || "Your Job Title"}
              </div>
              <ContactsRow personal={personal} lightText />
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
            <div style={{
              textAlign: template === "minimal" ? "left" : "center",
              borderBottom: `2px solid ${accent.primary}`,
              paddingBottom: 12, marginBottom: 14,
            }}>
              <div className="prev-name" style={{ color: accent.primary }}>
                {personal.fullName || "Your Name"}
              </div>
              <div className="prev-role" style={{ color: accent.secondary }}>
                {personal.jobTitle || "Your Job Title"}
              </div>
              <ContactsRow
                personal={personal}
                centered={template !== "minimal"}
              />
            </div>

            <ResumeBody
              accent={accent} summary={summary}
              experience={experience} education={education}
              skills={skills} projects={projects}
              certifications={certifications}
            />
          </div>
        )}

        {!hasContent && (
          <div className="prev-watermark">
            Your resume will appear here as you fill the form →
          </div>
        )}
      </div>
    </>
  );
}

// ─── Contacts row ─────────────────────────────────────────────
function ContactsRow({
  personal,
  lightText = false,
  centered = true,
}: {
  personal: PersonalInfo;
  lightText?: boolean;
  centered?: boolean;
}) {
  const items: { label: string; href?: string }[] = [];
  if (personal.email)    items.push({ label: personal.email,    href: `mailto:${personal.email}` });
  if (personal.phone)    items.push({ label: personal.phone });
  if (personal.location) items.push({ label: personal.location });
  if (personal.linkedin) items.push({ label: personal.linkedin, href: personal.linkedin });
  if (personal.github)   items.push({ label: personal.github,   href: personal.github });
  if (personal.website)  items.push({ label: personal.website,  href: personal.website });

  if (items.length === 0) return null;

  return (
    <div
      className="prev-contacts"
      style={{
        justifyContent: centered ? "center" : "flex-start",
        color: lightText ? "rgba(255,255,255,.75)" : "#555",
      }}
    >
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {item.href ? (
            <a
              href={item.href}
              className="prev-contact-item"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: lightText ? "rgba(255,255,255,.75)" : "#555" }}
            >
              {item.label}
            </a>
          ) : (
            <span className="prev-contact-item">{item.label}</span>
          )}
          {i < items.length - 1 && (
            <span
              className="prev-contact-sep"
              style={{ color: lightText ? "rgba(255,255,255,.5)" : "#bbb" }}
            >
              .
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Body sections ────────────────────────────────────────────
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
  const skillGroups = groupSkills(skills);

  return (
    <>
      {/* Summary */}
      {summary && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Summary</div>
          <p style={{ fontSize: 9.5, color: "#333", lineHeight: 1.6, wordBreak: "break-word" }}>{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.filter(e => e.company || e.role).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Experience</div>
          {experience.filter(e => e.company || e.role).map(exp => (
            <div key={exp.id} className="prev-entry">
              <div className="prev-entry-top">
                <div className="prev-entry-left">
                  <div className="prev-entry-title">{exp.company || "Company"}</div>
                  <div className="prev-entry-sub">
                    {exp.role}{exp.location ? ` . ${exp.location}` : ""}
                  </div>
                </div>
                <div className="prev-entry-date">
                  {exp.startDate}{exp.startDate && " - "}{exp.current ? "Present" : exp.endDate}
                </div>
              </div>
              {exp.description && (
                <div className="prev-bullets">
                  {parseBullets(exp.description).map((b, i) => (
                    <div key={i} className="prev-bullet">. {b}</div>
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
                <div className="prev-entry-left">
                  <div className="prev-entry-title">{edu.institution}</div>
                  <div className="prev-entry-sub">
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                  </div>
                </div>
                <div className="prev-entry-date">
                  {edu.startDate}{edu.startDate && " - "}{edu.current ? "Present" : edu.endDate}
                </div>
              </div>
              {edu.description && (
                <p style={{ fontSize: 9, color: "#444", marginTop: 2, wordBreak: "break-word" }}>{edu.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {skillGroups.length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Skills</div>
          {skillGroups.map(group => (
            <div key={group.category} className="prev-skill-row">
              {group.category && group.category !== "" && (
                <span className="prev-skill-category" style={{ color: accent.primary }}>
                  {group.label}:
                </span>
              )}
              <span className="prev-skill-names">
                {group.names.join(" . ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {projects.filter(p => p.name).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Projects</div>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} className="prev-entry">
              <div className="prev-entry-top">
                <div className="prev-entry-left">
                  <div className="prev-entry-title">
                    {proj.name}
                    {Array.isArray(proj.tech) && proj.tech.length > 0 && (
                      <span style={{ fontWeight: 400, color: "#666", marginLeft: 5, fontSize: 8.5 }}>
                        . {proj.tech.join(", ")}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0 8px" }}>
                    {proj.link && (
                      <a
                        href={proj.link}
                        className="prev-proj-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: accent.secondary }}
                      >
                        {proj.link}
                      </a>
                    )}
                    {proj.githubLink && (
                      <a
                        href={proj.githubLink}
                        className="prev-proj-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#555" }}
                      >
                        GitHub
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {proj.description && (
                <div className="prev-bullets">
                  {parseBullets(proj.description).map((b, i) => (
                    <div key={i} className="prev-bullet">. {b}</div>
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
                <div className="prev-entry-left">
                  <div className="prev-entry-title">{cert.name}</div>
                  <div className="prev-entry-sub">
                    {cert.issuer}
                    {cert.credentialId && (
                      <span style={{ color: "#777", marginLeft: 5 }}>
                        . ID: {cert.credentialId}
                      </span>
                    )}
                  </div>
                  {cert.link && (
                    <a
                      href={cert.link}
                      className="prev-proj-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accent.secondary }}
                    >
                      View Certificate
                    </a>
                  )}
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