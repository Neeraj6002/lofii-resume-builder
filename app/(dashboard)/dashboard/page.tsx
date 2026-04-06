"use client";
// app/(dashboard)/dashboard/page.tsx

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ResumeCard {
  id:              string;
  title:           string;
  template:        string;
  updatedAt:       { _seconds: number };
  lastReviewScore: number | null;
}

function timeAgo(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)      return "just now";
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function scoreColor(score: number): string {
  if (score >= 75) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--error)";
}

function templateLabel(t: string): string {
  const map: Record<string, string> = {
    classic: "Classic", modern: "Modern", minimal: "Minimal",
    executive: "Executive", creative: "Creative", tech: "Tech",
  };
  return map[t] ?? t;
}

function ResumeCardItem({ resume, onDelete }: { resume: ResumeCard; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [confirm,  setConfirm]  = useState(false);
  const { getIdToken } = useAuth();

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    try {
      const token = await getIdToken();
      if (!token) { toast.error("Session expired."); setDeleting(false); setConfirm(false); return; }
      const res = await fetch(`/api/resume/${resume.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Resume deleted.");
      onDelete(resume.id);
    } catch {
      toast.error("Could not delete resume. Try again.");
      setDeleting(false);
      setConfirm(false);
    }
  }

  return (
    <div className="resume-card">
      {resume.lastReviewScore !== null && (
        <div className="resume-score" style={{ color: scoreColor(resume.lastReviewScore) }}>
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" fill="none" stroke="var(--bg-elevated)" strokeWidth="3"/>
            <circle cx="14" cy="14" r="11" fill="none"
              stroke={scoreColor(resume.lastReviewScore)} strokeWidth="3"
              strokeLinecap="round" strokeDasharray={69.1}
              strokeDashoffset={69.1 - (resume.lastReviewScore / 100) * 69.1}
              transform="rotate(-90 14 14)"
            />
          </svg>
          <span>{resume.lastReviewScore}</span>
        </div>
      )}
      <div className="resume-template-tag badge badge-muted">{templateLabel(resume.template)}</div>
      <div className="resume-preview">
        <div className="rp-name" /><div className="rp-role" />
        <div className="rp-line rp-full" /><div className="rp-line rp-80" /><div className="rp-line rp-60" />
        <div className="rp-divider" />
        <div className="rp-line rp-40" /><div className="rp-line rp-full" /><div className="rp-line rp-70" />
      </div>
      <div className="resume-info">
        <h5 className="resume-title">{resume.title}</h5>
        <span className="resume-date">Edited {timeAgo(resume.updatedAt._seconds)}</span>
      </div>
      <div className="resume-actions">
        <Link href={`/resume/${resume.id}/edit`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Edit</Link>
        <Link href={`/review/upload?resumeId=${resume.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}>Review</Link>
        <button
          className={`btn btn-sm ${confirm ? "btn-danger" : "btn-ghost"}`}
          onClick={handleDelete}
          disabled={deleting}
          title={confirm ? "Click again to confirm" : "Delete"}
          style={{ flexShrink: 0 }}
        >
          {deleting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : confirm ? "Sure?" : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M5.5 3.5V2h3v1.5M6 6v4M8 6v4M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="6" y="4" width="24" height="28" rx="3" stroke="var(--gold)" strokeWidth="1.5"/>
          <path d="M11 12h14M11 17h14M11 22h8" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="27" cy="27" r="6" fill="var(--bg-surface)" stroke="var(--gold)" strokeWidth="1.5"/>
          <path d="M27 24v6M24 27h6" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <h4 className="empty-title">No resumes yet</h4>
      <p className="empty-desc">Create your first resume and let AI write the content for you.</p>
      <Link href="/resume/create" className="btn btn-primary">Create My First Resume →</Link>
    </div>
  );
}

// ─── INNER COMPONENT ─────────────────────────────────────────
function DashboardContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut, getIdToken, refreshUser } = useAuth();

  const [resumes,   setResumes]   = useState<ResumeCard[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // ── After payment redirect ────────────────────────────────
  // Re-fetch isPremium from Firestore immediately so the UI reflects
  // the upgraded state without requiring a full sign-out/sign-in.
  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      toast.success("Payment successful! You now have lifetime premium access 🎉");
      window.history.replaceState({}, "", "/dashboard");
      // Refresh user so isPremium flips to true immediately
      refreshUser();
    }
  }, [searchParams, refreshUser]);

  const fetchResumes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) { toast.error("Session expired."); setLoading(false); return; }
      const res = await fetch("/api/resume", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setResumes(data.resumes ?? []);
    } catch {
      toast.error("Could not load resumes. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    if (!authLoading && user)  fetchResumes();
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, fetchResumes, router]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  async function handleUpgrade() {
    if (!user) return;
    setUpgrading(true);
    try {
      const token = await getIdToken();
      if (!token) { toast.error("Session expired."); return; }
      const res  = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error(data.error ?? "No URL");
    } catch (err: unknown) {
      const msg = (err as Error).message;
      toast.error(
        msg === "You already have a premium account."
          ? "You already have premium! Refresh the page."
          : "Could not start checkout. Try again."
      );
    } finally {
      setUpgrading(false);
    }
  }

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const initials = user?.displayName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() ?? "U";

  return (
    <>
      <style>{`
        .dash-layout { min-height: 100vh; display: flex; flex-direction: column; }

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
        .topbar-right { display: flex; align-items: center; gap: var(--space-4); }

        .premium-pill { display: flex; align-items: center; gap: var(--space-1); background: var(--gold-dim); border: 1px solid var(--gold-border); color: var(--gold-light); padding: 3px 10px; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600; }

        .avatar-wrap { position: relative; }
        .avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--gold-dim); border: 1px solid var(--gold-border); display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: 700; color: var(--gold-light); cursor: pointer; transition: border-color var(--duration-base); }
        .avatar:hover { border-color: var(--gold); }

        .avatar-menu { position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-elevated); border: 1px solid var(--border-hover); border-radius: var(--radius-lg); padding: var(--space-2); min-width: 200px; box-shadow: var(--shadow-md); z-index: var(--z-dropdown); animation: fade-down 0.15s var(--ease) both; }
        .menu-user { padding: var(--space-3) var(--space-3) var(--space-2); border-bottom: 1px solid var(--border); margin-bottom: var(--space-2); }
        .menu-name  { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
        .menu-email { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; }
        .menu-item { display: flex; align-items: center; gap: var(--space-3); width: 100%; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--text-secondary); background: none; border: none; cursor: pointer; text-decoration: none; transition: background var(--duration-fast), color var(--duration-fast); text-align: left; }
        .menu-item:hover { background: var(--bg-surface); color: var(--text-primary); }
        .menu-item.danger:hover { background: var(--error-dim); color: var(--error); }

        .dash-content { flex: 1; max-width: var(--max-width); width: 100%; margin: 0 auto; padding: var(--space-10) 5vw; }

        .premium-banner { display: flex; align-items: center; justify-content: space-between; gap: var(--space-6); background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(201,168,76,.06) 100%); border: 1px solid var(--gold-border); border-radius: var(--radius-lg); padding: var(--space-5) var(--space-6); margin-bottom: var(--space-8); animation: fade-up 0.4s var(--ease) both; }
        .banner-left { display: flex; align-items: center; gap: var(--space-4); }
        .banner-icon { font-size: 1.6rem; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: var(--radius-md); flex-shrink: 0; }
        .banner-title { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
        .banner-sub   { font-size: var(--text-sm); color: var(--text-secondary); }

        .dash-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-6); }
        .dash-title  { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
        .dash-actions { display: flex; align-items: center; gap: var(--space-3); }

        .resume-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-5); }

        .resume-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); position: relative; transition: border-color var(--duration-base), transform var(--duration-base); animation: fade-up 0.4s var(--ease) both; display: flex; flex-direction: column; gap: var(--space-4); }
        .resume-card:hover { border-color: var(--border-hover); transform: translateY(-2px); }
        .resume-score { position: absolute; top: var(--space-4); right: var(--space-4); display: flex; align-items: center; gap: 5px; font-size: var(--text-xs); font-weight: 700; }
        .resume-template-tag { align-self: flex-start; }

        .resume-preview { background: #fff; border-radius: var(--radius-sm); padding: 12px 10px; display: flex; flex-direction: column; gap: 4px; }
        .rp-name { height: 8px; background: #1a1a2e; border-radius: 3px; width: 50%; }
        .rp-role { height: 5px; background: #c9a84c; border-radius: 3px; width: 32%; opacity: .7; margin-bottom: 4px; }
        .rp-line { height: 4px; background: #ebebeb; border-radius: 3px; }
        .rp-full { width: 100%; } .rp-80 { width: 80%; } .rp-70 { width: 70%; } .rp-60 { width: 60%; } .rp-40 { width: 40%; }
        .rp-divider { height: 1px; background: #e8e8e8; margin: 4px 0; }

        .resume-info    { display: flex; flex-direction: column; gap: var(--space-1); }
        .resume-title   { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); }
        .resume-date    { font-size: var(--text-xs); color: var(--text-secondary); }
        .resume-actions { display: flex; gap: var(--space-2); }

        .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-5); }
        .skeleton-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }

        .empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: var(--space-20) var(--space-6); gap: var(--space-4); }
        .empty-icon  { width: 72px; height: 72px; background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: var(--radius-xl); display: flex; align-items: center; justify-content: center; }
        .empty-title { font-size: var(--text-xl); color: var(--text-primary); }
        .empty-desc  { font-size: var(--text-sm); color: var(--text-secondary); max-width: 320px; }

        @media (max-width: 640px) {
          .premium-banner { flex-direction: column; align-items: flex-start; }
          .dash-header    { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
          .dash-actions   { width: 100%; }
          .dash-actions .btn { flex: 1; justify-content: center; }
        }
      `}</style>

      <div className="bg-mesh" />

      <div className="dash-layout">
        <header className="topbar">
          <Link href="/dashboard" className="topbar-logo">Resu<span>MAI</span></Link>
          <div className="topbar-right">
            {user?.isPremium && <div className="premium-pill">✦ Premium</div>}
            <div className="avatar-wrap">
              <div
                className="avatar"
                onClick={() => setMenuOpen(v => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && setMenuOpen(v => !v)}
              >
                {initials}
              </div>
              {menuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: "calc(var(--z-dropdown) - 1)" }} onClick={() => setMenuOpen(false)} />
                  <div className="avatar-menu">
                    <div className="menu-user">
                      <div className="menu-name">{user?.displayName ?? "User"}</div>
                      <div className="menu-email">{user?.email}</div>
                    </div>
                    <Link href="/dashboard" className="menu-item" onClick={() => setMenuOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                        <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                        <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                        <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                      Dashboard
                    </Link>
                    <button className="menu-item danger" onClick={handleSignOut}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 7h7M9 5l2 2-2 2M9 2H3a1 1 0 00-1 1v8a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="dash-content">
          {!user?.isPremium && (
            <div className="premium-banner">
              <div className="banner-left">
                <div className="banner-icon">✦</div>
                <div>
                  <div className="banner-title">Unlock AI-powered resume writing</div>
                  <div className="banner-sub">One-time payment — review 1 full resume and generate content for 1 full resume.</div>
                </div>
              </div>
              <button
                className={`btn btn-primary btn-sm${upgrading ? " btn-loading" : ""}`}
                onClick={handleUpgrade}
                disabled={upgrading}
                style={{ flexShrink: 0 }}
              >
                {upgrading ? "" : "Upgrade to Premium →"}
              </button>
            </div>
          )}

          <div className="dash-header">
            <div>
              <h1 className="dash-title">My Resumes</h1>
              <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
                {resumes.length > 0 ? `${resumes.length} resume${resumes.length > 1 ? "s" : ""}` : "Build your first resume below"}
              </p>
            </div>
            <div className="dash-actions">
              <Link href="/review/upload" className="btn btn-secondary btn-sm">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 4L7 1l3 3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Review Resume
              </Link>
              <Link href="/resume/create" className="btn btn-primary btn-sm">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                New Resume
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="skeleton-grid">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: "var(--radius-sm)" }} />
                  <div className="skeleton" style={{ height: 100, borderRadius: "var(--radius-sm)" }} />
                  <div className="skeleton" style={{ height: 12, width: "80%" }} />
                  <div className="skeleton" style={{ height: 32, borderRadius: "var(--radius-md)" }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="resume-grid">
              {resumes.length === 0 ? (
                <EmptyState />
              ) : (
                resumes.map((r, i) => (
                  <div key={r.id} style={{ animationDelay: `${i * 60}ms` }}>
                    <ResumeCardItem
                      resume={r}
                      onDelete={id => setResumes(prev => prev.filter(x => x.id !== id))}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function DashboardFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}