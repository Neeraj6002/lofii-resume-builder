"use client";
// components/resume/AIGenerateModal.tsx
// ============================================================
// AI GENERATE MODAL
// Pops up when user clicks "AI Write" on any resume section.
// Free users see a preview (1 bullet). The result is blurred
// and replaced with an inline paywall — no alert(), no blocking.
// Clicking "Unlock — $2" starts checkout and returns them here.
// ============================================================

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { startCheckout } from "@/services/user.service";
import type { AIContentType } from "@/types";

interface Props {
  type:       AIContentType;
  prefill?:   Record<string, string>;
  resumeId:   string;
  onInsert:   (content: string) => void;
  onClose:    () => void;
}

const FIELDS: Record<AIContentType, { key: string; label: string; placeholder: string; rows?: number }[]> = {
  summary: [
    { key: "jobTitle",   label: "Job Title",           placeholder: "Software Engineer"       },
    { key: "yearsExp",   label: "Years of Experience", placeholder: "3"                       },
    { key: "skills",     label: "Top Skills",          placeholder: "React, Node.js, AWS"     },
    { key: "industry",   label: "Industry",            placeholder: "FinTech"                 },
    { key: "targetRole", label: "Target Role",         placeholder: "Senior Engineer at a startup" },
  ],
  experience: [
    { key: "company",          label: "Company",               placeholder: "Google"                          },
    { key: "role",             label: "Role / Title",          placeholder: "Software Engineer"               },
    { key: "duration",         label: "Duration",              placeholder: "Jan 2022 – Dec 2024"             },
    { key: "responsibilities", label: "Key Responsibilities",  placeholder: "Built REST APIs, led a team...", rows: 3 },
    { key: "tech",             label: "Technologies Used",     placeholder: "React, Node.js, PostgreSQL"      },
    { key: "achievements",     label: "Key Achievements",      placeholder: "Reduced load time by 40%...",   rows: 2 },
  ],
  education: [
    { key: "institution", label: "Institution",          placeholder: "IIT Bombay"                        },
    { key: "degree",      label: "Degree",               placeholder: "B.Tech"                            },
    { key: "field",       label: "Field of Study",       placeholder: "Computer Science"                  },
    { key: "gpa",         label: "GPA / Grade",          placeholder: "8.9 / 10"                         },
    { key: "coursework",  label: "Relevant Coursework",  placeholder: "Data Structures, Algorithms, DBMS" },
    { key: "activities",  label: "Activities / Projects", placeholder: "IEEE Member, Hackathon winner"    },
  ],
  project: [
    { key: "name",        label: "Project Name",    placeholder: "RESUFII"                        },
    { key: "tech",        label: "Technologies",    placeholder: "React, Firebase, OpenRouter"     },
    { key: "description", label: "What it does",    placeholder: "An AI-powered resume builder...", rows: 2 },
    { key: "impact",      label: "Impact / Result", placeholder: "500+ users, reduced job search time by 50%" },
  ],
};

const TYPE_LABELS: Record<AIContentType, string> = {
  summary:    "Professional Summary",
  experience: "Experience Bullet Points",
  education:  "Education Description",
  project:    "Project Description",
};

