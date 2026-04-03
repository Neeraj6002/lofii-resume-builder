// components/templates/Minimal.tsx
// ============================================================
// MINIMAL TEMPLATE
// Clean, left-aligned layout. Grey accent.
// Maximum whitespace, no decorative elements.
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

const ACCENT = "#374151";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8, fontWeight: 700, letterSpacing: "0.16em",
      textTransform: "uppercase" as const, color: "#9ca3af",
      marginBottom: 8, marginTop: 2,
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
        <div key={i} style={{ fontSize: 9, color: "#4b5563", paddingLeft: 8, lineHeight: 1.5 }}>
          – {l}
        </div>
      ))}
    </div>
  );
}

export default function Minimal({
  personal, summary, experience, education, skills, projects, certifications,
}: Props) {
  return (
    <div style={{
      background: "#fff", fontFamily: "'Georgia', serif",
      fontSize: 10, lineHeight: 1.55, color: "#1f2937",
      padding: "40px 48px", minHeight: 920,
    }}>
      {/* Header — left-aligned */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT, marginBottom: 2, letterSpacing: "-0.01em" }}>
          {personal.fullName || "Your Name"}
        </div>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
          {personal.jobTitle}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12, fontSize: 8.5, color: "#6b7280" }}>
          {personal.email    && <span>{personal.email}</span>}
          {personal.phone    && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
          {personal.linkedin && <span>LinkedIn</span>}
          {personal.github   && <span>GitHub</span>}
        </div>
      </div>

      <div style={{ height: 1, background: "#e5e7eb", marginBottom: 16 }} />

      {/* Summary */}
      {summary && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>About</SectionTitle>
          <p style={{ fontSize: 9.5, color: "#4b5563", lineHeight: 1.65 }}>{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.filter(e => e.company || e.role).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Work Experience</SectionTitle>
          {experience.filter(e => e.company || e.role).map(exp => (
            <div key={exp.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>{exp.role}</div>
                <div style={{ fontSize: 8.5, color: "#9ca3af" }}>
                  {exp.startDate}{exp.startDate && " – "}{exp.current ? "Present" : exp.endDate}
                </div>
              </div>
              <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 2 }}>
                {exp.company}{exp.location ? `, ${exp.location}` : ""}
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
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>{edu.institution}</div>
                <div style={{ fontSize: 8.5, color: "#9ca3af" }}>
                  {edu.startDate}{edu.startDate && " – "}{edu.current ? "Present" : edu.endDate}
                </div>
              </div>
              <div style={{ fontSize: 9, color: "#6b7280" }}>{edu.degree}{edu.field ? ` · ${edu.field}` : ""}</div>
              {edu.description && <p style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{edu.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {skills.filter(s => s.name).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Skills</SectionTitle>
          <div style={{ fontSize: 9.5, color: "#4b5563", lineHeight: 1.7 }}>
            {skills.filter(s => s.name).map(s => s.name).join("  ·  ")}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.filter(p => p.name).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Projects</SectionTitle>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>
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
  );
}