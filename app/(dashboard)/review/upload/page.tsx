"use client";
// app/(dashboard)/review/upload/page.tsx
// Updated: Two-phase review animation
//  Phase 1 — Visual analysis: PDF rendered to canvas → image sent to AI
//             to check layout, formatting, and visual standards
//  Phase 2 — Text analysis: extract and review text content
// The image phase runs client-side (canvas render) before the API call.

import {
  useState, useRef, useCallback, useEffect,
  Fragment, Suspense, ReactElement,
  ChangeEvent, DragEvent, MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────
// Steps:
//  0 = idle (file picker shown)
//  1 = extracting text
//  2 = rendering PDF to image (visual phase)
//  3 = uploading file to storage
//  4 = running AI review (text + visual combined)
//  5 = done, navigating
type StepType = 0 | 1 | 2 | 3 | 4 | 5;

// ─── PDF text extraction ──────────────────────────────────────
async function extractPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdfjsLib   = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const pdf  = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let   text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page    = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => {
            if ("str" in item && typeof item.str === "string") return item.str;
            return "";
          }).join(" ") + "\n";
        }
        resolve(text.trim());
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── PDF → base64 image (first page) ─────────────────────────
// Renders page 1 of the PDF to a canvas, then exports as JPEG.
async function renderPDFPageToBase64(file: File): Promise<string | null> {
  try {
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdfjsLib   = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();
          const pdf      = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const page     = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1.5 }); // 1.5x for clarity

          const canvas  = document.createElement("canvas");
          canvas.width  = viewport.width;
          canvas.height = viewport.height;
          const ctx     = canvas.getContext("2d")!;

          await page.render({ canvas, canvasContext: ctx, viewport }).promise;

          // Export as JPEG at 80% quality — keeps payload small
          const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
          resolve(base64);
        } catch {
          resolve(null); // Non-fatal — visual phase is a bonus
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    });
  } catch {
    return null;
  }
}

// ─── DOCX text extraction ─────────────────────────────────────
async function extractDOCX(file: File): Promise<string> {
  const mammoth     = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result      = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

// ─── File validation ──────────────────────────────────────────
function validateFile(file: File): string | null {
  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type)) return "Only PDF and DOCX files are supported.";
  if (file.size > 5 * 1024 * 1024) return "File must be under 5 MB.";
  return null;
}

