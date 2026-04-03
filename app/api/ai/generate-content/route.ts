// app/api/ai/generate-content/route.ts
// ============================================================
// CONTENT GENERATION API
// Handles AI-powered resume section generation.
// Free users: one free preview per section type
// Premium users: unlimited generation
// ============================================================

import { NextResponse } from "next/server";
import { verifyAuthToken, getUserProfile } from "@/lib/firebase/auth";
import { generateResumeContent, generateFreePreview } from "@/lib/ai/openrouter";
import { AIGenerateSchema } from "@/lib/schemas";
import { checkRateLimit, aiRateLimit } from "@/lib/ratelimit";
import { getAdminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    // ── 1. Verify auth ──────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const decoded = await verifyAuthToken(authHeader);
    const uid = decoded.uid;

    // ── 2. Validate input ───────────────────────────────────
    const body = await request.json();
    const parsed = AIGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { type, context: rawContext } = parsed.data;

    // Ensure all context values are strings (Zod should handle this, but be safe)
    const context: Record<string, string> = Object.fromEntries(
      Object.entries(rawContext).map(([k, v]) => [
        k,
        typeof v === "string" ? v : String(v ?? ""),
      ])
    );

    // Manual validation for field count (refine was causing Zod internal error)
    const specialKeys = ["__preview"];
    const regularKeys = Object.keys(context).filter(k => !specialKeys.includes(k));
    if (regularKeys.length > 20) {
      return NextResponse.json(
        { error: "Too many context fields (max 20)" },
        { status: 400 }
      );
    }

    const isPreview = context.__preview === "true";

    // ── 3. Check premium status ─────────────────────────────
    const profile = await getUserProfile(uid);
    const isPremium = profile?.isPremium ?? false;

    // ── 4. Handle free preview logic ────────────────────────
    if (isPreview && !isPremium) {
      // Free users get ONE free preview per type
      // Check if they've already used their free preview for this type
      const adminDb = getAdminDb();
      const userDoc = await adminDb.collection("users").doc(uid).get();
      const freePreviewsUsed = userDoc.data()?.freePreviewsUsed ?? {};

      if (freePreviewsUsed[type]) {
        // Already used free preview for this type
        return NextResponse.json(
          {
            code: "PREMIUM_REQUIRED",
            error: "You've used your free preview for this section. Upgrade to Premium for unlimited generations.",
          },
          { status: 402 } // 402 Payment Required
        );
      }

      // Generate free preview (single bullet point for experience, etc.)
      // Safely extract role and company with fallbacks
      const role: string = context.role || context.name || "this position";
      const company: string = context.company || context.institution || "organization";

      console.log(
        `[Generate] Free preview for user ${uid}, type: ${type}`
      );
      const content = await generateFreePreview(role, company);

      // Mark this preview as used
      await adminDb.collection("users").doc(uid).update({
        freePreviewsUsed: {
          ...freePreviewsUsed,
          [type]: true,
        },
      });

      return NextResponse.json({
        content,
        preview: true,
        tokensUsed: 0, // Free previews don't count toward quota
      });
    }

    // ── 5. Premium feature — require subscription ───────────
    if (!isPremium && !isPreview) {
      return NextResponse.json(
        {
          code: "PREMIUM_REQUIRED",
          error: "Content generation requires Premium. Upgrade to unlock unlimited generations.",
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // ── 6. Rate limit (premium users only) ──────────────────
    // Free preview doesn't count toward rate limit
    if (isPremium) {
      await checkRateLimit(aiRateLimit, `generate:${uid}`);
    }

    // ── 7. Run AI generation ────────────────────────────────
    console.log(`[Generate] Starting generation for user ${uid}, type: ${type}`);
    console.log(`[Generate] Context:`, context);
    const { content, tokens } = await generateResumeContent(type, context);
    console.log(
      `[Generate] Completed generation for user ${uid}, tokens used: ${tokens}`
    );

    // ── 8. Track token usage (premium feature) ──────────────
    if (isPremium) {
      const adminDb = getAdminDb();
      const userDoc = await adminDb.collection("users").doc(uid).get();
      const currentTokens = userDoc.data()?.totalTokensUsed ?? 0;

      await adminDb.collection("users").doc(uid).update({
        totalTokensUsed: currentTokens + tokens,
        lastGenerationAt: new Date(),
      });
    }

    return NextResponse.json({
      content,
      preview: false,
      tokensUsed: tokens,
    });
  } catch (err) {
    console.error("[POST /api/ai/generate-content] ERROR:", err);
    const error = err as Error;

    // ── Error handling ──────────────────────────────────────
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Too many generation requests. Please wait before trying again." },
        { status: 429 }
      );
    }

    if (error.message.startsWith("AI_SERVICE_ERROR")) {
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          error: "AI service temporarily unavailable. Try again in a moment.",
          details: error.message,
          ...(isDev && { stack: error.stack }),
        },
        { status: 503 }
      );
    }

    if (error.message === "AI_PARSE_ERROR") {
      return NextResponse.json(
        { error: "Could not generate content. Please try again." },
        { status: 422 }
      );
    }

    // Return detailed error in development
    const errorResponse = {
      error: "Internal error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}