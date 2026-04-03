"use client";
// components/layout/Sidebar.tsx
// ============================================================
// SIDEBAR
// Left side navigation for dashboard layout.
// Collapsible on mobile.
// ============================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    href: "/resume/create",
    label: "New Resume",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 6h6M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M10 1v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/review/upload",
    label: "Review Resume",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.2 3.2l.85.85M11.95 11.95l.85.85M3.2 12.8l.85-.85M11.95 4.05l.85-.85" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname  = usePathname();
  const { user }  = useAuth();

  const initials = user?.displayName
    ?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() ?? "U";

  return (
    <>
      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          min-height: calc(100vh - var(--nav-height));
          background: var(--bg-surface);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          padding: var(--space-4) var(--space-3);
          position: sticky;
          top: var(--nav-height);
          height: calc(100vh - var(--nav-height));
          overflow-y: auto;
          flex-shrink: 0;
        }

        .sidebar-section { margin-bottom: var(--space-6); }
        .sidebar-label {
          font-size: var(--text-xs); font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: var(--text-disabled);
          padding: 0 var(--space-3);
          margin-bottom: var(--space-2);
        }

        .sidebar-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm); font-weight: 500;
          color: var(--text-secondary); text-decoration: none;
          transition: background var(--duration-fast), color var(--duration-fast);
          margin-bottom: 2px;
        }
        .sidebar-item:hover  { background: var(--bg-elevated); color: var(--text-primary); }
        .sidebar-item.active { background: var(--bg-elevated); color: var(--text-primary); }
        .sidebar-item.active svg { color: var(--gold); }
        .sidebar-item svg { flex-shrink: 0; transition: color var(--duration-fast); }

        /* Premium card */
        .sidebar-premium {
          margin-top: auto;
          padding-top: var(--space-4);
          border-top: 1px solid var(--border);
        }
        .premium-card {
          background: linear-gradient(135deg, var(--bg-elevated), rgba(201,168,76,.06));
          border: 1px solid var(--gold-border);
          border-radius: var(--radius-md);
          padding: var(--space-4);
        }
        .premium-card-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1); }
        .premium-card-desc  { font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-3); line-height: 1.5; }

        /* User row at bottom */
        .sidebar-user {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          margin-top: var(--space-3);
          background: var(--bg-elevated);
        }
        .sidebar-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: var(--gold-dim); border: 1px solid var(--gold-border);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.65rem; font-weight: 700; color: var(--gold-light);
          flex-shrink: 0;
        }
        .sidebar-user-name  { font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); }
        .sidebar-user-plan  { font-size: 0.65rem; color: var(--text-secondary); }

        @media (max-width: 900px) {
          .sidebar { display: none; }
        }
      `}</style>

      <aside className="sidebar">
        {/* Main nav */}
        <div className="sidebar-section">
          <div className="sidebar-label">Menu</div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${pathname === item.href ? " active" : ""}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        {/* Bottom items */}
        <div className="sidebar-section">
          <div className="sidebar-label">Other</div>
          {BOTTOM_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`sidebar-item${pathname === item.href ? " active" : ""}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        {/* Bottom — premium card or user info */}
        <div className="sidebar-premium">
          {!user?.isPremium && (
            <div className="premium-card">
              <div className="premium-card-title">✦ Go Premium</div>
              <div className="premium-card-desc">
                Unlock AI writing, full ATS review, and all fixes.
              </div>
              <Link href="/dashboard" className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }}>
                Upgrade — $2
              </Link>
            </div>
          )}

          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div>
              <div className="sidebar-user-name">
                {user?.displayName?.split(" ")[0] ?? "User"}
              </div>
              <div className="sidebar-user-plan">
                {user?.isPremium ? "✦ Premium" : "Free plan"}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}