// app/api/ai/review-resume/route.ts

import { NextResponse }                    from "next/server";
import { verifyAuthToken, getUserProfile } from "@/lib/firebase/auth";
import { reviewResume }                    from "@/lib/ai/openrouter";
import { ReviewRequestSchema }             from "@/lib/schemas";
import { checkRateLimit, reviewRateLimit } from "@/lib/ratelimit";
import { getAdminDb }                      from "@/lib/firebase/admin";
import { FieldValue }                      from "firebase-admin/firestore";
import type { ReviewSection, ReviewIssue } from "@/types";

// ─── All 8 required categories ────────────────────────────────
const ALL_CATEGORIES = [
  "ats_compatibility",
  "keywords",
  "quantified_impact",
  "skills",
  "action_verbs",
  "formatting",
  "summary",
  "length",
] as const;

type Category = typeof ALL_CATEGORIES[number];

const CATEGORY_LABELS: Record<Category, string> = {
  ats_compatibility: "ATS Compatibility",
  keywords:          "Keyword Density",
  quantified_impact: "Quantified Impact",
  skills:            "Skills Match",
  action_verbs:      "Action Verbs",
  formatting:        "Formatting",
  summary:           "Summary Quality",
  length:            "Length & Depth",
};

// Categories that require premium to see issues/details
const PREMIUM_CATEGORIES = new Set<Category>([
  "keywords",
  "ats_compatibility",
  "quantified_impact",
  "skills",
  "formatting",
  "summary",
]);

// ─── Ensure all 8 sections are always present ─────────────────
// If the AI dropped a category, inject a placeholder so the UI
// always renders a full 8-row breakdown.
function ensureAllSections(sections: ReviewSection[]): ReviewSection[] {
  // Deduplicate — keep last occurrence (mirrors openrouter.ts behaviour)
  const map = new Map<string, ReviewSection>();
  for (const s of sections) map.set(s.category, s);

  for (const cat of ALL_CATEGORIES) {
    if (!map.has(cat)) {
      console.warn(`[Review] Section "${cat}" missing from AI response — injecting placeholder.`);
      map.set(cat, {
        category:  cat,
        label:     CATEGORY_LABELS[cat],
        score:     50,           // neutral mid-range placeholder
        issues:    [{
          severity: "warning",
          message:  "Could not fully analyse this section",
          fix:      "Re-upload your resume to get a complete score for this category",
        }],
        isPremium: PREMIUM_CATEGORIES.has(cat),
      });
    }
  }

  // Return in canonical order so the UI always shows sections the same way
  return ALL_CATEGORIES.map(cat => map.get(cat)!);
}

