import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, isAdmin } from "@/lib/session";
import { readStoredFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  // Un administrateur peut tout télécharger ; un employé uniquement SES documents.
  if (!isAdmin(auth.user) && document.userId !== auth.user.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await readStoredFile(document.storedPath);
  } catch {
    return NextResponse.json(
      { error: "Le fichier est introuvable sur le serveur." },
      { status: 404 }
    );
  }

  const safeFileName =
    document.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "document";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
