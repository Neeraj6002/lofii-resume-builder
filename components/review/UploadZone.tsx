"use client";
// components/review/UploadZone.tsx
// ============================================================
// UPLOAD ZONE
// Reusable drag-and-drop file upload component.
// Accepts PDF and DOCX. Validates type and size.
// ============================================================

import { useRef, useState, useCallback } from "react";

interface Props {
  onFile:    (file: File) => void;
  disabled?: boolean;
  file?:     File | null;
  onRemove?: () => void;
}

const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_MB = 5;

export default function UploadZone({ onFile, disabled, file, onRemove }: Props) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [over,     setOver]     = useState(false);
  const [error,    setError]    = useState("");

  function validate(f: File): string | null {
    if (!ACCEPTED.includes(f.type)) return "Only PDF and DOCX files are supported.";
    if (f.size > MAX_SIZE_MB * 1024 * 1024) return `File must be under ${MAX_SIZE_MB}MB.`;
    return null;
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const err = validate(f);
    if (err) { setError(err); return; }
    setError("");
    onFile(f);
  }, [disabled, onFile]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validate(f);
    if (err) { setError(err); return; }
    setError("");
    onFile(f);
  }, [onFile]);

  const sizeKB = file ? (file.size / 1024).toFixed(0) : null;
  const isDocx = file?.type.includes("word");

  return (
    <>
      <style>{`
        .upload-zone {
          border: 2px dashed var(--border);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          padding: var(--space-12) var(--space-8);
          text-align: center; cursor: pointer;
          transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
          position: relative;
        }
        .upload-zone.over     { border-color: var(--gold-border); background: var(--gold-dim); }
        .upload-zone.has-file { border-style: solid; border-color: var(--gold-border); }
        .upload-zone.disabled { cursor: not-allowed; opacity: 0.6; pointer-events: none; }

        .upload-icon {
          width: 52px; height: 52px; margin: 0 auto var(--space-4);
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
        }
        .upload-title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2); }
        .upload-sub   { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4); }
        .upload-types { display: flex; align-items: center; justify-content: center; gap: var(--space-2); }

        /* Selected file row */
        .file-row {
          display: flex; align-items: center; gap: var(--space-3);
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: var(--space-4);
          margin-top: var(--space-4); text-align: left;
        }
        .file-row-icon {
          width: 36px; height: 36px; flex-shrink: 0;
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
        }
        .file-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); word-break: break-all; }
        .file-meta { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; }
        .file-remove {
          margin-left: auto; flex-shrink: 0;
          background: none; border: none; cursor: pointer;
          color: var(--text-secondary); padding: var(--space-1);
          transition: color var(--duration-fast);
          display: flex; align-items: center;
        }
        .file-remove:hover { color: var(--error); }

        /* Error */
        .upload-error {
          background: var(--error-dim); border: 1px solid rgba(248,113,113,.2);
          border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm); color: var(--error);
          margin-top: var(--space-3);
          display: flex; align-items: flex-start; gap: var(--space-2);
        }
      `}</style>

      <div>
        {/* Drop zone */}
        <div
          className={`upload-zone${over ? " over" : ""}${file ? " has-file" : ""}${disabled ? " disabled" : ""}`}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload resume file"
          onKeyDown={e => e.key === "Enter" && !file && !disabled && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: "none" }}
            onChange={handleInput}
          />

          {!file ? (
            <>
              <div className="upload-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v13M8 7l4-5 4 5" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20 17v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="upload-title">Drop your resume here</div>
              <p className="upload-sub">or click to browse your files</p>
              <div className="upload-types">
                <span className="badge badge-muted">PDF</span>
                <span className="badge badge-muted">DOCX</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-disabled)" }}>
                  · Max {MAX_SIZE_MB}MB
                </span>
              </div>
            </>
          ) : (
            <div className="upload-title" style={{ color: "var(--gold-light)" }}>
              ✓ File ready to review
            </div>
          )}
        </div>

        {/* File info row */}
        {file && (
          <div className="file-row">
            <div className="file-row-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M10 2H5a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7l-5-5z"
                  stroke="var(--gold)" strokeWidth="1.4"/>
                <path d="M10 2v5h5" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                {sizeKB} KB · {isDocx ? "DOCX" : "PDF"}
              </div>
            </div>
            {onRemove && (
              <button
                className="file-remove"
                onClick={e => { e.stopPropagation(); onRemove(); setError(""); }}
                title="Remove file"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="upload-error">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M7 4.5v3M7 9.5h.01" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}
      </div>
    </>
  );
}