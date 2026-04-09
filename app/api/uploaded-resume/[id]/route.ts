// app/api/uploaded-resume/[id]/route.ts
// ============================================================
// DELETE UPLOADED RESUME
// Deletes the Firestore doc and the Firebase Storage file.
// Only the owner can delete.
// ============================================================

import { NextResponse }     from "next/server";
import { verifyAuthToken }  from "@/lib/firebase/auth";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;
    const { id }     = await params;

    console.log(`[DELETE uploaded-resume] uid=${uid} id=${id}`);

    const adminDb  = getAdminDb();
    const docRef   = adminDb.collection("uploadedResumes").doc(id);
    const snap     = await docRef.get();

    if (!snap.exists) {
      console.warn(`[DELETE uploaded-resume] Doc not found: ${id}`);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = snap.data()!;
    console.log(`[DELETE uploaded-resume] storagePath=${data.storagePath} owner=${data.userId}`);

    if (data.userId !== uid) {
      console.warn(`[DELETE uploaded-resume] Forbidden: owner=${data.userId} requester=${uid}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from Firebase Storage
    try {
      const storage = getAdminStorage();
      const bucket  = storage.bucket();
      console.log(`[DELETE uploaded-resume] Deleting from bucket: ${bucket.name} path: ${data.storagePath}`);
      await bucket.file(data.storagePath).delete();
      console.log(`[DELETE uploaded-resume] Storage file deleted OK`);
    } catch (storageErr) {
      // Log full error but continue — file may already be gone
      console.error(`[DELETE uploaded-resume] Storage delete failed:`, storageErr);
    }

    // Delete Firestore doc
    await docRef.delete();
    console.log(`[DELETE uploaded-resume] Firestore doc deleted OK`);

    return NextResponse.json({ success: true });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[DELETE /api/uploaded-resume/[id]] FULL ERROR:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}