// app/api/uploaded-resume/route.ts
// ============================================================
// LIST UPLOADED RESUMES
// Returns all uploadedResumes docs belonging to the authed user.
// ============================================================

import { NextResponse }    from "next/server";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { getAdminDb }      from "@/lib/firebase/admin";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;

    const adminDb = getAdminDb();

    // Try ordered query first; fall back if composite index doesn't exist yet
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await adminDb
        .collection("uploadedResumes")
        .where("userId", "==", uid)
        .orderBy("uploadedAt", "desc")
        .get();
    } catch (indexErr) {
      const msg = (indexErr as Error).message ?? "";
      if (
        msg.includes("index") ||
        msg.includes("FAILED_PRECONDITION") ||
        msg.includes("requires an index")
      ) {
        console.warn(
          "[GET /api/uploaded-resume] Composite index missing — using unordered fallback. " +
          "Deploy the index: firebase deploy --only firestore:indexes"
        );
        snap = await adminDb
          .collection("uploadedResumes")
          .where("userId", "==", uid)
          .get();
      } else {
        throw indexErr;
      }
    }

    const uploadedResumes = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id:              doc.id,
        userId:          data.userId,
        fileName:        data.fileName,
        storagePath:     data.storagePath,
        fileType:        data.fileType,
        uploadedAt:      data.uploadedAt,
        lastReviewScore: data.lastReviewScore ?? null,
      };
    });

    return NextResponse.json({ uploadedResumes });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[GET /api/uploaded-resume]", error);
    return NextResponse.json({ error: "Failed to fetch uploaded resumes" }, { status: 500 });
  }
}