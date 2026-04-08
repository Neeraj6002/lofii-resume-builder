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
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;
    const { id }     = params;

    const adminDb  = getAdminDb();
    const docRef   = adminDb.collection("uploadedResumes").doc(id);
    const snap     = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.userId !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from Firebase Storage
    try {
      const storage = getAdminStorage();
      const bucket  = storage.bucket();
      await bucket.file(data.storagePath).delete();
    } catch {
      // File may already be gone — continue with Firestore delete
      console.warn(`[DELETE uploaded-resume] Storage file not found: ${data.storagePath}`);
    }

    // Delete Firestore doc
    await docRef.delete();

    return NextResponse.json({ success: true });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[DELETE /api/uploaded-resume/[id]]", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}