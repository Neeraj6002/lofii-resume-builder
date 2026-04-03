// services/ai.service.ts
// ============================================================
// AI SERVICE (CLIENT-SIDE)
// Helpers for calling AI generation and review API routes.
// Handles premium gate errors consistently.
// ============================================================

import type { AIContentType } from "@/types";

export class PremiumRequiredError extends Error {
  constructor() {
    super("PREMIUM_REQUIRED");
    this.name = "PremiumRequiredError";
  }
}

// ─── Generate resume content ──────────────────────────────────
export async function generateContent(
  type: AIContentType,
  context: Record<string, string>,
  getIdToken: () => Promise<string | null>,
  isPreview = false
): Promise<{ content: string; preview: boolean }> {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/ai/generate-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type,
      context: { ...context, __preview: isPreview ? "true" : "false" },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (data.code === "PREMIUM_REQUIRED") throw new PremiumRequiredError();
    if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment.");
    if (res.status === 503) throw new Error("AI service temporarily unavailable.");
    throw new Error(data.error ?? "Generation failed");
  }

  return {
    content: data.content as string,
    preview: !!data.preview,
  };
}

// ─── Review a resume ──────────────────────────────────────────
export async function reviewResume(
  resumeText: string,
  getIdToken: () => Promise<string | null>,
  resumeId?: string
): Promise<{
  overallScore:  number;
  sections:      unknown[];
  topFixes:      unknown[];
  isPremium:     boolean;
}> {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${token}`,
  };

  if (resumeId) headers["x-resume-id"] = resumeId;

  const res = await fetch("/api/ai/review-resume", {
    method: "POST",
    headers,
    body: JSON.stringify({ resumeText }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 429) throw new Error("Too many review requests. Please wait a few minutes.");
    if (res.status === 503) throw new Error("AI service temporarily unavailable.");
    throw new Error(data.error ?? "Review failed");
  }

  return data;
}