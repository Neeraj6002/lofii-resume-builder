"use client";
// components/resume/ResumePreview.tsx
// ============================================================
// RESUME PREVIEW — UPDATED
// Fixes applied:
//   1. Personal header: LinkedIn, GitHub, Website now show actual URLs (not just labels)
//   2. Experience: Company shown ABOVE Role/Title in preview
//   3. Skills: No more bubbles — plain comma-separated text grouped by category
//   4. Projects: Technologies appear correctly; Live URL shown as clickable link
//   5. Certifications: Credential ID now displayed in preview
//   6. Print styles: @media print hides everything except the preview doc
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

// ─── Group skills by category ─────────────────────────────────
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
    // Each skill entry's name may be comma-separated ("HTML, CSS, JS")
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

        /* FIX: contacts row — show actual URL text, truncate if too long */
        .prev-contacts {
          display: flex; flex-wrap: wrap; gap: 8px 14px;
          font-size: 8px; color: #555;
        }
        .prev-contacts a,
        .prev-contacts span {
          display: inline-flex; align-items: center; gap: 3px;
          color: inherit; text-decoration: none;
          max-width: 200px; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }

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

        /* FIX: Skills — plain text rows, no bubbles */
        .prev-skill-row {
          display: flex; flex-wrap: wrap; align-items: baseline;
          gap: 0; margin-bottom: 4px; font-size: 9px; color: #333;
        }
        .prev-skill-category {
          font-weight: 700; color: #333; margin-right: 6px;
          flex-shrink: 0;
        }
        .prev-skill-names { color: #444; }

        /* Project link */
        .prev-proj-link {
          font-size: 8px; color: #555;
          text-decoration: none; display: inline-block;
          margin-top: 2px;
        }

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

        /* ── PRINT STYLES ── */
        @media print {
          /* Hide everything on the page */
          body * { visibility: hidden !important; }
          /* Show only the resume preview */
          .preview-doc,
          .preview-doc * { visibility: visible !important; }
          .preview-doc {
            position: fixed !important;
            left: 0; top: 0;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 100vh !important;
            box-shadow: none !important;
            padding: 24px 36px !important;
            margin: 0 !important;
          }
          .prev-watermark { display: none !important; }
        }
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
              {/* FIX: show actual link values */}
              <div className="prev-contacts" style={{ color: "rgba(255,255,255,.7)" }}>
                {personal.email    && <span>✉ {personal.email}</span>}
                {personal.phone    && <span>📞 {personal.phone}</span>}
                {personal.location && <span>📍 {personal.location}</span>}
                {personal.linkedin && <span>🔗 {personal.linkedin}</span>}
                {personal.github   && <span>🐙 {personal.github}</span>}
                {personal.website  && <span>🌐 {personal.website}</span>}
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
              {/* FIX: show actual URL text for LinkedIn / GitHub / Website */}
              <div className="prev-contacts" style={{ justifyContent: template === "minimal" ? "flex-start" : "center" }}>
                {personal.email    && <span>✉ {personal.email}</span>}
                {personal.phone    && <span>📞 {personal.phone}</span>}
                {personal.location && <span>📍 {personal.location}</span>}
                {personal.linkedin && <span>🔗 {personal.linkedin}</span>}
                {personal.github   && <span>🐙 {personal.github}</span>}
                {personal.website  && <span>🌐 {personal.website}</span>}
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
  const skillGroups = groupSkills(skills);

  return (
    <>
      {/* Summary */}
      {summary && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Summary</div>
          <p style={{ fontSize: 9.5, color: "#333", lineHeight: 1.6 }}>{summary}</p>
        </div>
      )}

      {/* Experience — FIX: Company above Role */}
      {experience.filter(e => e.company || e.role).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Experience</div>
          {experience.filter(e => e.company || e.role).map(exp => (
            <div key={exp.id} className="prev-entry">
              <div className="prev-entry-top">
                <div>
                  {/* FIX: Company is now the primary title, Role is subtitle */}
                  <div className="prev-entry-title">{exp.company || "Company"}</div>
                  <div className="prev-entry-sub">
                    {exp.role}{exp.location ? ` · ${exp.location}` : ""}
                  </div>
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

      {/* Skills — FIX: plain text, grouped by category, no bubbles, no level labels */}
      {skillGroups.length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Skills</div>
          {skillGroups.map(group => (
            <div key={group.category} className="prev-skill-row">
              {/* Only show category label if category was set */}
              {group.category && group.category !== "" && (
                <span className="prev-skill-category" style={{ color: accent.primary }}>
                  {group.label}:
                </span>
              )}
              <span className="prev-skill-names">
                {group.names.join(" · ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Projects — FIX: tech tags shown, Live URL shown */}
      {projects.filter(p => p.name).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Projects</div>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} className="prev-entry">
              <div className="prev-entry-top">
                <div style={{ flex: 1 }}>
                  <div className="prev-entry-title">
                    {proj.name}
                    {/* FIX: show technologies inline */}
                    {Array.isArray(proj.tech) && proj.tech.length > 0 && (
                      <span style={{ fontWeight: 400, color: "#666", marginLeft: 5, fontSize: 8.5 }}>
                        · {proj.tech.join(", ")}
                      </span>
                    )}
                  </div>
                  {/* FIX: Live URL shown below project name */}
                  {proj.link && (
                    <a
                      href={proj.link}
                      className="prev-proj-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accent.secondary }}
                    >
                      🔗 {proj.link}
                    </a>
                  )}
                  {proj.githubLink && (
                    <a
                      href={proj.githubLink}
                      className="prev-proj-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#555", marginLeft: proj.link ? 8 : 0 }}
                    >
                      🐙 GitHub
                    </a>
                  )}
                </div>
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

      {/* Certifications — FIX: Credential ID shown */}
      {certifications.filter(c => c.name).length > 0 && (
        <div className="prev-sec">
          <div className="prev-sec-title" style={{ color: accent.primary }}>Certifications</div>
          {certifications.filter(c => c.name).map(cert => (
            <div key={cert.id} className="prev-entry">
              <div className="prev-entry-top">
                <div>
                  <div className="prev-entry-title">{cert.name}</div>
                  <div className="prev-entry-sub">
                    {cert.issuer}
                    {/* FIX: Credential ID shown here */}
                    {cert.credentialId && (
                      <span style={{ color: "#777", marginLeft: 5 }}>
                        · ID: {cert.credentialId}
                      </span>
                    )}
                  </div>
                  {/* Certificate link */}
                  {cert.link && (
                    <a
                      href={cert.link}
                      className="prev-proj-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accent.secondary }}
                    >
                      🔗 View Certificate
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