// app/api/ai/review-resume/route.ts
// ============================================================
// RESUME REVIEW API
// Accepts plain resume text, runs AI review via OpenRouter.
// Free users: get overall score + 2 sections only.
// Premium users: full breakdown + all fixes.
// ============================================================

import { NextResponse } from "next/server";
import { verifyAuthToken, getUserProfile } from "@/lib/firebase/auth";
import { reviewResume } from "@/lib/ai/openrouter";
import { ReviewRequestSchema } from "@/lib/schemas";
import { checkRateLimit, reviewRateLimit } from "@/lib/ratelimit";
import { getAdminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    // ── 1. Verify auth ──────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const decoded = await verifyAuthToken(authHeader);
    const uid = decoded.uid;

    // ── 2. Rate limit (per user) ────────────────────────────
    await checkRateLimit(reviewRateLimit, `review:${uid}`);

    // ── 3. Validate input ───────────────────────────────────
    const body = await request.json();
    const parsed = ReviewRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { resumeText } = parsed.data;

    // ── 4. Check premium status ─────────────────────────────
    const profile = await getUserProfile(uid);
    const isPremium = profile?.isPremium ?? false;

    // ── 5. Run AI review ────────────────────────────────────
    console.log(`[Review] Starting review for user ${uid}, resume length: ${resumeText.length}`);
    const review = await reviewResume(resumeText);
    console.log(`[Review] Completed review for user ${uid}`);

    // ── 6. Apply premium gate ───────────────────────────────
    // Free users: only see overall score + first 2 sections (blurred details)
    // Premium users: full access to all sections and fixes
    const gatedReview = {
      overallScore: review.overallScore,
      sections: review.sections.map((section, i) => {
        if (!isPremium && i >= 2) {
          // Return section metadata but hide the actionable details
          return {
            category: section.category,
            label: section.label,
            score: section.score,
            issues: [], // Hidden for free users
            isPremium: true,
          };
        }
        return { ...section, isPremium: i >= 2 };
      }),
      // Free users see top fixes count but not the actual fixes
      topFixes: isPremium
        ? review.topFixes
        : review.topFixes.map((fix) => ({
            severity: fix.severity,
            message: "Upgrade to Premium to see this fix",
            fix: "Unlock full report",
          })),
      isPremium,
    };

    // ── 7. Store review score on resume (if resumeId provided) ─
    const resumeId = request.headers.get("x-resume-id");
    if (resumeId) {
      // Verify ownership before updating
      const adminDb = getAdminDb();
      const resumeDoc = await adminDb.collection("resumes").doc(resumeId).get();
      if (resumeDoc.exists && resumeDoc.data()?.userId === uid) {
        await adminDb.collection("resumes").doc(resumeId).update({
          lastReviewScore: review.overallScore,
          updatedAt: new Date(),
        });
      }
    }

    return NextResponse.json(gatedReview);
  } catch (err) {
    console.error("[POST /api/ai/review-resume] ERROR:", err);
    const error = err as Error;

    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (error.message === "RATE_LIMITED")
      return NextResponse.json(
        { error: "Too many review requests. Please wait before trying again." },
        { status: 429 }
      );

    if (error.message.startsWith("AI_SERVICE_ERROR"))
      return NextResponse.json(
        { error: "AI service temporarily unavailable. Try again in a moment.", details: error.message },
        { status: 503 }
      );

    if (error.message === "AI_PARSE_ERROR")
      return NextResponse.json(
        { error: "Could not parse resume. Please ensure the file is readable and try again. If the problem persists, your resume might be in an unsupported format." },
        { status: 422 }
      );

    // Return detailed error in development
    const errorResponse = {
      error: "Internal error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}