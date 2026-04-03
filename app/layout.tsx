// app/layout.tsx
// ============================================================
// ROOT LAYOUT
// - Loads globals.css (design system + tokens)
// - Wraps the entire app in AuthProvider
// - Sets base metadata for SEO
// - Adds Sonner toast provider
// ============================================================

import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "sonner";
import "./globals.css";

// ─── SEO Metadata ─────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "RESUFII — AI Resume Builder",
    template: "%s | RESUFII",
  },
  description:
    "Build ATS-optimized resumes with AI-written content. Get scored, fix issues, and land more interviews — in minutes.",
  keywords: [
    "resume builder",
    "AI resume",
    "ATS resume",
    "resume review",
    "resume score",
    "job application",
  ],
  authors: [{ name: "RESUFII" }],
  creator: "RESUFII",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "RESUFII — AI Resume Builder",
    description:
      "Build ATS-optimized resumes with AI. Get scored and land more interviews.",
    siteName: "RESUFII",
  },
  twitter: {
    card: "summary_large_image",
    title: "RESUFII — AI Resume Builder",
    description:
      "Build ATS-optimized resumes with AI. Get scored and land more interviews.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#080d14",
  width: "device-width",
  initialScale: 1,
};

// ─── Root Layout ──────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Auth state is available everywhere in the app */}
        <AuthProvider>
          {children}

          {/* Toast notifications — positioned top-right, dark theme */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
              },
              classNames: {
                success: "toast-success",
                error: "toast-error",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}