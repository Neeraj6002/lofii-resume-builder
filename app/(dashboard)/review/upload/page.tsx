"use client";
// app/(dashboard)/review/upload/page.tsx
// ============================================================
// REVIEW UPLOAD PAGE
// - Drag & drop or click to upload PDF or DOCX
// - Extracts text client-side (pdfjs-dist / mammoth)
// - Sends extracted text to /api/ai/review-resume
// - Redirects to /review/[id] with results in sessionStorage
// ============================================================

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── PDF text extraction via pdfjs-dist ──────────────────────
async function extractPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);

        // Dynamically import pdfjs
        const pdfjsLib = await import("pdfjs-dist");

        // Use local worker file from node_modules to avoid CDN/CORS issues
        // This creates a URL that points to the worker file in the installed package
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let text = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page    = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: Record<string, unknown>) =>
            typeof item["str"] === "string" ? item["str"] : ""
          );
          text += strings.join(" ") + "\n";
        }

        resolve(text.trim());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── DOCX text extraction via mammoth ────────────────────────
async function extractDOCX(file: File): Promise<string> {
  const mammoth     = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result      = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

// ─── File validation ──────────────────────────────────────────
function validateFile(file: File): string | null {
  const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowed.includes(file.type)) {
    return "Only PDF and DOCX files are supported.";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "File must be under 5MB.";
  }
  return null;
}

