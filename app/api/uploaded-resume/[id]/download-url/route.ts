// app/api/uploaded-resume/[id]/download-url/route.ts

import { NextResponse }     from "next/server";
import { verifyAuthToken }  from "@/lib/firebase/auth";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("Authorization");
    const decoded    = await verifyAuthToken(authHeader);
    const uid        = decoded.uid;
    const { id }     = await params;

    const adminDb = getAdminDb();
    const docRef  = adminDb.collection("uploadedResumes").doc(id);
    const snap    = await docRef.get();

    if (!snap.exists)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = snap.data()!;

    if (data.userId !== uid)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const storage = getAdminStorage();
    const bucket  = storage.bucket();
    const file    = bucket.file(data.storagePath);

    const [fileBuffer] = await file.download();

    const contentType =
      data.fileType === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new NextResponse(new Uint8Array(fileBuffer), {  // ← convert Buffer → Uint8Array
      status: 200,
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `inline; filename="${data.fileName}"`,
        "Cache-Control":       "private, no-cache",
      },
    });

  } catch (err) {
    const error = err as Error;
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[GET /api/uploaded-resume/[id]/download-url]", error);
    return NextResponse.json({ error: "Could not retrieve file." }, { status: 500 });
  }
}