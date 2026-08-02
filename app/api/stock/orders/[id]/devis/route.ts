import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/session";
import { readStoredFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";

function contentTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getApiUser(Role.ASSISTANTE);
  if (auth.response) return auth.response;

  const { id } = await params;
  const order = await prisma.stockOrder.findUnique({ where: { id } });
  if (!order || !order.devisPath) {
    return NextResponse.json(
      { error: "Devis introuvable pour cette commande." },
      { status: 404 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = await readStoredFile(order.devisPath);
  } catch {
    return NextResponse.json(
      { error: "Le fichier du devis est introuvable sur le serveur." },
      { status: 404 }
    );
  }

  const fileName = order.devisFileName || order.devisPath;
  const safeFileName =
    fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "devis";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentTypeFor(fileName),
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
