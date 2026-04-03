// components/templates/Classic.tsx
// ============================================================
// CLASSIC TEMPLATE
// Traditional resume style — dark navy header accent,
// centre-aligned header, serif body text.
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

const ACCENT = "#1a1a2e";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase" as const, color: ACCENT,
      borderBottom: `1.5px solid ${ACCENT}`, paddingBottom: 3,
      marginBottom: 7,
    }}>
      {children}
    </div>
  );
}

function Bullets({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, marginTop: 3 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 9, color: "#333", paddingLeft: 8, lineHeight: 1.5 }}>
          • {l}
        </div>
      ))}
    </div>
  );
}

export default function Classic({
  personal, summary, experience, education, skills, projects, certifications,
}: Props) {
  return (
    <div style={{
      background: "#fff", fontFamily: "'Georgia', serif",
      fontSize: 10, lineHeight: 1.55, color: "#1a1a1a",
      padding: "48px 52px", minHeight: 920,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: `2px solid ${ACCENT}`, paddingBottom: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: ACCENT, marginBottom: 3 }}>
          {personal.fullName || "Your Name"}
        </div>
        <div style={{ fontSize: 11, color: "#444", marginBottom: 8 }}>
          {personal.jobTitle || "Your Job Title"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: 10, fontSize: 8.5, color: "#555" }}>
          {personal.email    && <span>{personal.email}</span>}
          {personal.phone    && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
          {personal.linkedin && <span>LinkedIn</span>}
          {personal.github   && <span>GitHub</span>}
          {personal.website  && <span>Portfolio</span>}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Summary</SectionTitle>
          <p style={{ fontSize: 9.5, color: "#333", lineHeight: 1.6 }}>{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.filter(e => e.company || e.role).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Experience</SectionTitle>
          {experience.filter(e => e.company || e.role).map(exp => (
            <div key={exp.id} style={{ marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 1 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>{exp.role || "Role"}</div>
                  <div style={{ fontSize: 9, color: "#555" }}>{exp.company}{exp.location ? ` · ${exp.location}` : ""}</div>
                </div>
                <div style={{ fontSize: 8.5, color: "#666", whiteSpace: "nowrap" as const, marginLeft: 6 }}>
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
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Education</SectionTitle>
          {education.filter(e => e.institution).map(edu => (
            <div key={edu.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700 }}>{edu.institution}</div>
                  <div style={{ fontSize: 9, color: "#555" }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</div>
                </div>
                <div style={{ fontSize: 8.5, color: "#666", whiteSpace: "nowrap" as const, marginLeft: 6 }}>
                  {edu.startDate}{edu.startDate && " – "}{edu.current ? "Present" : edu.endDate}
                </div>
              </div>
              {edu.description && <p style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{edu.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {skills.filter(s => s.name).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Skills</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
            {skills.filter(s => s.name).map(s => (
              <span key={s.id} style={{ fontSize: 8.5, padding: "2px 7px", border: `1px solid ${ACCENT}`, borderRadius: 99, color: ACCENT }}>
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.filter(p => p.name).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Projects</SectionTitle>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700 }}>
                {proj.name}
                {proj.tech.length > 0 && (
                  <span style={{ fontWeight: 400, color: "#666", marginLeft: 5 }}>· {proj.tech.join(", ")}</span>
                )}
              </div>
              {proj.description && <Bullets text={proj.description} />}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {certifications.filter(c => c.name).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Certifications</SectionTitle>
          {certifications.filter(c => c.name).map(cert => (
            <div key={cert.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>{cert.name}</div>
                <div style={{ fontSize: 9, color: "#555" }}>{cert.issuer}</div>
              </div>
              <div style={{ fontSize: 8.5, color: "#666" }}>{cert.date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}