// ─── Animated scan line component ────────────────────────────
function ScanAnimation({ active, phase }: { active: boolean; phase: "visual" | "text" }) {
  return (
    <div className={`scan-wrap${active ? " scanning" : ""} phase-${phase}`}>
      <div className="scan-doc">
        {/* Simulated document lines */}
        <div className="scan-header" />
        {[90, 75, 85, 60, 80, 70, 55, 65, 78].map((w, i) => (
          <div key={i} className="scan-line" style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }} />
        ))}
        <div className="scan-divider" />
        {[70, 82, 68, 75, 58].map((w, i) => (
          <div key={i} className="scan-line" style={{ width: `${w}%`, animationDelay: `${(i + 9) * 0.08}s` }} />
        ))}
        {/* Scan beam */}
        {active && <div className={`scan-beam ${phase}`} />}
        {/* Highlight overlay for visual phase */}
        {active && phase === "visual" && (
          <>
            <div className="scan-highlight hl-1" />
            <div className="scan-highlight hl-2" />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Visual analysis indicators ───────────────────────────────
const VISUAL_CHECKS = [
  "Checking layout structure…",
  "Analysing section spacing…",
  "Detecting visual formatting…",
  "Verifying standard headers…",
  "Checking column layout…",
  "Analysing font consistency…",
];

const TEXT_CHECKS = [
  "Extracting work experience…",
  "Analysing keyword density…",
  "Checking quantified impact…",
  "Reviewing action verbs…",
  "Scoring ATS compatibility…",
  "Calculating overall score…",
];

function AnimatedChecklist({ items, active }: { items: string[]; active: boolean }) {
  const [visible, setVisible] = useState(0);

// Reset when active changes
useEffect(() => {
  if (!active) return;

  let v = 0;
  setVisible(v);

  const interval = setInterval(() => {
    v++;
    if (v >= items.length) {
      clearInterval(interval);
    } else {
      setVisible(v);
    }
  }, 900);

  return () => clearInterval(interval);
}, [active, items.length]);

// Handle interval separately
useEffect(() => {
  if (!active) return;

  const interval = setInterval(() => {
    setVisible(v => {
      if (v >= items.length - 1) return v;
      return v + 1;
    });
  }, 900);

  return () => clearInterval(interval);
}, [active, items.length]);
  return (
    <div className="checklist">
      {items.slice(0, visible + 1).map((item, i) => (
        <div key={i} className={`check-item-anim${i < visible ? " done" : " active"}`}>
          {i < visible ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="check-icon done">
              <circle cx="7" cy="7" r="6" fill="var(--success-dim)" stroke="var(--success)" strokeWidth="1"/>
              <path d="M4 7l2 2 4-4" stroke="var(--success)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <span className="check-spinner" />
          )}
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────
function ReviewUploadForm(): ReactElement {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, getIdToken } = useAuth();

  const resumeId = searchParams.get("resumeId");

  const [dragOver, setDragOver] = useState(false);
  const [file,     setFile]     = useState<File | null>(null);
  const [step,     setStep]     = useState<StepType>(0);
  const [error,    setError]    = useState("");
  const [phase,    setPhase]    = useState<"visual" | "text">("visual");

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((selected: File) => {
    const err = validateFile(selected);
    if (err) { setError(err); return; }
    setError("");
    setFile(selected);
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleReview = useCallback(async () => {
    if (!file || !user) return;
    setError("");

    try {
      // ── Step 1: Extract text ─────────────────────────────
      setStep(1); setPhase("text");
      let resumeText = "";
      if (file.type === "application/pdf") {
        resumeText = await extractPDF(file);
      } else {
        resumeText = await extractDOCX(file);
      }
      if (!resumeText || resumeText.length < 50) {
        throw new Error("Could not extract enough text. Make sure it is not a scanned image PDF.");
      }
      if (resumeText.length > 15000) resumeText = resumeText.slice(0, 15000);

      // ── Step 2: Render PDF to image (visual analysis) ────
      setStep(2); setPhase("visual");
      let imageBase64: string | null = null;
      if (file.type === "application/pdf") {
        imageBase64 = await renderPDFPageToBase64(file);
      }
      // Small delay so user can see the visual phase animation
      await new Promise(r => setTimeout(r, 1200));

      // ── Step 3: Upload file to Firebase Storage ──────────
      setStep(3); setPhase("text");
      const token = await getIdToken();
      if (!token) throw new Error("Session expired. Please sign in again.");

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json();
        throw new Error(uploadData.error ?? "Failed to upload file.");
      }
      const { uploadedResumeId } = await uploadRes.json();

      // ── Step 4: Run AI review ────────────────────────────
      setStep(4); setPhase("text");

      const headers: Record<string, string> = {
        "Content-Type":          "application/json",
        Authorization:           `Bearer ${token}`,
        "x-uploaded-resume-id":  uploadedResumeId,
      };
      if (resumeId) headers["x-resume-id"] = resumeId;

      const res  = await fetch("/api/ai/review-resume", {
        method: "POST",
        headers,
        body: JSON.stringify({
          resumeText,
          // Pass the visual image so the server can do image-aware scoring
          imageBase64: imageBase64 ?? null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) throw new Error("Too many review requests. Please wait a few minutes.");
        if (res.status === 503) throw new Error("AI service is temporarily unavailable. Try again in a moment.");
        throw new Error(data.error ?? "Review failed.");
      }

      // ── Step 5: Navigate ─────────────────────────────────
      setStep(5);
      const reviewId = crypto.randomUUID();
      sessionStorage.setItem(`review:${reviewId}`, JSON.stringify({
        ...data,
        fileName:         file.name,
        reviewedAt:       new Date().toISOString(),
        resumeId:         resumeId ?? null,
        uploadedResumeId,
        // Store extracted text so "Fix in Builder" can use it
        resumeText:       resumeText.slice(0, 8000),
      }));

      await new Promise(r => setTimeout(r, 500));
      router.push(`/review/${reviewId}`);

    } catch (err: unknown) {
      setStep(0); setPhase("visual");
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  }, [file, user, getIdToken, resumeId, router]);

  const isProcessing = step > 0 && step < 5;

  // Step label + sub-label
  const stepLabel = () => {
    if (step === 1) return "Reading your resume file…";
    if (step === 2) return "Analysing visual layout…";
    if (step === 3) return "Saving to cloud…";
    if (step === 4) return "AI is reviewing your resume…";
    return "";
  };
  const stepSub = () => {
    if (step === 1) return "Extracting text from your PDF or DOCX";
    if (step === 2) return "Checking layout, formatting, and visual standards";
    if (step === 3) return "Uploading securely to Firebase Storage";
    if (step === 4) return "Scoring ATS compatibility, keywords, impact, and 5 more categories";
    return "";
  };

  // Phase label for the badge
  const phaseBadge = () => {
    if (step === 2) return { label: "Phase 1 — Visual", desc: "Checking layout and formatting against industry standards" };
    if (step === 4) return { label: "Phase 2 — Text",   desc: "Deep analysis of content, keywords, and impact statements" };
    return null;
  };

  const badge = phaseBadge();

  return (
    <>
      <style>{`
        .review-page { min-height: 100vh; display: flex; flex-direction: column; }

        .topbar { position: sticky; top: 0; z-index: var(--z-sticky); height: var(--nav-height); display: flex; align-items: center; justify-content: space-between; padding: 0 5vw; background: var(--bg-overlay); backdrop-filter: blur(18px); border-bottom: 1px solid var(--border); }
        .topbar-logo { font-family: var(--font-display); font-size: 1.3rem; font-weight: 900; color: var(--text-primary); text-decoration: none; letter-spacing: -0.02em; }
        .topbar-logo span { color: var(--gold); }
        .back-link { color: var(--text-secondary); text-decoration: none; display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); transition: color var(--duration-base); }
        .back-link:hover { color: var(--text-primary); }

        .review-content { flex: 1; display: flex; align-items: center; justify-content: center; padding: var(--space-10) var(--space-6); }
        .review-card { width: 100%; max-width: 560px; animation: fade-up 0.4s var(--ease) both; }

        .review-heading { font-family: var(--font-display); font-size: var(--text-4xl); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-2); letter-spacing: -0.02em; }
        .review-sub { font-size: var(--text-md); color: var(--text-secondary); margin-bottom: var(--space-8); font-weight: 300; line-height: 1.7; }

        /* ── Processing state ── */
        .processing-wrap { display: flex; flex-direction: column; gap: var(--space-6); }

        /* Phase badge */
        .phase-badge {
          display: inline-flex; align-items: center; gap: var(--space-2);
          padding: 5px 12px; border-radius: var(--radius-full);
          font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.04em;
          border: 1px solid; animation: fade-down 0.3s var(--ease) both;
        }
        .phase-badge.visual { background: rgba(201,168,76,.1); border-color: var(--gold-border); color: var(--gold-light); }
        .phase-badge.text   { background: rgba(96,165,250,.1);  border-color: rgba(96,165,250,.3); color: #93c5fd; }
        .phase-badge-dot { width: 6px; height: 6px; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .phase-badge.visual .phase-badge-dot { background: var(--gold); }
        .phase-badge.text   .phase-badge-dot { background: #60a5fa; }
        .phase-badge-desc { font-weight: 400; opacity: 0.8; margin-top: 3px; font-size: var(--text-xs); color: var(--text-secondary); }

        /* Main label */
        .processing-label { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); }
        .processing-sub   { font-size: var(--text-sm); color: var(--text-secondary); margin-top: var(--space-1); }

        /* Split layout: doc preview on left, checklist on right */
        .processing-body {
          display: grid; grid-template-columns: 160px 1fr;
          gap: var(--space-5); align-items: start;
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-5);
        }

        /* ── Scan animation ── */
        .scan-wrap { position: relative; }
        .scan-doc {
          background: #fff; border-radius: 6px;
          padding: 12px 10px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          display: flex; flex-direction: column; gap: 4px;
          position: relative; overflow: hidden;
          min-height: 200px;
        }
        .scan-header { height: 9px; background: #1a1a2e; border-radius: 3px; width: 55%; margin-bottom: 4px; }
        .scan-line   { height: 4px; background: #ebebeb; border-radius: 3px; }
        .scan-divider { height: 1px; background: #e0e0e0; margin: 5px 0; }

        /* Scan beam */
        .scan-beam {
          position: absolute; left: 0; right: 0; height: 3px;
          animation: scan-down 2s ease-in-out infinite;
        }
        .scan-beam.visual {
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
          box-shadow: 0 0 8px rgba(201,168,76,.6);
        }
        .scan-beam.text {
          background: linear-gradient(90deg, transparent, #60a5fa, transparent);
          box-shadow: 0 0 8px rgba(96,165,250,.6);
        }
        @keyframes scan-down {
          0%   { top: 0;    opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        /* Visual highlights */
        .scan-highlight {
          position: absolute; border-radius: 2px;
          animation: hl-blink 1.8s ease-in-out infinite;
        }
        .hl-1 { top: 10px; left: 8px; right: 8px; height: 9px; background: rgba(201,168,76,.15); border: 1px solid rgba(201,168,76,.4); animation-delay: 0s; }
        .hl-2 { top: 30px; left: 8px; width: 60%; height: 4px; background: rgba(201,168,76,.1); border: 1px solid rgba(201,168,76,.3); animation-delay: 0.6s; }
        @keyframes hl-blink {
          0%, 100% { opacity: 0; }
          50%       { opacity: 1; }
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

        /* Checklist */
        .checklist { display: flex; flex-direction: column; gap: var(--space-3); }
        .check-item-anim {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-sm); color: var(--text-secondary);
          animation: fade-up 0.25s var(--ease) both;
        }
        .check-item-anim.active { color: var(--text-primary); }
        .check-spinner {
          width: 14px; height: 14px; flex-shrink: 0;
          border: 2px solid var(--bg-elevated);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        .check-icon { flex-shrink: 0; }

        /* Progress bar */
        .progress-wrap { height: 3px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; }
        .progress-bar  { height: 100%; border-radius: 99px; transition: width 0.8s var(--ease), background 0.4s var(--ease); }
        .progress-bar.visual { background: var(--gold); }
        .progress-bar.text   { background: #60a5fa; }

        /* ── Drop zone ── */
        .drop-zone { border: 2px dashed var(--border); border-radius: var(--radius-lg); padding: var(--space-12) var(--space-8); text-align: center; cursor: pointer; transition: all 0.2s var(--ease); background: var(--bg-surface); position: relative; }
        .drop-zone:hover, .drop-zone.over { border-color: var(--gold-border); background: var(--gold-dim); }
        .drop-zone.has-file { border-color: var(--gold-border); border-style: solid; }
        .drop-icon  { width: 52px; height: 52px; margin: 0 auto var(--space-4); background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; }
        .drop-title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2); }
        .drop-sub   { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4); }
        .drop-types { display: flex; align-items: center; justify-content: center; gap: var(--space-2); }

        .file-selected { display: flex; align-items: center; gap: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); margin-top: var(--space-4); }
        .file-icon { width: 36px; height: 36px; background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .file-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
        .file-size { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; }
        .file-remove { margin-left: auto; background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: var(--space-1); display: flex; transition: color var(--duration-fast); }
        .file-remove:hover { color: var(--error); }

        .review-error { background: var(--error-dim); border: 1px solid rgba(248,113,113,0.2); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); color: var(--error); margin-top: var(--space-4); display: flex; align-items: flex-start; gap: var(--space-2); }

        .checks-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-8); }
        .check-item  { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-secondary); }
        .check-item::before { content: '✦'; color: var(--gold); font-size: 0.65rem; flex-shrink: 0; }

        .free-note { display: flex; align-items: flex-start; gap: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); margin-top: var(--space-6); font-size: var(--text-sm); }
        .free-note-icon { flex-shrink: 0; color: var(--gold); margin-top: 1px; }
        .free-note-text { color: var(--text-secondary); line-height: 1.6; }
        .free-note-text strong { color: var(--text-primary); font-weight: 600; }

        @media (max-width: 480px) {
          .processing-body { grid-template-columns: 1fr; }
          .scan-wrap { display: none; }
        }
      `}</style>

      <div className="bg-mesh" />
      <div className="bg-grain" />

      <div className="review-page">
        <header className="topbar">
          <Link href="/" className="topbar-logo">Resu<span>fii</span></Link>
          <Link href="/dashboard" className="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </Link>
        </header>

        <main className="review-content">
          <div className="review-card">
            <h1 className="review-heading">Review your resume.</h1>
            <p className="review-sub">
              Upload your resume and get an ATS score with detailed feedback
              across 8 key categories — in under 30 seconds.
            </p>

            {isProcessing ? (
              <div className="processing-wrap">
                {/* Phase badge */}
                {badge && (
                  <div>
                    <div className={`phase-badge ${phase}`}>
                      <span className="phase-badge-dot" />
                      {badge.label}
                    </div>
                    <div className="phase-badge-desc">{badge.desc}</div>
                  </div>
                )}

                {/* Main label */}
                <div>
                  <div className="processing-label">{stepLabel()}</div>
                  <div className="processing-sub">{stepSub()}</div>
                </div>

                {/* Progress bar */}
                <div className="progress-wrap">
                  <div
                    className={`progress-bar ${phase}`}
                    style={{
                      width: step === 1 ? "15%" :
                             step === 2 ? "35%" :
                             step === 3 ? "55%" :
                             step === 4 ? "80%" : "100%",
                    }}
                  />
                </div>

                {/* Animated body: doc preview + checklist */}
                <div className="processing-body">
                  <ScanAnimation active={true} phase={phase} />
                  <AnimatedChecklist
                    items={phase === "visual" ? VISUAL_CHECKS : TEXT_CHECKS}
                    active={isProcessing}
                  />
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`drop-zone${dragOver ? " over" : ""}${file ? " has-file" : ""}`}
                  onDragOver={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); }}
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
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)" }}>• Max 5 MB</span>
                      </div>
                    </>
                  ) : (
                    <div className="drop-title" style={{ color: "var(--gold-light)" }}>✓ File ready to review</div>
                  )}
                </div>

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
                      onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); setFile(null); setError(""); }}
                      title="Remove file"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                )}

                {error && (
                  <div className="review-error">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M7.5 1a6.5 6.5 0 100 13A6.5 6.5 0 007.5 1zM7 4.5a.5.5 0 011 0v4a.5.5 0 01-1 0v-4zm.5 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z" fill="currentColor"/>
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: "var(--space-5)", justifyContent: "center" }}
                  onClick={handleReview}
                  disabled={!file}
                >
                  {file ? "Analyse My Resume →" : "Upload a file to continue"}
                </button>

                <div className="checks-grid">
                  {["ATS Compatibility","Keyword Density","Quantified Impact","Summary Quality","Action Verbs","Skills Match","Length & Depth","Formatting"].map((c) => (
                    <div key={c} className="check-item">{c}</div>
                  ))}
                </div>

                {!user?.isPremium && (
                  <div className="free-note">
                    <svg className="free-note-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <p className="free-note-text">
                      <strong>Free plan:</strong> you&apos;ll see your overall ATS score and 2 section previews.{" "}
                      <Link href="/dashboard" style={{ color: "var(--gold)", fontWeight: 500 }}>Purchase a lifetime unlock</Link>
                      {" "}to unlock all 8 categories and every actionable fix for this document.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

function ReviewUploadFallback(): ReactElement {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--bg-elevated)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function ReviewUploadPage(): ReactElement {
  return (
    <Suspense fallback={<ReviewUploadFallback />}>
      <ReviewUploadForm />
    </Suspense>
  );
}