export default function AIGenerateModal({ type, prefill = {}, resumeId, onInsert, onClose }: Props) {
  const { user, getIdToken } = useAuth();
  const isDocumentUnlocked = user?.unlockedResumes?.includes(resumeId) ?? false;
  const hasUnlocks = (user?.credits?.resumeUnlocks ?? 0) > 0;

  const fields = FIELDS[type];

  const [context, setContext] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, prefill[f.key] ?? ""]))
  );
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [paying,    setPaying]    = useState(false);

  function updateField(key: string, val: string) {
    setContext((prev) => ({ ...prev, [key]: val }));
  }

  async function handleGenerate() {
    if (!user) return;
    setLoading(true);
    setResult("");

    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Authentication expired. Please sign in again.");
        return;
      }

      const res = await fetch("/api/ai/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          context: {
            ...context,
            resumeId,
            __preview: (!isDocumentUnlocked && !hasUnlocks) ? "true" : "false",
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "PREMIUM_REQUIRED") {
          // Show inline paywall instead of error toast
          setIsPreview(true);
          setResult("This section requires the full AI generation unlock.");
          return;
        }
        throw new Error(data.error ?? "Generation failed");
      }

      setResult(data.content as string);
      setIsPreview(!!data.preview);

      if (data.preview) {
        toast.info("Free preview — 1 bullet shown. Unlock for full generation.");
      } else {
        toast.success("Content generated!");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "AI unavailable. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlockPurchase() {
    if (!user) return;
    setPaying(true);
    try {
      const token = await getIdToken();
      if (!token) { toast.error("Session expired."); return; }
      // Pass current URL so Dodo redirects back here after payment
      const url = await startCheckout(token, window.location.href);
      window.location.href = url;
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setPaying(false);
    }
  }

  function handleInsert() {
    if (result) {
      onInsert(result);
      onClose();
    }
  }

  return (
    <>
      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; z-index: var(--z-modal);
          background: rgba(8, 13, 20, 0.75);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: fade-in 0.15s var(--ease) both;
        }

        .modal {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          width: 100%; max-width: 540px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: var(--shadow-lg);
          animation: fade-up 0.2s var(--ease) both;
        }

        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; background: var(--bg-surface); z-index: 1;
        }
        .modal-title {
          display: flex; align-items: center; gap: var(--space-3);
          font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);
        }
        .modal-title-icon {
          width: 32px; height: 32px;
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem;
        }
        .modal-close {
          background: none; border: none; cursor: pointer;
          color: var(--text-secondary); padding: var(--space-1);
          border-radius: var(--radius-sm);
          transition: color var(--duration-fast), background var(--duration-fast);
          display: flex; align-items: center;
        }
        .modal-close:hover { color: var(--text-primary); background: var(--bg-elevated); }

        .modal-body { padding: var(--space-5) var(--space-6); }
        .modal-field { margin-bottom: var(--space-4); }

        /* Info notice (free preview / token consume warning) */
        .free-notice {
          display: flex; align-items: flex-start; gap: var(--space-2);
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);
          font-size: var(--text-xs); color: var(--gold-light);
          margin-bottom: var(--space-5); line-height: 1.5;
        }

        /* Result area */
        .result-wrap {
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: var(--space-4);
          margin-top: var(--space-5);
        }
        .result-label {
          font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: var(--space-3);
          display: flex; align-items: center; justify-content: space-between;
        }
        .result-text {
          font-size: var(--text-sm); color: var(--text-primary);
          line-height: 1.7; white-space: pre-wrap;
        }
        .preview-blur {
          filter: blur(3.5px); user-select: none; pointer-events: none; opacity: 0.5;
        }

        /* ── Inline paywall banner ── */
        .paywall-banner {
          margin-top: var(--space-5);
          background: linear-gradient(135deg, var(--bg-elevated), rgba(201,168,76,.07));
          border: 1px solid var(--gold-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: var(--space-3);
        }
        .paywall-icon {
          width: 40px; height: 40px;
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem;
        }
        .paywall-title {
          font-size: var(--text-base); font-weight: 700;
          color: var(--text-primary);
        }
        .paywall-body {
          font-size: var(--text-sm); color: var(--text-secondary);
          line-height: 1.6; max-width: 340px;
        }
        .paywall-price {
          font-size: var(--text-xs); color: var(--text-disabled);
          margin-top: var(--space-1);
        }

        .modal-footer {
          display: flex; gap: var(--space-3); justify-content: flex-end;
          padding: var(--space-4) var(--space-6);
          border-top: 1px solid var(--border);
          position: sticky; bottom: 0; background: var(--bg-surface);
        }
      `}</style>

      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog" aria-modal="true">

          {/* Header */}
          <div className="modal-header">
            <div className="modal-title">
              <div className="modal-title-icon">✦</div>
              AI Generate — {TYPE_LABELS[type]}
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="modal-body">
            {/* Notice banners */}
            {!isDocumentUnlocked && !hasUnlocks && !result && (
              <div className="free-notice">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M7 6.5v3M7 4.5h.01" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                Free preview — you&apos;ll get 1 bullet. Unlock for full generation across all sections.
              </div>
            )}
            {!isDocumentUnlocked && hasUnlocks && (
              <div className="free-notice" style={{ background: "var(--info-dim)", borderColor: "var(--info)", color: "var(--info)" }}>
                Generating will consume 1 unlock token to permanently unlock this resume.
              </div>
            )}

            {/* Context fields */}
            {fields.map((f) => (
              <div key={f.key} className="modal-field">
                <label className="label">{f.label}</label>
                {f.rows ? (
                  <textarea
                    className="input"
                    rows={f.rows}
                    value={context[f.key] ?? ""}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    disabled={loading}
                  />
                ) : (
                  <input
                    type="text"
                    className="input"
                    value={context[f.key] ?? ""}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    disabled={loading}
                  />
                )}
              </div>
            ))}

            {/* Result — shown when not a paywall block */}
            {result && !isPreview && (
              <div className="result-wrap">
                <div className="result-label">Generated Content</div>
                <div className="result-text">{result}</div>
              </div>
            )}

            {/* Blurred preview + inline paywall banner */}
            {result && isPreview && (
              <>
                <div className="result-wrap">
                  <div className="result-label">
                    Preview
                    <span style={{ color: "var(--gold)", fontSize: "var(--text-xs)" }}>
                      1 bullet only
                    </span>
                  </div>
                  <div className="result-text preview-blur">{result}</div>
                </div>

                <div className="paywall-banner">
                  <div className="paywall-icon">✦</div>
                  <div className="paywall-title">Unlock full AI generation</div>
                  <p className="paywall-body">
                    Get complete bullet points for every section — summary, experience, education, and projects.
                    One-time unlock, no subscription.
                  </p>
                  <button
                    className={`btn btn-primary${paying ? " btn-loading" : ""}`}
                    style={{ minWidth: 200 }}
                    onClick={handleUnlockPurchase}
                    disabled={paying}
                  >
                    {paying ? "" : "Unlock — $2 →"}
                  </button>
                  <p className="paywall-price">One-time · No subscription · Instant access</p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            {!result && (
              <button
                className={`btn btn-primary btn-sm${loading ? " btn-loading" : ""}`}
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? "" : (!isDocumentUnlocked && hasUnlocks ? "✦ Unlock & Generate" : "✦ Generate")}
              </button>
            )}
            {result && !isPreview && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setResult("")}>
                  Regenerate
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleInsert}>
                  Insert into Resume →
                </button>
              </>
            )}
            {result && isPreview && (
              <button className="btn btn-secondary btn-sm" onClick={() => setResult("")}>
                Try Again
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}