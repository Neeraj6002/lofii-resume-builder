// components/templates/Creative.tsx
// ============================================================
// CREATIVE TEMPLATE
// Bold pink header band, white body, energetic feel.
// Good for designers, marketers, content creators.
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

const ACCENT = "#db2777";
const LIGHT  = "#fdf2f8";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      color: ACCENT, marginBottom: 8,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{ width: 16, height: 2, background: ACCENT, borderRadius: 1 }} />
      {children}
    </div>
  );
}

function Bullets({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, marginTop: 3 }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          fontSize: 9, color: "#374151", paddingLeft: 10,
          lineHeight: 1.5, position: "relative" as const,
          borderLeft: `2px solid ${ACCENT}30`, marginLeft: 4,
          paddingTop: 1, paddingBottom: 1,
        }}>
          {l}
        </div>
      ))}
    </div>
  );
}

export default function Creative({
  personal, summary, experience, education, skills, projects, certifications,
}: Props) {
  return (
    <div style={{
      background: "#fff", fontFamily: "'Arial', 'Helvetica', sans-serif",
      fontSize: 10, lineHeight: 1.55, color: "#1f2937", minHeight: 920,
    }}>
      {/* Coloured header band */}
      <div style={{ background: ACCENT, padding: "36px 48px 28px" }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 3, letterSpacing: "-0.01em" }}>
          {personal.fullName || "Your Name"}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginBottom: 10, letterSpacing: "0.04em" }}>
          {personal.jobTitle || "Your Job Title"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 14, fontSize: 8.5, color: "rgba(255,255,255,0.75)" }}>
          {personal.email    && <span>{personal.email}</span>}
          {personal.phone    && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
          {personal.linkedin && <span>LinkedIn</span>}
          {personal.github   && <span>GitHub</span>}
          {personal.website  && <span>Portfolio</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "28px 48px" }}>

        {/* Summary */}
        {summary && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>About Me</SectionTitle>
            <p style={{ fontSize: 9.5, color: "#4b5563", lineHeight: 1.7 }}>{summary}</p>
          </div>
        )}

        {/* Experience */}
        {experience.filter(e => e.company || e.role).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Experience</SectionTitle>
            {experience.filter(e => e.company || e.role).map(exp => (
              <div key={exp.id} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>{exp.role || "Role"}</div>
                    <div style={{ fontSize: 9, color: ACCENT, fontWeight: 600 }}>
                      {exp.company}{exp.location ? ` · ${exp.location}` : ""}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 8, background: LIGHT, color: ACCENT,
                    padding: "2px 8px", borderRadius: 99,
                    border: `1px solid ${ACCENT}30`,
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
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {skills.filter(s => s.name).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Skills</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
              {skills.filter(s => s.name).map(s => (
                <span key={s.id} style={{
                  fontSize: 8.5, padding: "3px 9px",
                  background: LIGHT, color: ACCENT,
                  borderRadius: 99, border: `1px solid ${ACCENT}40`,
                  fontWeight: 500,
                }}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {projects.filter(p => p.name).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Projects</SectionTitle>
            {projects.filter(p => p.name).map(proj => (
              <div key={proj.id} style={{ marginBottom: 9, padding: "8px 10px", background: LIGHT, borderRadius: 6, borderLeft: `3px solid ${ACCENT}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                  {proj.name}
                  {proj.tech.length > 0 && (
                    <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 5, fontSize: 8.5 }}>
                      {proj.tech.join(", ")}
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
    </div>
  );
}