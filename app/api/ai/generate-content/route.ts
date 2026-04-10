// app/api/ai/generate-content/route.ts
// ============================================================
// CONTENT GENERATION API
//
// Free users:  one free preview per section type (generateFreePreview)
// Paid users:  full generation, 1 builder credit consumed
//
// Credit gate logic:
//   isPreview=true  + not premium → free preview (once per type)
//   isPreview=false + no credit   → 402 PREMIUM_REQUIRED
//   isPreview=false + has credit  → full generation + deduct credit
// ============================================================

import { NextResponse }                          from "next/server";
import { verifyAuthToken, getUserProfile }        from "@/lib/firebase/auth";
import { generateResumeContent, generateFreePreview } from "@/lib/ai/openrouter";
import { AIGenerateSchema }                      from "@/lib/schemas";
import { checkRateLimit, aiRateLimit }           from "@/lib/ratelimit";
import { getAdminDb }                            from "@/lib/firebase/admin";
import { FieldValue }                            from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    // ── 1. Auth ─────────────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    // ── 2. Validate input ────────────────────────────────────
    const body   = await request.json();
    const parsed = AIGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { type, context: rawContext } = parsed.data;

    // Normalise context values to strings
    const context: Record<string, string> = Object.fromEntries(
      Object.entries(rawContext).map(([k, v]) => [k, typeof v === "string" ? v : String(v ?? "")])
    );

    // Reject absurdly large context objects
    const specialKeys  = ["__preview"];
    const regularKeys  = Object.keys(context).filter(k => !specialKeys.includes(k));
    if (regularKeys.length > 20) {
      return NextResponse.json(
        { error: "Too many context fields (max 20)" },
        { status: 400 }
      );
    }

    const isPreview = context.__preview === "true";

    // ── 3. Load user profile ─────────────────────────────────
    const profile        = await getUserProfile(uid);
    let resumeUnlocks  = profile?.credits?.resumeUnlocks ?? (profile?.credits as any)?.builder ?? 0;
    if (resumeUnlocks === 0 && profile?.isPremium) resumeUnlocks = 1;
    const unlockedResumes = profile?.unlockedResumes ?? [];
    const isDocumentUnlocked = context.resumeId ? unlockedResumes.includes(context.resumeId) : false;

    console.info(`[Generate] User ${uid} | type: ${type} | resumeUnlocks: ${resumeUnlocks} | isPreview: ${isPreview} | targetDocId: ${context.resumeId} | isUnlocked: ${isDocumentUnlocked}`);

    // ── 4. Free preview path ─────────────────────────────────
    // Non-unlocked users get one free preview per section type.
    // Preview flag must be explicitly set by the client.
    if (isPreview && !isDocumentUnlocked) {
      const adminDb         = getAdminDb();
      const userDoc         = await adminDb.collection("users").doc(uid).get();
      const freePreviewsUsed = userDoc.data()?.freePreviewsUsed ?? {};

      if (freePreviewsUsed[type]) {
        return NextResponse.json(
          {
            code:  "PREMIUM_REQUIRED",
            error: "You've used your free preview for this section. Upgrade to Premium for full generations.",
          },
          { status: 402 }
        );
      }

      const role    = context.role    || context.name        || "this position";
      const company = context.company || context.institution || "organization";

      const content = await generateFreePreview(role, company);

      await adminDb.collection("users").doc(uid).update({
        freePreviewsUsed: { ...freePreviewsUsed, [type]: true },
      });

      console.info(`[Generate] ✓ Free preview served for user ${uid}, type: ${type}`);
      return NextResponse.json({ content, preview: true, tokensUsed: 0 });
    }

    // ── 5. Credit gate ───────────────────────────────────────
    let hasBuilderAccess = isDocumentUnlocked || resumeUnlocks >= 1;

    if (!hasBuilderAccess) {
      console.info(`[Generate] Blocked — no resume unlock credit | uid: ${uid} | credits: ${resumeUnlocks}`);
      return NextResponse.json(
        {
          code:  "PREMIUM_REQUIRED",
          error: "Content generation requires a resume unlock credit. Purchase a plan to unlock this resume.",
        },
        { status: 402 }
      );
    }

    // ── 6. Rate limit (paid users only) ─────────────────────
    await checkRateLimit(aiRateLimit, `generate:${uid}`);

    // ── 7. Run AI generation ─────────────────────────────────
    const { content, tokens } = await generateResumeContent(type, context);
    console.info(`[Generate] ✓ Generated for user ${uid} | type: ${type} | tokens: ${tokens}`);

    // ── 8. Consume unlock credit (transactional) if needed ────────────
    const adminDb = getAdminDb();
    const userRef = adminDb.collection("users").doc(uid);

    await adminDb.runTransaction(async (tx) => {
      const snap           = await tx.get(userRef);
      let currentUnlocks = snap.data()?.credits?.resumeUnlocks ?? (snap.data()?.credits as any)?.builder ?? 0;
      if (currentUnlocks === 0 && snap.data()?.isPremium) currentUnlocks = 1;
      const currentTokens  = snap.data()?.totalTokensUsed  ?? 0;
      const currentUnlockedResumes = snap.data()?.unlockedResumes ?? [];

      const docIdToUnlock = context.resumeId;

      if (!isDocumentUnlocked && docIdToUnlock && !currentUnlockedResumes.includes(docIdToUnlock)) {
        if (currentUnlocks < 1) {
          throw new Error("NO_RESUME_UNLOCKS");
        }
        tx.update(userRef, {
          "credits.resumeUnlocks": FieldValue.increment(-1),
          totalTokensUsed:   currentTokens + tokens,
          lastGenerationAt:  new Date(),
          unlockedResumes: FieldValue.arrayUnion(docIdToUnlock),
        });
        console.info(`[Generate] ✓ Unlocked resume ${docIdToUnlock} and consumed unlock credit for user ${uid}`);
      } else {
        tx.update(userRef, {
          totalTokensUsed:   currentTokens + tokens,
          lastGenerationAt:  new Date(),
        });
      }
    });

    return NextResponse.json({ content, preview: false, tokensUsed: tokens });

  } catch (err) {
    console.error("[POST /api/ai/generate-content]", err);
    const error = err as Error;

    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (error.message === "RATE_LIMITED")
      return NextResponse.json(
        { error: "Too many generation requests. Please wait before trying again." },
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
        { error: "Could not generate content. Please try again." },
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