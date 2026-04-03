// components/templates/Executive.tsx
// ============================================================
// EXECUTIVE TEMPLATE
// Purple accent, formal two-line header with full-width
// divider. Suited for senior roles and leadership positions.
// ============================================================

import type {
  PersonalInfo, ExperienceItem, EducationItem,
  SkillItem, ProjectItem, CertificationItem,
} from "@/types";

interface Props {
  personal:       PersonalInfo;
  summary:        string;
  experience:     ExperienceItem[];
  education:      EducationItem[];
  skills:         SkillItem[];
  projects:       ProjectItem[];
  certifications: CertificationItem[];
}

const ACCENT = "#7c3aed";
const LIGHT  = "#f5f3ff";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{
        fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase" as const, color: ACCENT,
      }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: `${ACCENT}40` }} />
    </div>
  );
}

function Bullets({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, marginTop: 3 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 9, color: "#374151", paddingLeft: 10, lineHeight: 1.5, position: "relative" as const }}>
          <div style={{
            position: "absolute" as const, left: 2, top: 5,
            width: 4, height: 4, borderRadius: "50%", background: ACCENT,
          }} />
          {l}
        </div>
      ))}
    </div>
  );
}

export default function Executive({
  personal, summary, experience, education, skills, projects, certifications,
}: Props) {
  return (
    <div style={{
      background: "#fff", fontFamily: "'Georgia', serif",
      fontSize: 10, lineHeight: 1.55, color: "#1f2937",
      padding: "48px 52px", minHeight: 920,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `3px double ${ACCENT}` }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: ACCENT, letterSpacing: "0.02em", marginBottom: 2 }}>
          {personal.fullName || "Your Name"}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8, fontFamily: "Arial, sans-serif" }}>
          {personal.jobTitle || "Your Job Title"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 14, fontSize: 8.5, color: "#6b7280" }}>
          {personal.email    && <span>✉ {personal.email}</span>}
          {personal.phone    && <span>✆ {personal.phone}</span>}
          {personal.location && <span>⌖ {personal.location}</span>}
          {personal.linkedin && <span style={{ color: ACCENT }}>LinkedIn</span>}
          {personal.github   && <span style={{ color: ACCENT }}>GitHub</span>}
          {personal.website  && <span style={{ color: ACCENT }}>Portfolio</span>}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Executive Summary</SectionTitle>
          <p style={{ fontSize: 9.5, color: "#374151", lineHeight: 1.7, fontStyle: "italic" as const }}>
            {summary}
          </p>
        </div>
      )}

      {/* Experience */}
      {experience.filter(e => e.company || e.role).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Professional Experience</SectionTitle>
          {experience.filter(e => e.company || e.role).map(exp => (
            <div key={exp.id} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 1 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#111827" }}>{exp.role || "Role"}</div>
                  <div style={{ fontSize: 9, color: ACCENT, fontWeight: 600 }}>
                    {exp.company}{exp.location ? `, ${exp.location}` : ""}
                  </div>
                </div>
                <div style={{
                  fontSize: 8.5, color: ACCENT,
                  background: LIGHT, padding: "2px 8px",
                  borderRadius: 4, border: `1px solid ${ACCENT}40`,
                  whiteSpace: "nowrap" as const,
                }}>
                  {exp.startDate}{exp.startDate && " – "}{exp.current ? "Present" : exp.endDate}
                </div>
              </div>
              {exp.description && <Bullets text={exp.description} />}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {education.filter(e => e.institution).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Education</SectionTitle>
          {education.filter(e => e.institution).map(edu => (
            <div key={edu.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>{edu.institution}</div>
                  <div style={{ fontSize: 9, color: "#6b7280" }}>
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 8.5, color: "#9ca3af" }}>
                  {edu.startDate}{edu.startDate && " – "}{edu.current ? "Present" : edu.endDate}
                </div>
              </div>
              {edu.description && <p style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{edu.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {skills.filter(s => s.name).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Core Competencies</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px 12px" }}>
            {skills.filter(s => s.name).map(s => (
              <div key={s.id} style={{ fontSize: 9, color: "#374151", display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                {s.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.filter(p => p.name).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Key Projects</SectionTitle>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>
                {proj.name}
                {proj.tech.length > 0 && (
                  <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6, fontSize: 8.5 }}>
                    ({proj.tech.join(", ")})
                  </span>
                )}
              </div>
              {proj.description && <Bullets text={proj.description} />}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {certifications.filter(c => c.name).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Certifications</SectionTitle>
          {certifications.filter(c => c.name).map(cert => (
            <div key={cert.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: "#1f2937" }}>{cert.name}</span>
                {cert.issuer && <span style={{ fontSize: 9, color: "#6b7280", marginLeft: 5 }}>· {cert.issuer}</span>}
              </div>
              <span style={{ fontSize: 8.5, color: "#9ca3af" }}>{cert.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}