"use client";
// components/review/ScoreCard.tsx
// ============================================================
// SCORE CARD
// Displays the overall ATS score ring, gradient bar,
// and greeting. Used in the review results left panel.
// ============================================================

interface Props {
  score:       number;
  userName?:   string;
  fileName?:   string;
  reviewedAt?: string;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--error)";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "Needs Work";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ScoreCard({ score, userName, fileName, reviewedAt }: Props) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const r     = 54;
  const circ  = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  const firstName = userName?.split(" ")[0] ?? "there";

  return (
    <>
      <style>{`
        .score-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          animation: fade-up 0.4s var(--ease) both;
        }

        .score-greeting { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-1); }
        .score-greeting strong { color: var(--text-primary); }
        .score-welcome  { font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-5); }

        .score-ring-wrap {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-2); margin-bottom: var(--space-4);
        }
        .score-ring-label {
          font-size: var(--text-sm); font-weight: 600;
          transition: color 0.3s;
        }

        .score-summary {
          text-align: center; font-size: var(--text-sm);
          color: var(--text-secondary); line-height: 1.65;
          margin-bottom: var(--space-5);
        }

        /* Gradient bar */
        .score-bar-section { }
        .score-bar-track {
          position: relative; height: 12px; border-radius: 99px;
          background: linear-gradient(to right,
            #ef4444 0%, #f97316 20%, #eab308 45%,
            #84cc16 70%, #22c55e 100%);
          margin-bottom: var(--space-2);
        }
        .score-marker {
          position: absolute; top: 50%; transform: translate(-50%, -50%);
          width: 16px; height: 16px; border-radius: 50%;
          z-index: 2; transition: left 1s cubic-bezier(0.4,0,0.2,1);
        }
        .score-marker-you {
          background: #fff; border: 3px solid #1a1a2e;
          box-shadow: 0 1px 4px rgba(0,0,0,.3);
        }
        .score-marker-top {
          width: 10px; height: 10px;
          background: var(--gold); border: 2px solid var(--gold-light);
        }
        .score-bar-labels {
          display: flex; align-items: center; justify-content: space-between;
          font-size: var(--text-xs); color: var(--text-secondary);
        }
        .score-legend {
          display: flex; align-items: center; gap: var(--space-3);
          font-size: var(--text-xs); color: var(--text-secondary);
        }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .legend-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }

        /* File info */
        .score-file-info {
          margin-top: var(--space-4); padding-top: var(--space-4);
          border-top: 1px solid var(--border);
          font-size: var(--text-xs); color: var(--text-secondary);
          display: flex; flex-direction: column; gap: 3px;
        }
        .score-file-name { color: var(--text-primary); font-weight: 500; }
      `}</style>

      <div className="score-card">
        {/* Greeting */}
        <p className="score-greeting">
          {getGreeting()}, <strong>{firstName}.</strong>
        </p>
        <p className="score-welcome">Welcome to your resume review.</p>

        {/* Score ring */}
        <div className="score-ring-wrap">
          <svg width="140" height="140" viewBox="0 0 140 140">
            {/* Background ring */}
            <circle
              cx="70" cy="70" r={r}
              fill="none" stroke="var(--bg-elevated)" strokeWidth="10"
            />
            {/* Score ring */}
            <circle
              cx="70" cy="70" r={r}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
            />
            {/* Score number */}
            <text
              x="70" y="63"
              textAnchor="middle"
              fill="var(--text-primary)"
              fontSize="30" fontWeight="900"
              fontFamily="var(--font-display)"
            >
              {score}
            </text>
            {/* Label */}
            <text
              x="70" y="82"
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize="9"
              fontFamily="var(--font-body)"
              letterSpacing="0.1em"
            >
              OVERALL
            </text>
          </svg>
          <div className="score-ring-label" style={{ color }}>
            {label}
          </div>
        </div>

        {/* Summary text */}
        <p className="score-summary">
          Your resume scored{" "}
          <strong style={{ color: "var(--text-primary)" }}>{score} out of 100.</strong>
          {score < 70 && (
            <>
              {" "}With a few targeted fixes you can increase your score by{" "}
              <strong style={{ color: "var(--gold)" }}>20+ points.</strong>
            </>
          )}
          {score >= 70 && score < 85 && (
            <> A few more improvements and your resume will be top-tier.</>
          )}
          {score >= 85 && (
            <> Your resume is in great shape. Keep refining for perfection.</>
          )}
        </p>

        {/* Gradient bar */}
        <div className="score-bar-section">
          <div className="score-bar-track">
            {/* Your score marker */}
            <div
              className="score-marker score-marker-you"
              style={{ left: `${score}%` }}
              title={`Your score: ${score}`}
            />
            {/* Top resumes marker */}
            <div
              className="score-marker score-marker-top"
              style={{ left: "88%" }}
              title="Top resumes: ~88"
            />
          </div>
          <div className="score-bar-labels">
            <span>0</span>
            <div className="score-legend">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: "#fff", border: "2px solid #1a1a2e" }} />
                Your resume
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: "var(--gold)" }} />
                Top resumes
              </div>
            </div>
            <span>100</span>
          </div>
        </div>

        {/* File info */}
        {(fileName || reviewedAt) && (
          <div className="score-file-info">
            {fileName   && <span className="score-file-name">{fileName}</span>}
            {reviewedAt && (
              <span>
                Reviewed{" "}
                {new Date(reviewedAt).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}