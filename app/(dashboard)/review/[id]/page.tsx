"use client";
// app/(dashboard)/review/[id]/page.tsx
// Added: "Fix in Builder" button that extracts resumeText from the review
// sessionStorage entry, sends it through the AI parse API, and navigates
// to /resume/create?import=1 with the form pre-populated.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { ReviewSection, ReviewIssue } from "@/types";

// ─── Types ────────────────────────────────────────────────────
interface ReviewData {
  overallScore:  number;
  sections:      ReviewSection[];
  topFixes:      ReviewIssue[];
  isPremium:     boolean;
  fileName:      string;
  reviewedAt:    string;
  resumeId:      string | null;
  resumeText?:   string; // stored by upload page for "Fix in Builder"
}

// ─── Score ring ───────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r      = 54;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color  =
    score >= 75 ? "var(--success)" :
    score >= 50 ? "var(--warning)" :
    "var(--error)";
  const label  =
    score >= 75 ? "Excellent" :
    score >= 60 ? "Good"      :
    score >= 40 ? "Fair"      :
    "Needs Work";

  return (
    <div className="score-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="10"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text x="70" y="65" textAnchor="middle" fill="var(--text-primary)"
          fontSize="30" fontWeight="900" fontFamily="var(--font-display)">{score}</text>
        <text x="70" y="84" textAnchor="middle" fill="var(--text-secondary)"
          fontSize="10" fontFamily="var(--font-body)">OVERALL</text>
      </svg>
      <div className="score-label" style={{ color }}>{label}</div>
    </div>
  );
}

// ─── Gradient score bar ───────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${score}%` }} />
        <div className="score-bar-marker" style={{ left: `${score}%` }} title={`Your score: ${score}`} />
        <div className="score-bar-marker top-marker" style={{ left: "88%" }} title="Top resumes: 88" />
      </div>
      <div className="score-bar-labels">
        <span>0</span>
        <div className="score-bar-legend">
          <span className="legend-dot you" />Your resume
          <span className="legend-dot top" style={{ marginLeft: "var(--space-4)" }} />Top resumes
        </div>
        <span>100</span>
      </div>
    </div>
  );
}