// ─── Step indicator ───────────────────────────────────────────
function StepDot({ n, label, active, done }: {
  n: number; label: string; active: boolean; done: boolean;
}) {
  return (
    <div className="step-dot-wrap">
      <div className={`step-dot${active ? " active" : ""}${done ? " done" : ""}`}>
        {done ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : n}
      </div>
      <span className={`step-label${active ? " active" : ""}`}>{label}</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────
export default function ReviewUploadPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, getIdToken }     = useAuth();

  const resumeId = searchParams.get("resumeId"); // optional — from dashboard

  const [dragOver,   setDragOver]   = useState(false);
  const [file,       setFile]       = useState<File | null>(null);
  const [step,       setStep]       = useState<0 | 1 | 2 | 3>(0);
  // 0 = waiting, 1 = extracting, 2 = reviewing, 3 = done
  const [error,      setError]      = useState("");
  const [progress,   setProgress]   = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Handle file selection ──────────────────────────────────
  const handleFile = useCallback((selected: File) => {
    const err = validateFile(selected);
    if (err) { setError(err); return; }
    setError("");
    setFile(selected);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Animate progress bar ──────────────────────────────────
  useEffect(() => {
    if (step === 0) { setProgress(0); return; }
    if (step === 1) { setProgress(30); return; }
    if (step === 2) { setProgress(65); return; }
    if (step === 3) { setProgress(100); return; }
  }, [step]);

  // ── Run review ─────────────────────────────────────────────
  async function handleReview() {
    if (!file || !user) return;
    setError("");

    try {
      // Step 1 — extract text
      setStep(1);
      let resumeText = "";

      if (file.type === "application/pdf") {
        resumeText = await extractPDF(file);
      } else {
        resumeText = await extractDOCX(file);
      }

      if (!resumeText || resumeText.length < 50) {
        throw new Error("Could not extract enough text from the file. Make sure it is not a scanned image PDF.");
      }

      if (resumeText.length > 15000) {
        resumeText = resumeText.slice(0, 15000);
      }

      // Step 2 — AI review
      setStep(2);

      const token = await getIdToken();
      if (!token) {
        throw new Error("Session expired. Please sign in again.");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // Pass resumeId header if we came from the dashboard
      if (resumeId) {
        headers["x-resume-id"] = resumeId;
      }

      const res = await fetch("/api/ai/review-resume", {
        method: "POST",
        headers,
        body: JSON.stringify({ resumeText }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) throw new Error("Too many review requests. Please wait a few minutes.");
        if (res.status === 503) throw new Error("AI service is temporarily unavailable. Try again in a moment.");
        throw new Error(data.error ?? "Review failed.");
      }

      // Step 3 — store results and redirect
      setStep(3);

      // Store in sessionStorage — review results page reads this
      // We use sessionStorage (not URL params) to avoid exposing the data in the URL
      const reviewId = crypto.randomUUID();
      sessionStorage.setItem(`review:${reviewId}`, JSON.stringify({
        ...data,
        fileName: file.name,
        reviewedAt: new Date().toISOString(),
        resumeId: resumeId ?? null,
      }));

      // Small delay so user sees the 100% state
      await new Promise(r => setTimeout(r, 600));

      router.push(`/review/${reviewId}`);
    } catch (err: unknown) {
      setStep(0);
      setProgress(0);
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  }

  const isProcessing = step > 0 && step < 3;

  const stepLabels = [
    { n: 1, label: "Upload"   },
    { n: 2, label: "Extract"  },
    { n: 3, label: "Analyse"  },
    { n: 4, label: "Results"  },
  ];

  return (
    <>
      <style>{`
        .review-page {
          min-height: 100vh;
          display: flex; flex-direction: column;
        }

        /* ── Topbar ── */
        .topbar {
          position: sticky; top: 0; z-index: var(--z-sticky);
          height: var(--nav-height);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 5vw;
          background: var(--bg-overlay); backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
        }
        .topbar-logo { font-family: var(--font-display); font-size: 1.3rem; font-weight: 900; color: var(--text-primary); text-decoration: none; letter-spacing: -0.02em; }
        .topbar-logo span { color: var(--gold); }
        .back-link { color: var(--text-secondary); text-decoration: none; display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); transition: color var(--duration-base); }
        .back-link:hover { color: var(--text-primary); }

        /* ── Content ── */
        .review-content {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: var(--space-10) var(--space-6);
        }
        .review-card {
          width: 100%; max-width: 560px;
          animation: fade-up 0.4s var(--ease) both;
        }

        /* ── Heading ── */
        .review-heading {
          font-family: var(--font-display);
          font-size: var(--text-4xl); font-weight: 700;
          color: var(--text-primary); margin-bottom: var(--space-2);
          letter-spacing: -0.02em;
        }
        .review-sub {
          font-size: var(--text-md); color: var(--text-secondary);
          margin-bottom: var(--space-8); font-weight: 300; line-height: 1.7;
        }

        /* ── Steps ── */
        .steps-row {
          display: flex; align-items: center; gap: 0;
          margin-bottom: var(--space-8);
        }
        .step-dot-wrap {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-1);
        }
        .step-dot {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--bg-elevated); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xs); font-weight: 700; color: var(--text-disabled);
          transition: all 0.3s var(--ease);
        }
        .step-dot.active { background: var(--gold-dim); border-color: var(--gold-border); color: var(--gold-light); }
        .step-dot.done   { background: var(--success-dim); border-color: rgba(74,222,128,0.3); color: var(--success); }
        .step-label { font-size: var(--text-xs); color: var(--text-disabled); white-space: nowrap; }
        .step-label.active { color: var(--text-secondary); }
        .step-connector {
          flex: 1; height: 1px; background: var(--border);
          margin: 0 var(--space-2); margin-bottom: var(--space-5);
        }

        /* Progress bar */
        .progress-wrap {
          height: 3px; background: var(--bg-elevated);
          border-radius: 99px; margin-bottom: var(--space-8);
          overflow: hidden;
        }
        .progress-bar {
          height: 100%; background: var(--gold);
          border-radius: 99px;
          transition: width 0.6s var(--ease);
        }

        /* ── Drop zone ── */
        .drop-zone {
          border: 2px dashed var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-12) var(--space-8);
          text-align: center; cursor: pointer;
          transition: all 0.2s var(--ease);
          background: var(--bg-surface);
          position: relative;
        }
        .drop-zone:hover,
        .drop-zone.over { border-color: var(--gold-border); background: var(--gold-dim); }
        .drop-zone.has-file { border-color: var(--gold-border); border-style: solid; }
        .drop-zone.processing { cursor: not-allowed; opacity: 0.7; pointer-events: none; }

        .drop-icon {
          width: 52px; height: 52px; margin: 0 auto var(--space-4);
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
        }
        .drop-title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2); }
        .drop-sub   { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4); }
        .drop-types { display: flex; align-items: center; justify-content: center; gap: var(--space-2); }

        /* File selected state */
        .file-selected {
          display: flex; align-items: center; gap: var(--space-3);
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: var(--space-4);
          margin-top: var(--space-4);
        }
        .file-icon {
          width: 36px; height: 36px; background: var(--gold-dim);
          border: 1px solid var(--gold-border); border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .file-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
        .file-size { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; }
        .file-remove {
          margin-left: auto; background: none; border: none;
          color: var(--text-secondary); cursor: pointer; padding: var(--space-1);
          display: flex; transition: color var(--duration-fast);
        }
        .file-remove:hover { color: var(--error); }

        /* ── Processing state ── */
        .processing-state {
          text-align: center; padding: var(--space-6) 0;
        }
        .processing-spinner {
          width: 40px; height: 40px;
          border: 3px solid var(--bg-elevated);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto var(--space-4);
        }
        .processing-label { font-size: var(--text-md); font-weight: 500; color: var(--text-primary); margin-bottom: var(--space-2); }
        .processing-sub   { font-size: var(--text-sm); color: var(--text-secondary); }

        /* ── Error ── */
        .review-error {
          background: var(--error-dim); border: 1px solid rgba(248,113,113,0.2);
          border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm); color: var(--error);
          margin-top: var(--space-4);
          display: flex; align-items: flex-start; gap: var(--space-2);
        }

        /* ── What we check ── */
        .checks-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--space-3); margin-top: var(--space-8);
        }
        .check-item {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-sm); color: var(--text-secondary);
        }
        .check-item::before { content: '✦'; color: var(--gold); font-size: 0.65rem; flex-shrink: 0; }

        /* ── Free tier note ── */
        .free-note {
          display: flex; align-items: flex-start; gap: var(--space-3);
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: var(--space-4);
          margin-top: var(--space-6); font-size: var(--text-sm);
        }
        .free-note-icon { flex-shrink: 0; color: var(--gold); margin-top: 1px; }
        .free-note-text { color: var(--text-secondary); line-height: 1.6; }
        .free-note-text strong { color: var(--text-primary); font-weight: 600; }
      `}</style>

      <div className="bg-mesh" />
      <div className="bg-grain" />

      <div className="review-page">

        {/* ── Topbar ─────────────────────────────────────── */}
        <header className="topbar">
          <Link href="/" className="topbar-logo">Resu<span>MAI</span></Link>
          <Link href="/dashboard" className="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </Link>
        </header>

        {/* ── Main ───────────────────────────────────────── */}
        <main className="review-content">
          <div className="review-card">

            <h1 className="review-heading">Review your resume.</h1>
            <p className="review-sub">
              Upload your resume and get an ATS score with detailed feedback
              across 8 key categories — in under 30 seconds.
            </p>

            {/* Steps */}
            <div className="steps-row">
              {stepLabels.map((s, i) => (
                <Fragment key={s.n}>
                  <StepDot
                    n={s.n}
                    label={s.label}
                    active={step === i}
                    done={step > i}
                  />
                  {i < stepLabels.length - 1 && (
                    <div key={`conn-${i}`} className="step-connector" />
                  )}
                </Fragment>
              ))}
            </div>

            {/* Progress bar */}
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>

            {/* Processing state */}
            {isProcessing ? (
              <div className="processing-state">
                <div className="processing-spinner" />
                <div className="processing-label">
                  {step === 1 && "Extracting text from your resume…"}
                  {step === 2 && "Analysing with AI — this takes ~15 seconds…"}
                </div>
                <p className="processing-sub">
                  {step === 1 && "Reading your PDF or DOCX file"}
                  {step === 2 && "Checking ATS compatibility, keywords, impact, and more"}
                </p>
              </div>
            ) : (
              <>
                {/* Drop zone */}
                <div
                  className={`drop-zone${dragOver ? " over" : ""}${file ? " has-file" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => !file && inputRef.current?.click()}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: "none" }}
                    onChange={onInputChange}
                  />

                  {!file ? (
                    <>
                      <div className="drop-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2v13M8 7l4-5 4 5" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M20 17v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="drop-title">Drop your resume here</div>
                      <p className="drop-sub">or click to browse your files</p>
                      <div className="drop-types">
                        <span className="badge badge-muted">PDF</span>
                        <span className="badge badge-muted">DOCX</span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)" }}>• Max 5MB</span>
                      </div>
                    </>
                  ) : (
                    <div className="drop-title" style={{ color: "var(--gold-light)" }}>
                      ✓ File ready to review
                    </div>
                  )}
                </div>

                {/* File selected row */}
                {file && (
                  <div className="file-selected">
                    <div className="file-icon">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M10 2H5a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7l-5-5z" stroke="var(--gold)" strokeWidth="1.4"/>
                        <path d="M10 2v5h5" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{(file.size / 1024).toFixed(0)} KB · {file.type.includes("pdf") ? "PDF" : "DOCX"}</div>
                    </div>
                    <button
                      className="file-remove"
                      onClick={e => { e.stopPropagation(); setFile(null); setError(""); }}
                      title="Remove file"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="review-error">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M7.5 1a6.5 6.5 0 100 13A6.5 6.5 0 007.5 1zM7 4.5a.5.5 0 011 0v4a.5.5 0 01-1 0v-4zm.5 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z" fill="currentColor"/>
                    </svg>
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: "var(--space-5)", justifyContent: "center" }}
                  onClick={handleReview}
                  disabled={!file}
                >
                  {file ? "Analyse My Resume →" : "Upload a file to continue"}
                </button>
              </>
            )}

            {/* What we check */}
            <div className="checks-grid">
              {[
                "ATS Compatibility", "Keyword Density",
                "Quantified Impact", "Summary Quality",
                "Action Verbs", "Skills Match",
                "Length & Depth", "Formatting",
              ].map(c => (
                <div key={c} className="check-item">{c}</div>
              ))}
            </div>

            {/* Free tier note */}
            {!user?.isPremium && (
              <div className="free-note">
                <svg className="free-note-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <p className="free-note-text">
                  <strong>Free plan:</strong> you&apos;ll see your overall ATS score and 2 section previews.{" "}
                  <Link href="/dashboard" style={{ color: "var(--gold)", fontWeight: 500 }}>Upgrade to Premium</Link>
                  {" "}to unlock all 8 categories and every actionable fix.
                </p>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}