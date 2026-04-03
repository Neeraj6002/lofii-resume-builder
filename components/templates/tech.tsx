// components/templates/Tech.tsx
// ============================================================
// TECH TEMPLATE
// Green accent, monospace font, terminal-inspired aesthetic.
// Perfect for software engineers and developers.
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

const ACCENT = "#059669";
const LIGHT  = "#ecfdf5";
const MONO   = "'Courier New', 'Cascadia Code', monospace";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase" as const, color: ACCENT,
      fontFamily: MONO, marginBottom: 8,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ color: ACCENT, fontSize: 10 }}>▸</span>
      {children}
      <div style={{ flex: 1, height: 1, background: `${ACCENT}30`, marginLeft: 4 }} />
    </div>
  );
}

function Bullets({ text }: { text: string }) {
  const lines = text.split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, marginTop: 3 }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          fontSize: 9, color: "#374151", paddingLeft: 12,
          lineHeight: 1.5, position: "relative" as const,
          fontFamily: "Arial, sans-serif",
        }}>
          <span style={{ position: "absolute" as const, left: 2, color: ACCENT, fontFamily: MONO }}>$</span>
          {l}
        </div>
      ))}
    </div>
  );
}

function SkillGroup({ category, items }: { category: string; items: SkillItem[] }) {
  return (
    <div style={{ marginBottom: 5 }}>
      {category && (
        <span style={{ fontSize: 8, color: "#9ca3af", fontFamily: MONO, marginRight: 6 }}>
          {category}:
        </span>
      )}
      <span style={{ fontSize: 9, color: "#374151" }}>
        {items.map(s => s.name).join("  ·  ")}
      </span>
    </div>
  );
}

export default function Tech({
  personal, summary, experience, education, skills, projects, certifications,
}: Props) {
  // Group skills by category
  const grouped = skills.filter(s => s.name).reduce((acc, s) => {
    const cat = s.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, SkillItem[]>);

  return (
    <div style={{
      background: "#fff", fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 10, lineHeight: 1.55, color: "#1f2937",
      padding: "40px 48px", minHeight: 920,
    }}>
      {/* Header — terminal style */}
      <div style={{
        background: "#111827", borderRadius: 8,
        padding: "16px 20px", marginBottom: 20,
      }}>
        {/* Window dots */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
        </div>
        <div style={{ fontFamily: MONO }}>
          <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4 }}>
            <span style={{ color: ACCENT }}>~</span> whoami
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", marginBottom: 2 }}>
            {personal.fullName || "Your Name"}
          </div>
          <div style={{ fontSize: 10, color: ACCENT, marginBottom: 8 }}>
            // {personal.jobTitle || "Your Job Title"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12, fontSize: 8, color: "#9ca3af" }}>
            {personal.email    && <span><span style={{ color: "#6b7280" }}>email:</span> {personal.email}</span>}
            {personal.phone    && <span><span style={{ color: "#6b7280" }}>tel:</span> {personal.phone}</span>}
            {personal.location && <span><span style={{ color: "#6b7280" }}>loc:</span> {personal.location}</span>}
            {personal.github   && <span><span style={{ color: "#6b7280" }}>git:</span> {personal.github.replace("https://github.com/", "")}</span>}
            {personal.linkedin && <span style={{ color: ACCENT }}>linkedin</span>}
            {personal.website  && <span style={{ color: ACCENT }}>portfolio</span>}
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Summary</SectionTitle>
          <p style={{ fontSize: 9.5, color: "#4b5563", lineHeight: 1.65 }}>{summary}</p>
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
                  <div style={{ fontSize: 9, color: ACCENT, fontFamily: MONO }}>
                    @ {exp.company}{exp.location ? ` | ${exp.location}` : ""}
                  </div>
                </div>
                <div style={{
                  fontSize: 8, fontFamily: MONO, color: "#fff",
                  background: ACCENT, padding: "2px 8px",
                  borderRadius: 4, whiteSpace: "nowrap" as const,
                }}>
                  {exp.startDate}{exp.startDate && " → "}{exp.current ? "now" : exp.endDate}
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
                    {edu.degree}{edu.field ? ` · ${edu.field}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 8.5, color: "#9ca3af", fontFamily: MONO }}>
                  {edu.startDate}{edu.startDate && " – "}{edu.current ? "present" : edu.endDate}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {skills.filter(s => s.name).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Tech Stack</SectionTitle>
          <div style={{
            background: LIGHT, border: `1px solid ${ACCENT}30`,
            borderRadius: 6, padding: "8px 12px",
            fontFamily: MONO,
          }}>
            {Object.entries(grouped).map(([cat, items]) => (
              <SkillGroup key={cat} category={cat} items={items} />
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.filter(p => p.name).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>Projects</SectionTitle>
          {projects.filter(p => p.name).map(proj => (
            <div key={proj.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>{proj.name}</span>
                {proj.tech.length > 0 && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" as const }}>
                    {proj.tech.map((t, i) => (
                      <span key={i} style={{
                        fontSize: 7.5, padding: "1px 5px",
                        background: "#111827", color: ACCENT,
                        borderRadius: 3, fontFamily: MONO,
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
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
              <span style={{ fontSize: 8.5, color: "#9ca3af", fontFamily: MONO }}>{cert.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}