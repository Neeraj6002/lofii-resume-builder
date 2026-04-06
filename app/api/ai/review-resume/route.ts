// app/api/ai/review-resume/route.ts
// ============================================================
// RESUME REVIEW API
//
// Free users:  overallScore + first 2 sections visible, rest blurred
// Paid users:  full report, 1 review credit consumed
//
// Credit gate logic:
//   hasReviewCredit = isPremium === true AND credits.review >= 1
//   If hasReviewCredit → full report + deduct credit
//   Else              → gated report (score + 2 sections shown)
// ============================================================

import { NextResponse }                        from "next/server";
import { verifyAuthToken, getUserProfile }      from "@/lib/firebase/auth";
import { reviewResume }                        from "@/lib/ai/openrouter";
import { ReviewRequestSchema }                 from "@/lib/schemas";
import { checkRateLimit, reviewRateLimit }     from "@/lib/ratelimit";
import { getAdminDb }                          from "@/lib/firebase/admin";
import { FieldValue }                          from "firebase-admin/firestore";

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
    const profile       = await getUserProfile(uid);
    const isPremium     = profile?.isPremium     ?? false;
    const reviewCredits = profile?.credits?.review ?? 0;

    console.info(`[Review] User ${uid} | isPremium: ${isPremium} | credits.review: ${reviewCredits}`);

    // ── 5. Run AI review ─────────────────────────────────────
    // Always run the full review — gating is applied to the response,
    // not to whether the AI is called. This ensures consistent scoring.
    const review = await reviewResume(resumeText);

    // ── 6. Gate response ─────────────────────────────────────
    // Free / no credits: score + first 2 sections, fixes hidden
    // Has credit: full report
    const hasReviewCredit = isPremium && reviewCredits >= 1;

    const gatedReview = {
      overallScore: review.overallScore,
      isPremium:    hasReviewCredit,
      sections: review.sections.map((section, i) => {
        if (!hasReviewCredit && i >= 2) {
          return {
            category:  section.category,
            label:     section.label,
            score:     section.score,
            issues:    [],       // hidden
            isPremium: true,     // signals blur to frontend
          };
        }
        return { ...section, isPremium: i >= 2 };
      }),
      topFixes: hasReviewCredit
        ? review.topFixes
        : review.topFixes.map(() => ({
            severity: "suggestion" as const,
            message:  "Upgrade to Premium to see this fix",
            fix:      "Unlock full report",
          })),
    };

    // ── 7. Consume review credit (transactional) ─────────────
    if (hasReviewCredit) {
      const adminDb = getAdminDb();
      const userRef = adminDb.collection("users").doc(uid);

      await adminDb.runTransaction(async (tx) => {
        const snap          = await tx.get(userRef);
        const currentReview  = snap.data()?.credits?.review  ?? 0;
        const currentBuilder = snap.data()?.credits?.builder ?? 0;

        if (currentReview < 1) {
          // Race condition — credit consumed between our check and now
          throw new Error("NO_REVIEW_CREDITS");
        }

        const newReview     = currentReview - 1;
        const stillPremium  = newReview > 0 || currentBuilder > 0;

        tx.update(userRef, {
          "credits.review": FieldValue.increment(-1),
          isPremium:        stillPremium,
        });
      });

      console.info(`[Review] ✓ Consumed review credit for user ${uid}`);
    }

    // ── 8. Update resume score (if resumeId header present) ──
    const resumeId = request.headers.get("x-resume-id");
    if (resumeId) {
      const adminDb  = getAdminDb();
      const resumeDoc = await adminDb.collection("resumes").doc(resumeId).get();

      if (resumeDoc.exists && resumeDoc.data()?.userId === uid) {
        await adminDb.collection("resumes").doc(resumeId).update({
          lastReviewScore: review.overallScore,
          updatedAt:       new Date(),
        });
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

    if (error.message === "NO_REVIEW_CREDITS")
      return NextResponse.json(
        { code: "PREMIUM_REQUIRED", error: "No review credits remaining. Purchase a plan to continue." },
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