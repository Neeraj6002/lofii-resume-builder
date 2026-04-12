"use client";
// app/(dashboard)/resume/new/page.tsx

import { useState, useRef, useCallback, useEffect, ChangeEvent, DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import type {
  PersonalInfo, ExperienceItem, EducationItem,
  SkillItem, ProjectItem, CertificationItem,
} from "@/types";

// ─── File validation ───────────────────────────────────────────────────────
function validateFile(file: File): string | null {
  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type)) return "Only PDF and DOCX files are supported.";
  if (file.size > 5 * 1024 * 1024) return "File must be under 5 MB.";
  return null;
}

// ─── PDF text extraction ───────────────────────────────────────────────────
async function extractPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        const pageTexts: string[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          type PdfItem = { str: string; transform: number[]; height: number };
          const items = content.items as PdfItem[];
          const lineMap = new Map<number, string[]>();
          for (const item of items) {
            if (!item.str?.trim()) continue;
            const y = Math.round(item.transform[5]);
            let bucket = y;
            for (const existingY of lineMap.keys()) {
              if (Math.abs(existingY - y) <= 3) { bucket = existingY; break; }
            }
            if (!lineMap.has(bucket)) lineMap.set(bucket, []);
            lineMap.get(bucket)!.push(item.str);
          }
          const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
          const lines = sortedYs.map(y => lineMap.get(y)!.join(" ").trim()).filter(Boolean);
          pageTexts.push(lines.join("\n"));
        }
        resolve(pageTexts.join("\n\n").trim());
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── DOCX text extraction ──────────────────────────────────────────────────
async function extractDOCX(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

// ─── AI parser ────────────────────────────────────────────────────────────
interface ParsedResumeData {
  title: string;
  personalInfo: PersonalInfo;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
}

async function parseResumeTextWithAI(text: string, idToken: string): Promise<ParsedResumeData> {
  const res = await fetch("/api/ai/parse-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ resumeText: text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to parse resume.");
  }
  return res.json();
}

