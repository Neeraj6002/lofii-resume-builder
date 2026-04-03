"use client";
// app/(auth)/login/page.tsx

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── Firebase error → human readable ─────────────────────────
function parseFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/invalid-credential":      "Incorrect email or password.",
    "auth/user-not-found":          "No account found with this email.",
    "auth/wrong-password":          "Incorrect password.",
    "auth/too-many-requests":       "Too many attempts. Try again later.",
    "auth/user-disabled":           "This account has been disabled.",
    "auth/network-request-failed":  "Network error. Check your connection.",
    "auth/popup-closed-by-user":    "Sign-in popup was closed.",
    "auth/cancelled-popup-request": "Another sign-in is in progress.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

// ─── INNER COMPONENT (uses useSearchParams — must be inside Suspense) ───
function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect") ?? "/dashboard";
  const { signInWithGoogle, signInWithEmail } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState<"google" | "email" | null>(null);
  const [error,    setError]    = useState("");

  // ── Create session cookie after Firebase auth ──────────────
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

  // ── Google sign-in ─────────────────────────────────────────
  async function handleGoogle() {
    setError("");
    setLoading("google");
    try {
      await signInWithGoogle();
      await createSession();
      toast.success("Welcome back!");
      router.push(redirect);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(parseFirebaseError(code));
      setLoading(null);
    }
  }

  // ── Email sign-in ──────────────────────────────────────────
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) return setError("Please enter your email.");
    if (!password)     return setError("Please enter your password.");

    setLoading("email");
    try {
      await signInWithEmail(email.trim(), password);
      await createSession();
      toast.success("Welcome back!");
      router.push(redirect);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(parseFirebaseError(code));
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <>
      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
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
          color: var(--text-secondary); margin-bottom: var(--space-8);
        }

        .btn-google {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: var(--space-3);
          background: var(--bg-elevated);
          border: 1px solid var(--border-hover);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          font-family: var(--font-body);
          font-size: var(--text-base); font-weight: 500;
          color: var(--text-primary);
          cursor: pointer;
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

        .field { margin-bottom: var(--space-4); }

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

        .forgot {
          display: block; text-align: right;
          font-size: var(--text-xs); color: var(--text-secondary);
          text-decoration: none; margin-top: var(--space-1);
          transition: color var(--duration-base);
        }
        .forgot:hover { color: var(--gold); }

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
          font-size: var(--text-xs); color: var(--text-disabled);
          line-height: 1.6;
        }
        .auth-terms a { color: var(--text-secondary); text-decoration: underline; }
      `}</style>

      <div className="bg-mesh" />
      <div className="bg-grain" />

      <main className="auth-page">
        <div className="auth-card">

          <Link href="/" className="auth-logo">
            Resu<span>fii</span>
          </Link>

          <h1 className="auth-heading">Welcome back</h1>
          <p className="auth-sub">Sign in to continue building your resume.</p>

          <button className="btn-google" onClick={handleGoogle} disabled={busy}>
            {loading === "google" ? (
              <span className="spinner" style={{ width: 18, height: 18 }} />
            ) : (
              <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading === "google" ? "Signing in…" : "Continue with Google"}
          </button>

          <div className="divider-text" style={{ marginBottom: "var(--space-5)" }}>
            or sign in with email
          </div>

          {error && (
            <div className="auth-error">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M7.5 1a6.5 6.5 0 100 13A6.5 6.5 0 007.5 1zM7 4.5a.5.5 0 011 0v4a.5.5 0 01-1 0v-4zm.5 6.5a.75.75 0 110-1.5.75.75 0 010 1.5z" fill="currentColor"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleEmail} noValidate>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <div className="input-group">
                <svg className="input-icon" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  id="email"
                  type="email"
                  className={`input${error && !password ? " input-error" : ""}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  autoComplete="email"
                  disabled={busy}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <div className="pass-wrap">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  className={`input${error && !email ? " input-error" : ""}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  className="pass-toggle"
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
              <Link href="/forgot-password" className="forgot">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className={`btn btn-primary btn-submit${loading === "email" ? " btn-loading" : ""}`}
              disabled={busy}
            >
              {loading === "email" ? "" : "Sign In"}
            </button>
          </form>

          <p className="auth-footer">
            Don&apos;t have an account?{" "}
            <Link href="/register">Create one free →</Link>
          </p>

          <p className="auth-terms">
            By signing in, you agree to our{" "}
            <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>

        </div>
      </main>
    </>
  );
}

// ─── LOADING FALLBACK ─────────────────────────────────────────
function LoginFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--bg-elevated)",
          borderTopColor: "var(--gold)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}