// components/templates/Modern.tsx
// ============================================================
// MODERN TEMPLATE
// Blue accent, left colour strip, clean sans-serif feel.
// Two-column header with contact on the right.
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

const ACCENT  = "#2563eb";
const ACCENT2 = "#eff6ff";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase" as const, color: ACCENT,
      borderBottom: `2px solid ${ACCENT}`, paddingBottom: 3,
      marginBottom: 8,
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
        <div key={i} style={{ fontSize: 9, color: "#374151", paddingLeft: 10, lineHeight: 1.5, position: "relative" as const }}>
          <span style={{ position: "absolute" as const, left: 2, color: ACCENT }}>›</span>
          {l}
        </div>
      ))}
    </div>
  );
}

export default function Modern({
  personal, summary, experience, education, skills, projects, certifications,
}: Props) {
  return (
    <div style={{
      background: "#fff", fontFamily: "'Arial', 'Helvetica', sans-serif",
      fontSize: 10, lineHeight: 1.55, color: "#1f2937",
      minHeight: 920, display: "flex" as const,
    }}>
      {/* Left colour strip */}
      <div style={{ width: 6, background: ACCENT, flexShrink: 0 }} />

      {/* Main content */}
      <div style={{ flex: 1, padding: "44px 48px" }}>

        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          marginBottom: 20, paddingBottom: 14,
          borderBottom: `1px solid #e5e7eb`,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT, marginBottom: 3, letterSpacing: "-0.01em" }}>
              {personal.fullName || "Your Name"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
              {personal.jobTitle || "Your Job Title"}
            </div>
          </div>

          {/* Contact block */}
          <div style={{ textAlign: "right", fontSize: 8.5, color: "#6b7280", display: "flex", flexDirection: "column" as const, gap: 3 }}>
            {personal.email    && <span>{personal.email}</span>}
            {personal.phone    && <span>{personal.phone}</span>}
            {personal.location && <span>{personal.location}</span>}
            {personal.linkedin && <span style={{ color: ACCENT }}>LinkedIn</span>}
            {personal.github   && <span style={{ color: ACCENT }}>GitHub</span>}
            {personal.website  && <span style={{ color: ACCENT }}>Portfolio</span>}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Professional Summary</SectionTitle>
            <p style={{ fontSize: 9.5, color: "#4b5563", lineHeight: 1.65 }}>{summary}</p>
          </div>
        )}

        {/* Experience */}
        {experience.filter(e => e.company || e.role).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Work Experience</SectionTitle>
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
                    fontSize: 8, color: "#fff", background: ACCENT,
                    padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" as const, marginLeft: 6,
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
              <div key={edu.id} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>{edu.institution}</div>
                    <div style={{ fontSize: 9, color: "#6b7280" }}>
                      {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 8, color: "#fff", background: ACCENT,
                    padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" as const, marginLeft: 6,
                  }}>
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
            <SectionTitle>Skills</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
              {skills.filter(s => s.name).map(s => (
                <span key={s.id} style={{
                  fontSize: 8.5, padding: "3px 8px",
                  background: ACCENT2, color: ACCENT,
                  border: `1px solid ${ACCENT}`, borderRadius: 4,
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
              <div key={proj.id} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>
                  {proj.name}
                  {proj.tech.length > 0 && (
                    <span style={{ fontWeight: 400, color: ACCENT, marginLeft: 6, fontSize: 8.5 }}>
                      {proj.tech.join(" · ")}
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
                <span style={{
                  fontSize: 8, color: "#fff", background: ACCENT,
                  padding: "2px 8px", borderRadius: 99,
                }}>
                  {cert.date}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}