"use client";
// components/review/ReviewSection.tsx
// ============================================================
// REVIEW SECTION
// One expandable row in the section breakdown.
// Shows score bar, issues on expand, premium lock if needed.
// ============================================================

import { useState } from "react";
import type { ReviewSection as ReviewSectionType, ReviewIssue } from "@/types";

interface Props {
  section:    ReviewSectionType;
  isPremium:  boolean;
  onUpgrade:  () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ats_compatibility: "ATS Compatibility",
  keywords:          "Keyword Density",
  quantified_impact: "Quantified Impact",
  summary:           "Summary Quality",
  formatting:        "Formatting",
  length:            "Length & Depth",
  action_verbs:      "Action Verbs",
  skills:            "Skills Match",
};

function scoreColor(score: number): string {
  if (score >= 75) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--error)";
}

function IssueItem({ issue }: { issue: ReviewIssue }) {
  return (
    <div
      style={{
        padding: "var(--space-3)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-2)",
        border: "1px solid var(--border)",
        background: "var(--bg-base)",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <span
          style={{
            fontSize: "0.62rem", fontWeight: 700, padding: "2px 7px",
            borderRadius: "99px", whiteSpace: "nowrap", flexShrink: 0,
            textTransform: "uppercase", letterSpacing: "0.05em",
            ...(issue.severity === "critical"
              ? { background: "var(--error-dim)",   color: "var(--error)",   border: "1px solid rgba(248,113,113,.2)" }
              : issue.severity === "warning"
              ? { background: "var(--warning-dim)", color: "var(--warning)", border: "1px solid rgba(251,191,36,.2)"  }
              : { background: "var(--info-dim)",    color: "var(--info)",    border: "1px solid rgba(96,165,250,.2)"  }),
          }}
        >
          {issue.severity === "critical" ? "Critical" :
           issue.severity === "warning"  ? "Warning"  : "Tip"}
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>
          {issue.message}
        </span>
      </div>

      {/* Fix row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-1)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, marginTop: 2, color: "var(--gold)" }}>
          <path d="M1.5 5.5h8M5.5 1.5l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {issue.fix}
      </div>
    </div>
  );
}

export default function ReviewSection({ section, isPremium, onUpgrade }: Props) {
  const [open, setOpen] = useState(false);
  const locked = section.isPremium && !isPremium;
  const color  = scoreColor(section.score);
  const label  = CATEGORY_LABELS[section.category] ?? section.label;

  return (
    <>
      <style>{`
        .rev-section-row {
          border-bottom: 1px solid var(--border);
          transition: background var(--duration-fast);
        }
        .rev-section-row:last-child { border-bottom: none; }
        .rev-section-row.open       { background: var(--bg-elevated); }
        .rev-section-row.locked     { opacity: 0.72; }

        .rev-section-header {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-4) var(--space-5); cursor: pointer;
          transition: background var(--duration-fast);
          user-select: none;
        }
        .rev-section-header:hover { background: var(--bg-elevated); }

        .rev-lock-icon { color: var(--text-disabled); flex-shrink: 0; }
        .rev-label     { font-size: var(--text-sm); font-weight: 500; color: var(--text-primary); flex: 1; }

        .rev-mini-bar  { width: 90px; flex-shrink: 0; }
        .rev-mini-track { height: 4px; background: var(--bg-base); border-radius: 99px; overflow: hidden; }
        .rev-mini-fill  { height: 100%; border-radius: 99px; transition: width 0.8s var(--ease); }

        .rev-score     { font-size: var(--text-sm); font-weight: 700; min-width: 26px; text-align: right; }
        .rev-unlock    { font-size: var(--text-xs); color: var(--gold); font-weight: 600; white-space: nowrap; }

        .rev-issues    { padding: 0 var(--space-5) var(--space-4); }
        .rev-no-issues { font-size: var(--text-sm); color: var(--success); padding: var(--space-3) 0; }

        @media (max-width: 640px) {
          .rev-mini-bar { display: none; }
        }
      `}</style>

      <div className={`rev-section-row${open && !locked ? " open" : ""}${locked ? " locked" : ""}`}>

        {/* Header */}
        <div
          className="rev-section-header"
          onClick={() => locked ? onUpgrade() : setOpen(v => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === "Enter" && (locked ? onUpgrade() : setOpen(v => !v))}
          aria-expanded={open && !locked}
        >
          {/* Lock icon */}
          {locked && (
            <svg className="rev-lock-icon" width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="2" y="5.5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}

          <span className="rev-label">{label}</span>

          {/* Mini bar */}
          <div className="rev-mini-bar">
            <div className="rev-mini-track">
              <div
                className="rev-mini-fill"
                style={{
                  width: locked ? "0%" : `${section.score}%`,
                  background: color,
                }}
              />
            </div>
          </div>

          {/* Score */}
          <span
            className="rev-score"
            style={{ color: locked ? "var(--text-disabled)" : color }}
          >
            {locked ? "—" : section.score}
          </span>

          {/* Chevron or unlock CTA */}
          {locked ? (
            <span className="rev-unlock">Unlock →</span>
          ) : (
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
                flexShrink: 0,
                color: "var(--text-secondary)",
              }}
            >
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        {/* Issues list */}
        {open && !locked && (
          <div className="rev-issues">
            {section.issues.length === 0 ? (
              <p className="rev-no-issues">✓ No issues found in this section.</p>
            ) : (
              section.issues.map((issue, i) => (
                <IssueItem key={i} issue={issue} />
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}