// ─── Section row ──────────────────────────────────────────────
function SectionRow({ section, isPremium, onUpgrade }: {
  section:   ReviewSection;
  isPremium: boolean;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sectionRequiresPremium = section.isPremium ?? false;
  const locked = sectionRequiresPremium && !isPremium;
  const color =
    section.score >= 75 ? "var(--success)" :
    section.score >= 50 ? "var(--warning)" :
    "var(--error)";
  const LABELS: Record<string, string> = {
    ats_compatibility: "ATS Compatibility",
    keywords:          "Keyword Density",
    quantified_impact: "Quantified Impact",
    summary:           "Summary Quality",
    formatting:        "Formatting",
    length:            "Length & Depth",
    action_verbs:      "Action Verbs",
    skills:            "Skills Match",
  };

  return (
    <div className={`section-row${open && !locked ? " open" : ""}${locked ? " locked" : ""}`}>
      <div className="section-row-header"
        onClick={() => setOpen(v => !v)}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === "Enter" && setOpen(v => !v)}
      >
        {locked && (
          <svg className="lock-icon" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="2" y="5.5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        )}
        <span className="section-label">{LABELS[section.category] ?? section.label}</span>
        <div className="mini-bar-wrap">
          <div className="mini-bar-track">
            <div className="mini-bar-fill" style={{ width: locked ? "0%" : `${section.score}%`, background: color }} />
          </div>
        </div>
        <span className="section-score" style={{ color: locked ? "var(--text-disabled)" : color }}>
          {locked ? "—" : section.score}
        </span>
        {!locked && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
            <path d="M3 5l4 4 4-4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {locked && <span className="unlock-cta">Unlock →</span>}
      </div>

      {open && (
        <div className="section-issues">
          {locked ? (
            <div className="section-upgrade-prompt">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, color: "var(--gold)" }}>
                <rect x="2" y="7" width="11" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <div>
                <p className="upgrade-prompt-title">Premium feature</p>
                <p className="upgrade-prompt-body">Upgrade to see all issues and fixes for this section.</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: "var(--space-3)" }}
                  onClick={e => { e.stopPropagation(); onUpgrade(); }}>
                  Unlock Full Report →
                </button>
              </div>
            </div>
          ) : section.issues.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--success)", padding: "var(--space-3) 0" }}>
              ✓ No issues found in this section.
            </p>
          ) : (
            section.issues.map((issue, i) => (
              <div key={i} className={`issue-item issue-${issue.severity}`}>
                <div className="issue-header">
                  <span className={`issue-badge badge-${issue.severity}`}>
                    {issue.severity === "critical" ? "Critical" : issue.severity === "warning" ? "Warning" : "Tip"}
                  </span>
                  <span className="issue-msg">{issue.message}</span>
                </div>
                <div className="issue-fix">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {issue.fix}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Top fix ──────────────────────────────────────────────────
function TopFixItem({ fix, index, isPremium, onUpgrade }: {
  fix: ReviewIssue; index: number; isPremium: boolean; onUpgrade: () => void;
}) {
  const locked = !isPremium;
  return (
    <div className={`top-fix${locked ? " top-fix-locked" : ""}`}
      onClick={locked ? onUpgrade : undefined}
      role={locked ? "button" : undefined}
    >
      <div className="top-fix-num">{index + 1}</div>
      <div className="top-fix-body">
        {locked ? (
          <div className="top-fix-blur">
            <div className="top-fix-msg blurred">Upgrade to see this improvement</div>
            <div className="top-fix-fix blurred">Unlock full report to see the fix</div>
          </div>
        ) : (
          <>
            <div className={`top-fix-msg sev-${fix.severity}`}>{fix.message}</div>
            <div className="top-fix-fix">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1.5 5.5h8M5.5 1.5l4 4-4 4" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {fix.fix}
            </div>
          </>
        )}
      </div>
      {locked && (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, color: "var(--text-disabled)" }}>
          <rect x="2" y="5.5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
    </div>
  );
}

// ─── Fix in Builder button ────────────────────────────────────
function FixInBuilderButton({ reviewId, data, getIdToken }: {
  reviewId:    string | null;
  data:        ReviewData;
  getIdToken:  () => Promise<string | null>;
}) {
  const router    = useRouter();
  const [loading, setLoading] = useState(false);

  const handle = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Use resumeText stored in sessionStorage (put there by upload page)
      const raw       = reviewId ? sessionStorage.getItem(`review:${reviewId}`) : null;
      const stored    = raw ? JSON.parse(raw) : null;
      const text: string | null = stored?.resumeText ?? data.resumeText ?? null;

      if (!text || text.length < 30) {
        toast.error("No resume text available to import. Try re-uploading.");
        return;
      }

      // 2. Parse via AI to get structured form data
      const token = await getIdToken();
      if (!token) { toast.error("Session expired."); return; }

      const res = await fetch("/api/ai/parse-resume", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText: text }),
      });

      let parsed: Record<string, unknown>;
      if (res.ok) {
        parsed = await res.json();
      } else {
        // Fallback: basic extraction
        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
        const lines      = text.split(/\r?\n/).filter(Boolean);
        parsed = {
          title:        (lines[0] ?? "Imported Resume").split(" ")[0] + "'s Resume",
          personalInfo: { fullName: lines[0] ?? "", email: emailMatch?.[0] ?? "", phone: "", location: "", linkedin: "", github: "", website: "", jobTitle: "" },
          summary: "", experience: [], education: [], skills: [], projects: [], certifications: [],
        };
      }

      // 3. Store and navigate
      sessionStorage.setItem("import:resume", JSON.stringify(parsed));
      router.push("/resume/create?import=1");

    } catch (err) {
      toast.error((err as Error).message ?? "Could not open builder.");
    } finally {
      setLoading(false);
    }
  }, [reviewId, data, getIdToken, router]);

  return (
    <button
      className={`btn btn-primary btn-sm${loading ? " btn-loading" : ""}`}
      onClick={handle}
      disabled={loading}
      title="Extract text from this review and open it in the resume builder"
    >
      {loading ? "" : (
        <>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 11h9M7.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.5 5H4.5a2 2 0 00-2 2v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Fix in Builder
        </>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function ReviewResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router               = useRouter();
  const { user, getIdToken } = useAuth();

  const [reviewId,  setReviewId]  = useState<string | null>(null);
  const [data,      setData]      = useState<ReviewData | null>(null);
  const [notFound,  setNotFound]  = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setReviewId(id);
      const raw = sessionStorage.getItem(`review:${id}`);
      if (!raw) { setNotFound(true); return; }
      try { setData(JSON.parse(raw) as ReviewData); }
      catch { setNotFound(true); }
    });
  }, [params]);

  async function handleUpgrade() {
    if (!user) return;
    setUpgrading(true);
    try {
      const token = await getIdToken();
      if (!token) { alert("Session expired. Please sign in again."); return; }
      const res  = await fetch("/api/payments/checkout", {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.url) { window.location.href = json.url; return; }
      throw new Error();
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setUpgrading(false);
    }
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
        <div className="bg-mesh" />
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>Review not found</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>This review may have expired. Please upload your resume again.</p>
        <Link href="/review/upload" className="btn btn-primary">Upload Again</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="bg-mesh" />
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const isPremium   = data.isPremium || (data.resumeId ? (user?.unlockedResumes?.includes(data.resumeId) ?? false) : false);
  const userName    = user?.displayName?.split(" ")[0] ?? "there";
  const lockedCount = data.sections.filter(s => (s.isPremium ?? false) && !isPremium).length;
  // Show "Fix in Builder" only when we have resume text to work with
  const hasResumeText = !!(data.resumeText && data.resumeText.length > 30);

  return (
    <>
      <style>{`
        .results-page { min-height: 100vh; display: flex; flex-direction: column; }

        .topbar { position: sticky; top: 0; z-index: var(--z-sticky); height: var(--nav-height); display: flex; align-items: center; justify-content: space-between; padding: 0 5vw; background: var(--bg-overlay); backdrop-filter: blur(18px); border-bottom: 1px solid var(--border); }
        .topbar-logo { font-family: var(--font-display); font-size: 1.3rem; font-weight: 900; color: var(--text-primary); text-decoration: none; letter-spacing: -0.02em; }
        .topbar-logo span { color: var(--gold); }
        .topbar-right { display: flex; align-items: center; gap: var(--space-4); }

        .results-body { flex: 1; display: grid; grid-template-columns: 340px 1fr; max-width: 1200px; margin: 0 auto; width: 100%; padding: var(--space-8) 5vw; gap: var(--space-6); align-items: start; }

        .left-panel { display: flex; flex-direction: column; gap: var(--space-5); position: sticky; top: calc(var(--nav-height) + var(--space-8)); }

        .score-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); animation: fade-up 0.4s var(--ease) both; }
        .score-greeting { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-2); }
        .score-greeting strong { color: var(--text-primary); }
        .score-ring-wrap { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); margin: var(--space-4) 0; }
        .score-label { font-size: var(--text-sm); font-weight: 600; }

        .score-bar-wrap { margin-top: var(--space-4); }
        .score-bar-track { position: relative; height: 12px; border-radius: 99px; background: linear-gradient(to right, #ef4444 0%, #f97316 25%, #eab308 50%, #84cc16 75%, #22c55e 100%); margin-bottom: var(--space-2); }
        .score-bar-fill { display: none; }
        .score-bar-marker { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 50%; background: #1a1a2e; border: 3px solid var(--text-primary); z-index: 2; }
        .score-bar-marker.top-marker { border-color: var(--gold); background: var(--gold); width: 10px; height: 10px; }
        .score-bar-labels { display: flex; align-items: center; justify-content: space-between; font-size: var(--text-xs); color: var(--text-secondary); }
        .score-bar-legend { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: var(--text-secondary); }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-primary); display: inline-block; }
        .legend-dot.top { background: var(--gold); }

        .fixes-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); animation: fade-up 0.4s 0.1s var(--ease) both; }
        .fixes-title { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-4); display: flex; align-items: center; justify-content: space-between; }
        .fixes-count { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 400; }

        .top-fix { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--border); }
        .top-fix:last-child { border-bottom: none; }
        .top-fix-locked { cursor: pointer; }
        .top-fix-locked:hover { background: var(--bg-elevated); margin: 0 calc(-1 * var(--space-2)); padding-left: var(--space-2); padding-right: var(--space-2); border-radius: var(--radius-sm); }
        .top-fix-num { width: 20px; height: 20px; border-radius: 50%; background: var(--gold-dim); border: 1px solid var(--gold-border); color: var(--gold-light); font-size: var(--text-xs); font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .top-fix-body { flex: 1; }
        .top-fix-msg { font-size: var(--text-sm); color: var(--text-primary); margin-bottom: 3px; font-weight: 500; }
        .top-fix-msg.sev-critical { color: var(--error); }
        .top-fix-msg.sev-warning  { color: var(--warning); }
        .top-fix-fix { font-size: var(--text-xs); color: var(--text-secondary); display: flex; align-items: flex-start; gap: var(--space-1); line-height: 1.5; }
        .blurred { filter: blur(4px); user-select: none; color: var(--text-disabled) !important; }
        .top-fix-blur { position: relative; }

        .upgrade-card { background: linear-gradient(135deg, var(--bg-surface), rgba(201,168,76,.06)); border: 1px solid var(--gold-border); border-radius: var(--radius-lg); padding: var(--space-5); text-align: center; animation: fade-up 0.4s 0.2s var(--ease) both; }
        .upgrade-card h4 { color: var(--text-primary); margin-bottom: var(--space-2); font-size: var(--text-base); }
        .upgrade-card p  { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4); }

        .right-panel { display: flex; flex-direction: column; gap: var(--space-4); }

        .results-header { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; align-items: center; justify-content: space-between; animation: fade-up 0.4s var(--ease) both; }
        .results-header-title { font-family: var(--font-display); font-size: var(--text-xl); color: var(--text-primary); font-weight: 700; }
        .results-header-meta  { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 3px; }
        .results-header-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

        /* ── Fix in Builder card ── */
        .fix-builder-card {
          background: linear-gradient(135deg, var(--bg-surface), rgba(201,168,76,.06));
          border: 1px solid var(--gold-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-4);
          animation: fade-up 0.4s 0.15s var(--ease) both;
        }
        .fix-builder-left { display: flex; align-items: center; gap: var(--space-4); }
        .fix-builder-icon {
          width: 42px; height: 42px; flex-shrink: 0;
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
        }
        .fix-builder-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
        .fix-builder-sub   { font-size: var(--text-xs); color: var(--text-secondary); }

        .sections-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; animation: fade-up 0.4s 0.1s var(--ease) both; }
        .sections-card-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .sections-card-title { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); }

        .section-row { border-bottom: 1px solid var(--border); transition: background var(--duration-fast); }
        .section-row:last-child { border-bottom: none; }
        .section-row.open { background: var(--bg-elevated); }
        .section-row.locked { opacity: 0.75; }
        .section-row-header { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); cursor: pointer; transition: background var(--duration-fast); }
        .section-row-header:hover { background: var(--bg-elevated); }
        .lock-icon { color: var(--text-disabled); flex-shrink: 0; }
        .section-label { font-size: var(--text-sm); color: var(--text-primary); font-weight: 500; flex: 1; }
        .mini-bar-wrap { width: 100px; flex-shrink: 0; }
        .mini-bar-track { height: 5px; background: var(--bg-base); border-radius: 99px; overflow: hidden; }
        .mini-bar-fill  { height: 100%; border-radius: 99px; transition: width 0.8s var(--ease); }
        .section-score  { font-size: var(--text-sm); font-weight: 700; min-width: 28px; text-align: right; }
        .unlock-cta { font-size: var(--text-xs); color: var(--gold); font-weight: 600; white-space: nowrap; }

        .section-issues { padding: var(--space-3) var(--space-5) var(--space-4); }
        .issue-item { padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-2); border: 1px solid var(--border); background: var(--bg-base); }
        .issue-item:last-child { margin-bottom: 0; }
        .issue-header { display: flex; align-items: flex-start; gap: var(--space-2); margin-bottom: var(--space-2); }
        .issue-badge { font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 99px; white-space: nowrap; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge-critical   { background: var(--error-dim);   color: var(--error);   border: 1px solid rgba(248,113,113,0.2); }
        .badge-warning    { background: var(--warning-dim); color: var(--warning); border: 1px solid rgba(251,191,36,0.2); }
        .badge-suggestion { background: var(--info-dim);    color: var(--info);    border: 1px solid rgba(96,165,250,0.2); }
        .issue-msg { font-size: var(--text-sm); color: var(--text-primary); font-weight: 500; line-height: 1.4; }
        .issue-fix { font-size: var(--text-xs); color: var(--text-secondary); display: flex; align-items: flex-start; gap: var(--space-1); line-height: 1.55; }

        .section-upgrade-prompt { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4); background: linear-gradient(135deg, var(--bg-base), rgba(201,168,76,.04)); border: 1px solid var(--gold-border); border-radius: var(--radius-md); }
        .upgrade-prompt-title { font-size: var(--text-sm); font-weight: 600; color: var(--gold-light); margin-bottom: var(--space-1); }
        .upgrade-prompt-body  { font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.6; }

        .improve-tip { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); animation: fade-up 0.4s 0.2s var(--ease) both; }
        .improve-tip p { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.7; }
        .improve-tip strong { color: var(--text-primary); }

        @media (max-width: 860px) {
          .results-body { grid-template-columns: 1fr; }
          .left-panel   { position: static; }
          .mini-bar-wrap { display: none; }
          .fix-builder-card { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="bg-mesh" />
      <div className="bg-grain" />

      <div className="results-page">
        <header className="topbar">
          <Link href="/" className="topbar-logo">Resu<span>fii</span></Link>
          <div className="topbar-right">
            <Link href="/review/upload" className="btn btn-secondary btn-sm">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v8M3.5 4L6.5 1l3 3M1.5 10v1.5a1 1 0 001 1h8a1 1 0 001-1V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Re-score Resume
            </Link>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
          </div>
        </header>

        <main className="results-body">
          {/* ── Left panel ── */}
          <div className="left-panel">
            <div className="score-card">
              <p className="score-greeting">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
                <strong>{userName}.</strong>
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Welcome to your resume review.
              </p>
              <ScoreRing score={data.overallScore} />
              <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Your resume scored{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{data.overallScore} out of 100.</strong>
                  {data.overallScore < 70 && (
                    <> With a few targeted fixes you can increase your score by <strong style={{ color: "var(--gold)" }}>20+ points.</strong></>
                  )}
                </p>
              </div>
              <ScoreBar score={data.overallScore} />
            </div>

            <div className="fixes-card">
              <div className="fixes-title">
                Top Fixes
                <span className="fixes-count">
                  {isPremium ? `${data.topFixes.length} issues` : `${lockedCount} locked`}
                </span>
              </div>
              {data.topFixes.map((fix, i) => (
                <TopFixItem key={i} fix={fix} index={i} isPremium={isPremium} onUpgrade={handleUpgrade} />
              ))}
            </div>

            {!isPremium && (
              <div className="upgrade-card">
                <h4>Unlock full report</h4>
                <p>
                  See all {data.sections.length} section scores, every issue, and exactly how to fix them — one-time payment.
                </p>
                <button
                  className={`btn btn-primary${upgrading ? " btn-loading" : ""}`}
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleUpgrade}
                  disabled={upgrading}
                >
                  {upgrading ? "" : "Unlock Full Report — $2 →"}
                </button>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)", marginTop: "var(--space-3)" }}>
                  One-time payment · Lifetime access · No subscription
                </p>
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div className="right-panel">
            {/* Header */}
            <div className="results-header">
              <div>
                <div className="results-header-title">Resume Review</div>
                <div className="results-header-meta">
                  {data.fileName} · Reviewed {new Date(data.reviewedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </div>
              </div>
              <div className="results-header-actions">
                {data.resumeId && (
                  <Link href={`/resume/${data.resumeId}/edit`} className="btn btn-secondary btn-sm">
                    Edit Resume
                  </Link>
                )}
                <Link href="/resume/new" className="btn btn-ghost btn-sm">
                  New Resume
                </Link>
              </div>
            </div>

            {/* ── Fix in Builder card ── */}
            {hasResumeText && (
              <div className="fix-builder-card">
                <div className="fix-builder-left">
                  <div className="fix-builder-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 17h14M10 3v10M6 9l4 4 4-4" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="fix-builder-title">Apply fixes in the builder</div>
                    <div className="fix-builder-sub">
                      Import this resume into the editor — your text is pre-filled and ready to improve.
                    </div>
                  </div>
                </div>
                <FixInBuilderButton
                  reviewId={reviewId}
                  data={data}
                  getIdToken={getIdToken}
                />
              </div>
            )}

            {/* Section breakdown */}
            <div className="sections-card">
              <div className="sections-card-header">
                <div className="sections-card-title">Section Breakdown</div>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  {isPremium
                    ? `${data.sections.length} categories`
                    : `${data.sections.filter(s => !(s.isPremium ?? false)).length} of ${data.sections.length} visible`}
                </span>
              </div>
              {data.sections.map(section => (
                <SectionRow
                  key={section.category}
                  section={section}
                  isPremium={isPremium}
                  onUpgrade={handleUpgrade}
                />
              ))}
            </div>

            <div className="improve-tip">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginBottom: "var(--space-2)", color: "var(--gold)" }}>
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <p>
                <strong>Did you know?</strong> 80% of people increase their score by over 20 points with
                just 2–3 targeted revisions. Focus on the <strong>Critical</strong> issues first, then
                move to warnings. Once done, re-upload to get a fresh score.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}