"use client";
// app/(auth)/register/page.tsx
// ============================================================
// REGISTER PAGE
// - Google OAuth (same flow as login — Firebase handles new/existing)
// - Email + Password + Full Name
// - Client-side validation before hitting Firebase
// - Password strength indicator
// - Redirects to /dashboard on success
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── Firebase error → human readable ─────────────────────────
function parseFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use":   "An account with this email already exists.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user":   "Sign-in popup was closed.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

// ─── Password strength ────────────────────────────────────────
function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (password.length >= 8)           score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { label: "Too short", color: "var(--error)"   },
    { label: "Weak",      color: "var(--error)"   },
    { label: "Fair",      color: "var(--warning)"  },
    { label: "Good",      color: "var(--gold)"     },
    { label: "Strong",    color: "var(--success)"  },
  ];
  return { score, ...levels[score] };
}

export default function RegisterPage() {
  const router = useRouter();
  const { signInWithGoogle, signUpWithEmail } = useAuth();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState<"google" | "email" | null>(null);
  const [error,    setError]    = useState("");

  const strength = getStrength(password);
  const busy     = loading !== null;

  // ── Create session cookie after Firebase auth ───────────────────
  async function createSession() {
    const { auth } = await import("@/lib/firebase/client");
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    const idToken = await user.getIdToken();

    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to create session");
    }
  }

  // ── Sync user to Firestore after signup ───────────────────────
  async function syncUser() {
    const { auth } = await import("@/lib/firebase/client");
    const user = auth.currentUser;
    if (!user) throw new Error("No user to sync");
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to sync user");
    }
  }

  // ── Google sign-up ─────────────────────────────────────────
  async function handleGoogle() {
    setError("");
    setLoading("google");
    try {
      await signInWithGoogle();
      await createSession();
      await syncUser();
      toast.success("Account created! Welcome to RESUFII 🎉");
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(parseFirebaseError(code));
    } finally {
      setLoading(null);
    }
  }

  // ── Email sign-up ──────────────────────────────────────────
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim())                                    return setError("Please enter your full name.");
    if (name.trim().length < 2)                          return setError("Name must be at least 2 characters.");
    if (!email.trim())                                   return setError("Please enter your email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))      return setError("Please enter a valid email address.");
    if (!password)                                       return setError("Please create a password.");
    if (password.length < 6)                             return setError("Password must be at least 6 characters.");

    setLoading("email");
    try {
      await signUpWithEmail(email.trim(), password, name.trim());
      await createSession();
      toast.success("Welcome to RESUFII! Let's build your resume 🚀");
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(parseFirebaseError(code));
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-6);
        }
        .auth-card {
          width: 100%; max-width: 420px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 2.5rem 2.2rem;
          box-shadow: var(--shadow-lg);
          animation: fade-up 0.4s var(--ease) both;
        }
        .auth-logo {
          font-family: var(--font-display);
          font-size: 1.5rem; font-weight: 900;
          color: var(--text-primary); text-decoration: none;
          letter-spacing: -0.02em;
          display: block; text-align: center;
          margin-bottom: var(--space-8);
        }
        .auth-logo span { color: var(--gold); }
        .auth-heading {
          font-family: var(--font-display);
          font-size: var(--text-3xl); font-weight: 700;
          color: var(--text-primary);
          text-align: center; margin-bottom: var(--space-2);
          letter-spacing: -0.02em;
        }
        .auth-sub {
          text-align: center; font-size: var(--text-sm);
          color: var(--text-secondary); margin-bottom: var(--space-6);
        }

        /* Benefits */
        .benefits {
          display: flex; flex-direction: column; gap: var(--space-2);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          margin-bottom: var(--space-6);
        }
        .benefit-row {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-xs); color: var(--text-secondary);
        }
        .benefit-check { color: var(--gold); font-weight: 700; flex-shrink: 0; }

        /* Google button */
        .btn-google {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: var(--space-3);
          background: var(--bg-elevated);
          border: 1px solid var(--border-hover);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          font-family: var(--font-body);
          font-size: var(--text-base); font-weight: 500;
          color: var(--text-primary); cursor: pointer;
          transition: background var(--duration-base), border-color var(--duration-base), transform var(--duration-fast);
          margin-bottom: var(--space-5);
        }
        .btn-google:hover:not(:disabled) {
          background: var(--bg-base);
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }
        .btn-google:disabled { opacity: 0.5; cursor: not-allowed; }
        .google-icon { width: 18px; height: 18px; flex-shrink: 0; }

        /* Fields */
        .field { margin-bottom: var(--space-4); }

        /* Password */
        .pass-wrap { position: relative; }
        .pass-wrap .input { padding-right: 3rem; }
        .pass-toggle {
          position: absolute; right: 0.85rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: var(--text-secondary); padding: 0;
          display: flex; align-items: center;
          transition: color var(--duration-base);
        }
        .pass-toggle:hover { color: var(--text-primary); }

        /* Strength */
        .strength-row {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-top: var(--space-2); gap: var(--space-3);
        }
        .strength-bars { display: flex; gap: 4px; flex: 1; }
        .strength-bar {
          height: 3px; flex: 1; border-radius: 99px;
          background: var(--bg-elevated);
          transition: background 0.3s var(--ease);
        }
        .strength-label {
          font-size: var(--text-xs); color: var(--text-secondary);
          white-space: nowrap; min-width: 44px; text-align: right;
          transition: color 0.3s var(--ease);
        }

        /* Error */
        .auth-error {
          background: var(--error-dim);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm); color: var(--error);
          margin-bottom: var(--space-4);
          display: flex; align-items: flex-start; gap: var(--space-2);
        }

        .btn-submit { width: 100%; margin-top: var(--space-2); }

        .auth-footer {
          text-align: center; margin-top: var(--space-6);
          font-size: var(--text-sm); color: var(--text-secondary);
        }
        .auth-footer a { color: var(--gold); font-weight: 500; }
        .auth-footer a:hover { color: var(--gold-light); }

        .auth-terms {
          text-align: center; margin-top: var(--space-5);
          font-size: var(--text-xs); color: var(--text-disabled); line-height: 1.6;
        }
        .auth-terms a { color: var(--text-secondary); text-decoration: underline; }
      `}</style>

      <div className="bg-mesh" />
      <div className="bg-grain" />

      <main className="auth-page">
        <div className="auth-card">

          {/* Logo */}
          <Link href="/" className="auth-logo">Resu<span>fii</span></Link>

          {/* Heading */}
          <h1 className="auth-heading">Create your account</h1>
          <p className="auth-sub">Free forever. No credit card required.</p>

          {/* Benefits */}
          <div className="benefits">
            {["Build unlimited resumes", "6 professional templates", "ATS score on every resume"].map((b) => (
              <div key={b} className="benefit-row">
                <span className="benefit-check">✓</span>{b}
              </div>
            ))}
          </div>

          {/* Google */}
          <button className="btn-google" onClick={handleGoogle} disabled={busy}>
            {loading === "google" ? (
              <span className="spinner" style={{ width: 18, height: 18 }} />
            ) : (
              <svg className="google-icon" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading === "google" ? "Creating account…" : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="divider-text" style={{ marginBottom: "var(--space-5)" }}>
            or sign up with email
          </div>

          {/* Error */}
          {error && (
            <div className="auth-error">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M7.5 1a6.5 6.5 0 100 13A6.5 6.5 0 007.5 1zM7 4.5a.5.5 0 011 0v4a.5.5 0 01-1 0v-4zm.5 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z" fill="currentColor"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmail} noValidate>

            {/* Name */}
            <div className="field">
              <label className="label" htmlFor="name">Full Name</label>
              <div className="input-group">
                <svg className="input-icon" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  id="name" type="text" className="input"
                  placeholder="Arjun Sharma"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  autoComplete="name" disabled={busy} required
                />
              </div>
            </div>

            {/* Email */}
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <div className="input-group">
                <svg className="input-icon" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  id="email" type="email" className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  autoComplete="email" disabled={busy} required
                />
              </div>
            </div>

            {/* Password */}
            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <div className="pass-wrap">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  className="input"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  autoComplete="new-password" disabled={busy} required
                />
                <button
                  type="button" className="pass-toggle"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                  )}
                </button>
              </div>

              {/* Strength bar */}
              {password && (
                <div className="strength-row">
                  <div className="strength-bars">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className="strength-bar"
                        style={{ background: strength.score >= bar ? strength.color : "var(--bg-elevated)" }}
                      />
                    ))}
                  </div>
                  <span className="strength-label" style={{ color: strength.score > 0 ? strength.color : "var(--text-secondary)" }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className={`btn btn-primary btn-submit${loading === "email" ? " btn-loading" : ""}`}
              disabled={busy}
            >
              {loading === "email" ? "" : "Create Free Account →"}
            </button>
          </form>

          {/* Footer */}
          <p className="auth-footer">
            Already have an account?{" "}
            <Link href="/login">Sign in →</Link>
          </p>

          <p className="auth-terms">
            By creating an account, you agree to our{" "}
            <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>

        </div>
      </main>
    </>
  );
}