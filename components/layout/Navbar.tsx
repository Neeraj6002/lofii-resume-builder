"use client";
// components/layout/Navbar.tsx
// ============================================================
// NAVBAR
// Shared top navigation for all dashboard pages.
// Shows logo, premium badge, avatar dropdown.
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, signOut, getIdToken } = useAuth();

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const initials = user?.displayName
    ?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() ?? "U";

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  async function handleUpgrade() {
    if (!user) return;
    setUpgrading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        alert("Session expired. Please sign in again.");
        return;
      }
      const res  = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error(data.error ?? "No URL");
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setUpgrading(false);
    }
  }

  const navLinks = [
    { href: "/dashboard",    label: "Dashboard" },
    { href: "/resume/create", label: "New Resume" },
    { href: "/review/upload", label: "Review"     },
  ];

  return (
    <>
      <style>{`
        .navbar {
          position: sticky; top: 0; z-index: var(--z-sticky);
          height: var(--nav-height);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 5vw;
          background: var(--bg-overlay);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
        }

        .navbar-left {
          display: flex; align-items: center; gap: var(--space-8);
        }

        .navbar-logo {
          font-family: var(--font-display);
          font-size: 1.3rem; font-weight: 900;
          color: var(--text-primary); text-decoration: none;
          letter-spacing: -0.02em; flex-shrink: 0;
        }
        .navbar-logo span { color: var(--gold); }

        .navbar-links {
          display: flex; align-items: center; gap: var(--space-1);
        }
        .nav-link {
          padding: 5px 12px; border-radius: var(--radius-md);
          font-size: var(--text-sm); color: var(--text-secondary);
          text-decoration: none; font-weight: 500;
          transition: background var(--duration-fast), color var(--duration-fast);
          white-space: nowrap;
        }
        .nav-link:hover  { background: var(--bg-elevated); color: var(--text-primary); }
        .nav-link.active { background: var(--bg-elevated); color: var(--text-primary); }

        .navbar-right {
          display: flex; align-items: center; gap: var(--space-4);
        }

        /* Premium pill */
        .premium-pill {
          display: flex; align-items: center; gap: var(--space-1);
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          color: var(--gold-light); padding: 3px 10px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs); font-weight: 600;
          white-space: nowrap;
        }

        /* Upgrade btn */
        .upgrade-btn {
          font-size: var(--text-xs); font-weight: 600;
          padding: 5px 12px; border-radius: var(--radius-md);
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          color: var(--gold-light); cursor: pointer;
          transition: all var(--duration-fast); white-space: nowrap;
        }
        .upgrade-btn:hover { background: rgba(201,168,76,.25); }

        /* Avatar */
        .avatar-wrap { position: relative; }
        .avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: var(--gold-dim); border: 1.5px solid var(--gold-border);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xs); font-weight: 700;
          color: var(--gold-light); cursor: pointer;
          transition: border-color var(--duration-base);
          user-select: none;
        }
        .avatar:hover { border-color: var(--gold); }

        /* Dropdown */
        .avatar-menu {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: var(--bg-elevated);
          border: 1px solid var(--border-hover);
          border-radius: var(--radius-lg);
          padding: var(--space-2);
          min-width: 210px;
          box-shadow: var(--shadow-md);
          z-index: var(--z-dropdown);
          animation: fade-down 0.15s var(--ease) both;
        }
        .menu-user {
          padding: var(--space-3) var(--space-3) var(--space-2);
          border-bottom: 1px solid var(--border);
          margin-bottom: var(--space-2);
        }
        .menu-name  { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
        .menu-email { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; word-break: break-all; }
        .menu-item {
          display: flex; align-items: center; gap: var(--space-3);
          width: 100%; padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm); color: var(--text-secondary);
          background: none; border: none; cursor: pointer;
          text-decoration: none; transition: background var(--duration-fast), color var(--duration-fast);
          text-align: left;
        }
        .menu-item:hover { background: var(--bg-surface); color: var(--text-primary); }
        .menu-item.danger:hover { background: var(--error-dim); color: var(--error); }
        .menu-divider { height: 1px; background: var(--border); margin: var(--space-2) 0; }

        @media (max-width: 640px) {
          .navbar-links { display: none; }
          .upgrade-btn  { display: none; }
        }
      `}</style>

      <header className="navbar">
        <div className="navbar-left">
          <Link href="/dashboard" className="navbar-logo">
            Resu<span>MAI</span>
          </Link>
          <nav className="navbar-links">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link${pathname === l.href ? " active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="navbar-right">
          {user?.isPremium ? (
            <div className="premium-pill">✦ Premium</div>
          ) : (
            <button
              className={`upgrade-btn${upgrading ? " btn-loading" : ""}`}
              onClick={handleUpgrade}
              disabled={upgrading}
            >
              {upgrading ? "" : "✦ Upgrade — $2"}
            </button>
          )}

          <div className="avatar-wrap">
            <div
              className="avatar"
              onClick={() => setMenuOpen((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setMenuOpen((v) => !v)}
              aria-label="Open user menu"
            >
              {initials}
            </div>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: "calc(var(--z-dropdown) - 1)" }}
                  onClick={() => setMenuOpen(false)}
                />
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

                  <Link href="/resume/create" className="menu-item" onClick={() => setMenuOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    New Resume
                  </Link>

                  <Link href="/review/upload" className="menu-item" onClick={() => setMenuOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1v8M4 4l3-3 3 3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Review Resume
                  </Link>

                  <div className="menu-divider" />

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
    </>
  );
}