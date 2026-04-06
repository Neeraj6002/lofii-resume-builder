// services/resume.service.ts
// ============================================================
// RESUME SERVICE
// Client-side helpers for all resume API calls.
// Centralises fetch logic so pages stay clean.
// ============================================================

import type { ResumeData } from "@/types";

async function authFetch(
  url: string,
  idToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(options.headers ?? {}),
    },
  });
}

// ─── List all resumes for the user ────────────────────────────
export async function listResumes(
  idToken: string
): Promise<Pick<ResumeData, "id" | "title" | "template" | "updatedAt" | "lastReviewScore">[]> {
  const res = await authFetch("/api/resume", idToken);
  if (!res.ok) throw new Error("Failed to fetch resumes");
  const data = await res.json();
  return data.resumes;
}

// ─── Get a single resume by ID ────────────────────────────────
export async function getResume(
  id: string,
  idToken: string
): Promise<ResumeData> {
  const res = await authFetch(`/api/resume/${id}`, idToken);
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error("Failed to fetch resume");
  const data = await res.json();
  return data.resume;
}

// ─── Create a new resume ──────────────────────────────────────
export async function createResume(
  payload: Omit<ResumeData, "id" | "userId" | "createdAt" | "updatedAt" | "lastReviewScore">,
  idToken: string
): Promise<{ id: string }> {
  const res = await authFetch("/api/resume", idToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to create resume");
  }
  return res.json();
}

// ─── Update an existing resume ────────────────────────────────
export async function updateResume(
  id: string,
  payload: Partial<Omit<ResumeData, "id" | "userId" | "createdAt">>,
  idToken: string
): Promise<void> {
  const res = await authFetch(`/api/resume/${id}`, idToken, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to update resume");
  }
}

// ─── Delete a resume ──────────────────────────────────────────
export async function deleteResume(
  id: string,
  idToken: string
): Promise<void> {
  const res = await authFetch(`/api/resume/${id}`, idToken, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete resume");
}