export async function POST(request: Request) {
  try {
    // ── 1. Auth ─────────────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    // ── 2. Rate limit ────────────────────────────────────────
    await checkRateLimit(reviewRateLimit, `review:${uid}`);

    // ── 3. Validate input ────────────────────────────────────
    const body   = await request.json();
    const parsed = ReviewRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { resumeText } = parsed.data;

    // ── 4. Load user profile ─────────────────────────────────
    const profile         = await getUserProfile(uid);
    let   resumeUnlocks   = profile?.credits?.resumeUnlocks
      ?? (profile?.credits as unknown as Record<string, number>)?.builder
      ?? 0;
    if (resumeUnlocks === 0 && profile?.isPremium) resumeUnlocks = 1;
    const unlockedResumes = profile?.unlockedResumes ?? [];

    const resumeId         = request.headers.get("x-resume-id")          ?? (body.resumeId         as string | undefined) ?? null;
    const uploadedResumeId = request.headers.get("x-uploaded-resume-id") ?? (body.uploadedResumeId as string | undefined) ?? null;
    const targetDocId      = resumeId || uploadedResumeId;

    let isDocumentUnlocked = false;
    if (targetDocId && unlockedResumes.includes(targetDocId)) {
      isDocumentUnlocked = true;
    }

    console.info(`[Review] User ${uid} | resumeUnlocks: ${resumeUnlocks} | targetDocId: ${targetDocId} | isUnlocked: ${isDocumentUnlocked}`);

    // ── 5. Run AI review ─────────────────────────────────────
    const review = await reviewResume(resumeText);

    // ── 6. Guarantee all 8 sections are present ───────────────
    // This is the critical fix: regardless of what the AI returned,
    // always send back a complete 8-section array.
    const fullSections = ensureAllSections(review.sections);

    console.info(`[Review] Sections after guarantee: ${fullSections.length} (AI returned: ${review.sections.length})`);

    // ── 7. Gate response ──────────────────────────────────────
    const hasReviewAccess = isDocumentUnlocked || resumeUnlocks >= 1;

    const gatedSections = fullSections.map((section: ReviewSection) => {
      const isPremiumCat = PREMIUM_CATEGORIES.has(section.category as Category);

      if (!hasReviewAccess && isPremiumCat) {
        // Free users: show the section row + score, but gate issues
        return {
          category:  section.category,
          label:     section.label,
          score:     section.score,
          issues:    [] as ReviewIssue[],
          isPremium: true,
        };
      }

      return {
        ...section,
        isPremium: isPremiumCat,
      };
    });

    const gatedReview = {
      overallScore: review.overallScore,
      isPremium:    hasReviewAccess,
      sections:     gatedSections,
      topFixes: hasReviewAccess
        ? review.topFixes
        : review.topFixes.map(() => ({
            severity: "suggestion" as const,
            message:  "Upgrade to see this fix",
            fix:      "Unlock full report",
          })),
    };

    // ── 8. Unlock resume (transactional) ──────────────────────
    if (hasReviewAccess && !isDocumentUnlocked && targetDocId) {
      try {
        const adminDb = getAdminDb();
        const userRef = adminDb.collection("users").doc(uid);

        await adminDb.runTransaction(async (tx) => {
          const snap     = await tx.get(userRef);
          const snapData = snap.data() ?? {};

          const storedUnlocks: number = snapData?.credits?.resumeUnlocks
            ?? (snapData?.credits as Record<string, number>)?.builder
            ?? 0;
          const isPremiumUser    = snapData?.isPremium === true;
          const effectiveUnlocks = storedUnlocks === 0 && isPremiumUser ? 1 : storedUnlocks;

          const currentUnlockedResumes: string[] = snapData?.unlockedResumes ?? [];

          if (effectiveUnlocks < 1) throw new Error("NO_RESUME_UNLOCKS");
          if (currentUnlockedResumes.includes(targetDocId)) return;

          const updates: Record<string, unknown> = {
            unlockedResumes: FieldValue.arrayUnion(targetDocId),
          };
          if (storedUnlocks > 0) {
            updates["credits.resumeUnlocks"] = FieldValue.increment(-1);
          }
          tx.update(userRef, updates);
        });

        console.info(`[Review] ✓ Unlocked resume ${targetDocId} for user ${uid}`);
      } catch (txErr) {
        const txError = txErr as Error;
        if (txError.message === "NO_RESUME_UNLOCKS") throw txError;
        console.error("[Review] Transaction error (non-fatal):", txError);
      }
    }

    // ── 9. Update score on built resume ───────────────────────
    if (resumeId) {
      try {
        const adminDb   = getAdminDb();
        const resumeDoc = await adminDb.collection("resumes").doc(resumeId).get();
        if (resumeDoc.exists && resumeDoc.data()?.userId === uid) {
          await adminDb.collection("resumes").doc(resumeId).update({
            lastReviewScore: review.overallScore,
            updatedAt:       new Date(),
          });
        }
      } catch (resumeErr) {
        console.error("[Review] Failed to update resume score:", resumeErr);
      }
    }

    // ── 10. Update score on uploaded resume ───────────────────
    if (uploadedResumeId) {
      try {
        const adminDb     = getAdminDb();
        const uploadedDoc = await adminDb.collection("uploadedResumes").doc(uploadedResumeId).get();
        if (uploadedDoc.exists && uploadedDoc.data()?.userId === uid) {
          await adminDb.collection("uploadedResumes").doc(uploadedResumeId).update({
            lastReviewScore: review.overallScore,
          });
        }
      } catch (uploadErr) {
        console.error("[Review] Failed to update uploaded resume score:", uploadErr);
      }
    }

    return NextResponse.json(gatedReview);

  } catch (err) {
    console.error("[POST /api/ai/review-resume]", err);
    const error = err as Error;

    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (error.message === "RATE_LIMITED")
      return NextResponse.json(
        { error: "Too many review requests. Please wait before trying again." },
        { status: 429 }
      );

    if (error.message === "NO_RESUME_UNLOCKS")
      return NextResponse.json(
        { code: "PREMIUM_REQUIRED", error: "No unlock credits remaining. Purchase a plan to continue." },
        { status: 402 }
      );

    if (error.message?.startsWith("AI_SERVICE_ERROR"))
      return NextResponse.json(
        { error: "AI service temporarily unavailable. Try again in a moment.", details: error.message },
        { status: 503 }
      );

    if (error.message === "AI_PARSE_ERROR")
      return NextResponse.json(
        { error: "Could not parse resume. Please ensure the file is readable and try again." },
        { status: 422 }
      );

    return NextResponse.json(
      {
        error:   "Internal error",
        message: error.message,
        stack:   process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}