// ─── Fallback naive parse ──────────────────────────────────────────────────
function naiveParse(text: string): ParsedResumeData {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const name = lines[0] ?? "";
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  const phoneMatch = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  return {
    title: name ? `${name.split(" ")[0]}'s Resume` : "Imported Resume",
    personalInfo: {
      fullName: name, email: emailMatch?.[0] ?? "", phone: phoneMatch?.[0] ?? "",
      location: "", linkedin: "", github: "", website: "", jobTitle: "",
    },
    summary: "",
    experience: [{ id: uuid(), company: "", role: "", location: "", startDate: "", endDate: "", current: false, description: text.slice(0, 1000), aiGenerated: false }],
    education: [{ id: uuid(), institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", current: false, description: "", aiGenerated: false }],
    skills: [{ id: uuid(), name: "", level: "intermediate", category: "" }],
    projects: [{ id: uuid(), name: "", description: "", tech: [], link: "", githubLink: "", aiGenerated: false }],
    certifications: [],
  };
}

// ─── Vague loading messages — zero step hints ─────────────────────────────
const LOADING_MESSAGES = [
  "Reading your resume…",
  "Analysing your experience…",
  "Almost ready…",
  "One moment…",
  "Getting things ready…",
  "Nearly there…",
];

// ─── Component ────────────────────────────────────────────────────────────
export default function NewResumePage() {
  const router = useRouter();
  const { getIdToken } = useAuth();

  const [mode, setMode] = useState<"choose" | "import">("choose");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isProcessing) {
      setMsgIndex(0);
      intervalRef.current = setInterval(() => {
        setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
      }, 2400);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isProcessing]);

  const handleFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError("");
    setFile(f);
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

  async function handleImport() {
    if (!file) return;
    setError("");
    setIsProcessing(true);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await extractPDF(file);
      } else {
        text = await extractDOCX(file);
      }
      if (!text || text.length < 30)
        throw new Error("Could not extract text. Is this a scanned/image PDF?");
      if (text.length > 12000) text = text.slice(0, 12000);

      const token = await getIdToken();
      if (!token) throw new Error("Session expired.");

      let parsed: ParsedResumeData;
      try {
        parsed = await parseResumeTextWithAI(text, token);
      } catch {
        toast.info("AI parsing unavailable — filling basic info only.");
        parsed = naiveParse(text);
      }

      sessionStorage.setItem("import:resume", JSON.stringify(parsed));
      await new Promise(r => setTimeout(r, 400));
      router.push("/resume/create?import=1");
    } catch (err: unknown) {
      setIsProcessing(false);
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  }

  function resetImport() {
    setMode("choose");
    setFile(null);
    setError("");
    setIsProcessing(false);
  }

  return (
    <>
      <style>{`
        /* ── Shell ── */
        .new-page{min-height:100vh;display:flex;flex-direction:column;background:var(--bg-base);}

        /* ── Topbar ── */
        .topbar{position:sticky;top:0;z-index:var(--z-sticky);height:var(--nav-height);display:flex;align-items:center;justify-content:space-between;padding:0 5vw;background:var(--bg-overlay);backdrop-filter:blur(18px);border-bottom:1px solid var(--border);}
        .topbar-logo{font-family:var(--font-display);font-size:1.3rem;font-weight:900;color:var(--text-primary);text-decoration:none;letter-spacing:-0.02em;}
        .topbar-logo span{color:var(--gold);}
        .back-link{color:var(--text-secondary);text-decoration:none;display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm);transition:color var(--duration-base);}
        .back-link:hover{color:var(--text-primary);}

        /* ── Content ── */
        .new-content{flex:1;display:flex;align-items:center;justify-content:center;padding:var(--space-12) var(--space-6);}
        .new-card{width:100%;max-width:580px;animation:fade-up 0.4s var(--ease) both;}
        .new-heading{font-family:var(--font-display);font-size:var(--text-4xl);font-weight:700;color:var(--text-primary);letter-spacing:-0.02em;margin-bottom:var(--space-2);}
        .new-sub{font-size:var(--text-md);color:var(--text-secondary);margin-bottom:var(--space-8);line-height:1.7;font-weight:300;}

        /* ── Choice grid ── */
        .choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);}
        .choice-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:var(--space-6);cursor:pointer;transition:border-color var(--duration-base),transform var(--duration-base),background var(--duration-base);display:flex;flex-direction:column;gap:var(--space-4);text-align:left;}
        .choice-card:hover{border-color:var(--gold-border);background:var(--bg-elevated);transform:translateY(-2px);}
        .choice-card.primary-card{background:linear-gradient(135deg,var(--bg-surface),rgba(201,168,76,.08));border-color:var(--gold-border);}
        .choice-card.primary-card:hover{background:linear-gradient(135deg,var(--bg-elevated),rgba(201,168,76,.12));border-color:var(--gold);}
        .choice-icon{width:48px;height:48px;border-radius:var(--radius-md);background:var(--gold-dim);border:1px solid var(--gold-border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .choice-icon.muted{background:var(--bg-elevated);border-color:var(--border);}
        .choice-title{font-size:var(--text-md);font-weight:700;color:var(--text-primary);margin-bottom:4px;}
        .choice-desc{font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;}
        .choice-cta{display:flex;align-items:center;gap:var(--space-1);font-size:var(--text-xs);font-weight:600;color:var(--gold-light);margin-top:auto;}
        .choice-cta.muted{color:var(--text-secondary);}

        /* ── Import back btn ── */
        .import-back{display:flex;align-items:center;gap:var(--space-2);background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:var(--text-sm);padding:0;margin-bottom:var(--space-6);transition:color var(--duration-base);}
        .import-back:hover{color:var(--text-primary);}

        /* ── Drop zone ── */
        .drop-zone{border:2px dashed var(--border);border-radius:var(--radius-lg);padding:var(--space-10) var(--space-8);text-align:center;cursor:pointer;transition:all 0.2s var(--ease);background:var(--bg-surface);}
        .drop-zone:hover,.drop-zone.over{border-color:var(--gold-border);background:var(--gold-dim);}
        .drop-zone.has-file{border-color:var(--gold-border);border-style:solid;background:rgba(201,168,76,.04);}
        .drop-icon{width:52px;height:52px;margin:0 auto var(--space-4);background:var(--gold-dim);border:1px solid var(--gold-border);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;}
        .drop-title{font-size:var(--text-lg);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-2);}
        .drop-sub{font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-4);}
        .drop-types{display:flex;align-items:center;justify-content:center;gap:var(--space-2);}

        /* ── File row ── */
        .file-selected{display:flex;align-items:center;gap:var(--space-3);background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-4);margin-top:var(--space-4);}
        .file-icon{width:36px;height:36px;flex-shrink:0;background:var(--gold-dim);border:1px solid var(--gold-border);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;}
        .file-name{font-size:var(--text-sm);font-weight:600;color:var(--text-primary);}
        .file-size{font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px;}
        .file-remove{margin-left:auto;background:none;border:none;color:var(--text-secondary);cursor:pointer;padding:var(--space-1);display:flex;transition:color var(--duration-fast);}
        .file-remove:hover{color:var(--error);}

        /* ── Error & note ── */
        .import-error{background:var(--error-dim);border:1px solid rgba(248,113,113,0.2);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);font-size:var(--text-sm);color:var(--error);margin-top:var(--space-4);display:flex;align-items:flex-start;gap:var(--space-2);}
        .import-note{display:flex;align-items:flex-start;gap:var(--space-3);background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-4);margin-top:var(--space-5);font-size:var(--text-sm);}
        .import-note p{color:var(--text-secondary);line-height:1.6;}
        .import-note strong{color:var(--text-primary);}

        /* ════════════════════════════════════════════
           PAPER SCAN LOADING — no step info exposed
        ════════════════════════════════════════════ */
        .loading-overlay{
          display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:36px;
          padding:var(--space-12) 0;
          animation:fade-up 0.35s var(--ease) both;
        }

        /* Scene */
        .resume-scene{position:relative;width:120px;height:165px;}

        /* Paper card */
        .resume-paper{
          width:120px;height:155px;
          background:var(--bg-surface);
          border:1px solid var(--border);
          border-radius:4px 14px 4px 4px;
          position:relative;overflow:hidden;
          animation:paper-float 3.2s ease-in-out infinite;
        }
        @keyframes paper-float{
          0%,100%{transform:translateY(0px) rotate(-1.2deg);}
          50%{transform:translateY(-7px) rotate(0.6deg);}
        }

        /* Dog-ear fold */
        .paper-fold{
          position:absolute;top:0;right:0;width:0;height:0;
          border-style:solid;border-width:0 24px 24px 0;
          border-color:transparent var(--bg-base) transparent transparent;
        }
        .paper-fold-crease{
          position:absolute;top:0;right:0;width:24px;height:24px;
          border-bottom:1px solid var(--border);
          border-left:1px solid var(--border);
          border-radius:0 0 0 3px;
        }

        /* Simulated resume content lines */
        .pl{position:absolute;left:14px;right:14px;height:2px;background:var(--border);border-radius:2px;}
        .pl-head{top:18px;right:38px;background:var(--text-disabled);height:3px;}
        .pl-sub{top:27px;right:54px;height:1.5px;}
        .pl-div{top:36px;left:14px;right:14px;height:1px;background:var(--border);}
        .pl-1{top:46px;} .pl-2{top:54px;right:32px;} .pl-3{top:62px;}
        .pl-4{top:76px;right:26px;} .pl-5{top:84px;} .pl-6{top:92px;right:42px;}
        .pl-7{top:106px;} .pl-8{top:114px;right:38px;} .pl-9{top:122px;}
        .pl-10{top:136px;right:52px;} .pl-11{top:144px;}

        /* Scan beam + glow */
        .scan-beam{
          position:absolute;left:0;right:0;height:2px;
          background:var(--gold);opacity:0;
          animation:scan-travel 2.2s cubic-bezier(0.4,0,0.6,1) infinite;
        }
        .scan-glow{
          position:absolute;left:0;right:0;height:22px;
          background:linear-gradient(to bottom,rgba(201,168,76,0.13),transparent);
          pointer-events:none;opacity:0;
          animation:glow-travel 2.2s cubic-bezier(0.4,0,0.6,1) infinite;
        }
        /* Warm wash that stays behind the beam as it advances */
        .scan-wash{
          position:absolute;left:0;right:0;
          background:rgba(201,168,76,0.035);
          clip-path:inset(0 0 100% 0);
          animation:wash-grow 2.2s cubic-bezier(0.4,0,0.6,1) infinite;
          top:0;bottom:0;
        }
        @keyframes scan-travel{
          0%{top:-2px;opacity:0;} 5%{opacity:0.9;} 92%{opacity:0.9;} 100%{top:157px;opacity:0;}
        }
        @keyframes glow-travel{
          0%{top:-22px;opacity:0;} 5%{opacity:1;} 92%{opacity:1;} 100%{top:135px;opacity:0;}
        }
        @keyframes wash-grow{
          0%{clip-path:inset(0 0 100% 0);}
          100%{clip-path:inset(0 0 0% 0);}
        }

        /* Floating shadow under paper */
        .paper-shadow{
          position:absolute;bottom:-8px;left:12px;right:12px;
          height:8px;border-radius:50%;
          background:var(--border);opacity:0.35;filter:blur(3px);
          animation:shadow-breathe 3.2s ease-in-out infinite;
        }
        @keyframes shadow-breathe{
          0%,100%{opacity:0.2;transform:scaleX(0.88);}
          50%{opacity:0.38;transform:scaleX(1);}
        }

        /* Vague message */
        .loading-msg-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;}
        .loading-msg{
          font-size:var(--text-sm);font-weight:500;color:var(--text-primary);
          animation:msg-in 0.42s var(--ease) both;
        }
        @keyframes msg-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}

        /* Three-dot ticker */
        .loading-dots{display:flex;gap:5px;}
        .loading-dots span{
          width:4px;height:4px;border-radius:50%;
          background:var(--text-disabled);opacity:0.3;
          animation:dtick 1.5s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2){animation-delay:.24s;}
        .loading-dots span:nth-child(3){animation-delay:.48s;}
        @keyframes dtick{0%,80%,100%{opacity:.25;transform:scale(.8);}40%{opacity:1;transform:scale(1);}}

        /* ── Responsive ── */
        @media(max-width:560px){
          .choice-grid{grid-template-columns:1fr;}
          .new-heading{font-size:var(--text-3xl);}
        }
      `}</style>

      <div className="bg-mesh" />
      <div className="bg-grain" />

      <div className="new-page">

        {/* ── Topbar ── */}
        <header className="topbar">
          <Link href="/" className="topbar-logo">Resu<span>fii</span></Link>
          <Link href="/dashboard" className="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </Link>
        </header>

        <main className="new-content">
          <div className="new-card">

            {/* ════ Choose mode ════ */}
            {mode === "choose" && (
              <>
                <h1 className="new-heading">Build your resume.</h1>
                <p className="new-sub">Start from scratch or import an existing file — your data, your way.</p>
                <div className="choice-grid">

                  <Link href="/resume/create" style={{ textDecoration: "none" }}>
                    <div className="choice-card primary-card">
                      <div className="choice-icon">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                          <rect x="3" y="3" width="16" height="16" rx="2.5" stroke="var(--gold)" strokeWidth="1.5"/>
                          <path d="M11 7v8M7 11h8" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div>
                        <div className="choice-title">Build Resume</div>
                        <div className="choice-desc">Start with a blank form. Fill in your details section by section with AI writing assistance.</div>
                      </div>
                      <div className="choice-cta">
                        Start building
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2.5 6.5h8M7.5 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </Link>

                  <div
                    className="choice-card"
                    onClick={() => setMode("import")}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && setMode("import")}
                  >
                    <div className="choice-icon muted">
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M13 3H7a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V9l-4-6z" stroke="var(--text-secondary)" strokeWidth="1.5"/>
                        <path d="M13 3v6h6" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M11 12v5M9 15l2 2 2-2" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <div className="choice-title">Import Resume</div>
                      <div className="choice-desc">Upload a PDF or DOCX. We&apos;ll extract your data and pre-fill the builder so you can edit and improve it.</div>
                    </div>
                    <div className="choice-cta muted">
                      Upload file
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2.5 6.5h8M7.5 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>

                </div>
              </>
            )}

            {/* ════ Import mode ════ */}
            {mode === "import" && (
              <>

                {/* ── LOADING STATE ── paper scan, no step hints ── */}
                {isProcessing ? (
                  <div className="loading-overlay">

                    <div className="resume-scene">
                      <div className="resume-paper">

                        {/* Dog-ear fold */}
                        <div className="paper-fold" />
                        <div className="paper-fold-crease" />

                        {/* Simulated resume lines */}
                        <div className="pl pl-head" />
                        <div className="pl pl-sub" />
                        <div className="pl pl-div" />
                        <div className="pl pl-1" />
                        <div className="pl pl-2" />
                        <div className="pl pl-3" />
                        <div className="pl pl-4" />
                        <div className="pl pl-5" />
                        <div className="pl pl-6" />
                        <div className="pl pl-7" />
                        <div className="pl pl-8" />
                        <div className="pl pl-9" />
                        <div className="pl pl-10" />
                        <div className="pl pl-11" />

                        {/* Scan layers */}
                        <div className="scan-wash" />
                        <div className="scan-glow" />
                        <div className="scan-beam" />

                      </div>
                      <div className="paper-shadow" />
                    </div>

                    {/* Message — key forces re-animation on every change */}
                    <div className="loading-msg-wrap">
                      <span className="loading-msg" key={msgIndex}>
                        {LOADING_MESSAGES[msgIndex]}
                      </span>
                      <div className="loading-dots">
                        <span /><span /><span />
                      </div>
                    </div>

                  </div>

                ) : (
                  /* ── Normal import UI ── */
                  <>
                    <button className="import-back" onClick={resetImport}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Back
                    </button>

                    <h1 className="new-heading">Import your resume.</h1>
                    <p className="new-sub">Upload a PDF or DOCX — we&apos;ll extract the text and open it in the builder pre-filled and ready to edit.</p>

                    {/* Drop zone */}
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
                        <div className="drop-title" style={{ color: "var(--gold-light)" }}>✓ File ready to import</div>
                      )}
                    </div>

                    {/* Selected file row */}
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
                          title="Remove"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Error */}
                    {error && (
                      <div className="import-error">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                          <path d="M7.5 1a6.5 6.5 0 100 13A6.5 6.5 0 007.5 1zM7 4.5a.5.5 0 011 0v4a.5.5 0 01-1 0v-4zm.5 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z" fill="currentColor"/>
                        </svg>
                        {error}
                      </div>
                    )}

                    {/* CTA */}
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", marginTop: "var(--space-5)", justifyContent: "center" }}
                      onClick={handleImport}
                      disabled={!file}
                    >
                      {file ? "Import & Open Builder →" : "Upload a file to continue"}
                    </button>

                    {/* Note */}
                    <div className="import-note">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--gold)", marginTop: 1 }}>
                        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      <p>
                        <strong>Text-based PDFs only.</strong> Scanned or image PDFs cannot be parsed.
                        After import all fields are editable — nothing is saved until you click &quot;Save Resume&quot;.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

          </div>
        </main>
      </div>
    </>
  );
}