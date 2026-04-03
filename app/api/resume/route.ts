// app/api/resume/route.ts

import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { CreateResumeSchema } from "@/lib/schemas";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    const body   = await request.json();
    const parsed = CreateResumeSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[POST /api/resume] Validation failed:", JSON.stringify(parsed.error.flatten(), null, 2));
      return NextResponse.json(
        { error: "Invalid resume data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const resumeId = uuidv4();
    const now      = new Date();

    const resumeData = {
      id:              resumeId,
      userId:          uid,
      ...parsed.data,
      lastReviewScore: null,
      createdAt:       now,
      updatedAt:       now,
    };

    const adminDb = getAdminDb();
    await adminDb.collection("resumes").doc(resumeId).set(resumeData);

    // Use set+merge so it works even if user doc doesn't exist yet
    await adminDb.collection("users").doc(uid).set(
      {
        uid,
        email:       decoded.email   ?? "",
        displayName: decoded.name    ?? "",
        photoURL:    decoded.picture ?? null,
        resumeIds:   FieldValue.arrayUnion(resumeId),
        isPremium:   false,
        subscription: {
          status: "inactive", plan: null,
          dodoCustomerId: null, dodoPaymentId: null,
          purchasedAt: null, transactionHistory: [],
        },
      },
      { merge: true }
    );

    return NextResponse.json({ id: resumeId }, { status: 201 });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/resume]", error.message, error.stack);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    let snap;

    try {
      // This requires a composite index: userId ASC + updatedAt DESC
      // Firebase Console → Firestore → Indexes → Add index
      // Collection: resumes | userId ASC | updatedAt DESC
      const adminDb = getAdminDb();
      snap = await adminDb
        .collection("resumes")
        .where("userId", "==", uid)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();

    } catch (indexErr) {
      const msg = (indexErr as Error).message ?? "";

      if (msg.includes("index") || msg.includes("Index")) {
        // Index not built yet — fall back to unordered query
        console.warn(
          "[GET /api/resume] Composite index not ready.\n" +
          "Fix: Firebase Console → Firestore → Indexes → Add index\n" +
          "Collection: resumes | userId ASC | updatedAt DESC"
        );
        const adminDb = getAdminDb();
        snap = await adminDb
          .collection("resumes")
          .where("userId", "==", uid)
          .limit(50)
          .get();
      } else {
        throw indexErr;
      }
    }

    const resumes = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id:              data.id,
        title:           data.title,
        template:        data.template,
        updatedAt:       data.updatedAt,
        createdAt:       data.createdAt,
        lastReviewScore: data.lastReviewScore,
      };
    });

    return NextResponse.json({ resumes });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/resume]", error.message, error.stack);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}