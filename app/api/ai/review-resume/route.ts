// app/api/ai/review-resume/route.ts

import { NextResponse }                    from "next/server";
import { verifyAuthToken, getUserProfile } from "@/lib/firebase/auth";
import { reviewResume }                    from "@/lib/ai/openrouter";
import { ReviewRequestSchema }             from "@/lib/schemas";
import { checkRateLimit, reviewRateLimit } from "@/lib/ratelimit";
import { getAdminDb }                      from "@/lib/firebase/admin";
import { FieldValue }                      from "firebase-admin/firestore";
import type { ReviewSection }              from "@/types";


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
    let resumeUnlocks = profile?.credits?.resumeUnlocks ?? (profile?.credits as any)?.builder ?? 0;
    if (resumeUnlocks === 0 && profile?.isPremium) resumeUnlocks = 1;
    const unlockedResumes = profile?.unlockedResumes ?? [];
    
    // Identify the resume being reviewed
    const resumeId = request.headers.get("x-resume-id");
    const uploadedResumeId = request.headers.get("x-uploaded-resume-id");
    const targetDocId = resumeId || uploadedResumeId;

    let isDocumentUnlocked = false;
    if (targetDocId && unlockedResumes.includes(targetDocId)) {
      isDocumentUnlocked = true;
    }

    console.info(`[Review] User ${uid} | resumeUnlocks: ${resumeUnlocks} | targetDocId: ${targetDocId} | isUnlocked: ${isDocumentUnlocked}`);

    // ── 5. Run AI review ─────────────────────────────────────
    const review = await reviewResume(resumeText);

    // ── 6. Gate response ─────────────────────────────────────
    let hasReviewAccess = isDocumentUnlocked || resumeUnlocks >= 1;

    const gatedReview = {
      overallScore: review.overallScore,
      isPremium:    hasReviewAccess,
      sections: review.sections.map((section: ReviewSection, i: number) => {
        if (!hasReviewAccess && i >= 2) {
          return {
            category:  section.category,
            label:     section.label,
            score:     section.score,
            issues:    [],
            isPremium: true,
          };
        }
        return { ...section, isPremium: i >= 2 };
      }),
      topFixes: hasReviewAccess
        ? review.topFixes
        : review.topFixes.map(() => ({
            severity: "suggestion" as const,
            message:  "Upgrade to Premium to see this fix",
            fix:      "Unlock full report",
          })),
    };

    // ── 7. Unlock Resume (transactional) ─────────────────────
    // If they have access but the doc isn't unlocked yet, unlock it!
    if (hasReviewAccess && !isDocumentUnlocked && targetDocId) {
      try {
        const adminDb = getAdminDb();
        const userRef = adminDb.collection("users").doc(uid);

        await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(userRef);
          let currentResumeUnlocks = snap.data()?.credits?.resumeUnlocks ?? (snap.data()?.credits as any)?.builder ?? 0;
          if (currentResumeUnlocks === 0 && snap.data()?.isPremium) currentResumeUnlocks = 1;
          const currentUnlockedResumes = snap.data()?.unlockedResumes ?? [];

          if (currentResumeUnlocks < 1) throw new Error("NO_RESUME_UNLOCKS");
          if (currentUnlockedResumes.includes(targetDocId)) return;

          tx.update(userRef, {
            "credits.resumeUnlocks": FieldValue.increment(-1),
            unlockedResumes: FieldValue.arrayUnion(targetDocId),
          });
        });

        console.info(`[Review] ✓ Unlocked resume ${targetDocId} for user ${uid}`);
      } catch (txErr) {
        const txError = txErr as Error;
        if (txError.message === "NO_RESUME_UNLOCKS") throw txError;
        console.error("[Review] Transaction error (non-fatal):", txError);
      }
    }

    // ── 8. Update score on built resume (if x-resume-id header) ──
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

    // ── 9. Update score on uploaded resume (if x-uploaded-resume-id header) ──
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