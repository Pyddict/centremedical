import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiUser, isAdmin } from "@/lib/session";
import { formatDateFr, formatDateLongFr, toDateOnlyString } from "@/lib/dates";
import { formatDays, fullName } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Nettoie une chaîne pour l'encodage WinAnsi des polices standard de pdf-lib :
 * espaces insécables → espaces, guillemets/tirets typographiques → équivalents
 * simples, puis suppression de tout caractère hors Latin-1 (+ œ Œ €).
 */
function pdfText(text: string): string {
  return text
    .replace(/[\u00a0\u202f\u2009]/g, " ") // espaces insécables / fines
    .replace(/[\u2018\u2019\u02bc]/g, "'") // apostrophes typographiques
    .replace(/[\u201c\u201d]/g, '"') // guillemets doubles typographiques
    .replace(/[\u2013\u2014]/g, "-") // tirets demi-cadratin / cadratin
    .replace(/\u2026/g, "...") // points de suspension
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e\u00a1-\u00ff\u0152\u0153\u20ac]/g, "")
    .trim();
}

/** Découpe un texte en lignes tenant dans maxWidth (coupure aux espaces). */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (current.length === 0 || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Nom de fichier sans accents ni caractères spéciaux. */
function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug.length > 0 ? slug : "employe";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getApiUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { requester: true, decidedBy: true },
  });

  if (!leave) {
    return NextResponse.json({ error: "Demande de congés introuvable" }, { status: 404 });
  }
  if (!isAdmin(user) && leave.requesterId !== user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (leave.status !== LeaveStatus.VALIDEE) {
    return NextResponse.json(
      { error: "Seul un congé validé peut générer un bon" },
      { status: 400 }
    );
  }

  const centerName = process.env.CENTER_NAME || "Centre Médical";
  const reference = leave.id.slice(0, 8).toUpperCase();
  const issuedOn = formatDateFr(new Date());

  // ----- Génération du PDF (A4, marges 50) -----
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Bon de congés validés - ${fullName(leave.requester)}`);
  const page = pdf.addPage([595.28, 841.89]);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const gray = rgb(0.45, 0.45, 0.45);
  const black = rgb(0.08, 0.1, 0.13);
  const teal = rgb(0.04, 0.37, 0.4);
  const lightRule = rgb(0.85, 0.88, 0.9);

  const margin = 50;
  const width = page.getWidth();
  const labelX = margin;
  const valueX = margin + 150;
  const valueWidth = width - margin - valueX;
  let y = page.getHeight() - margin;

  const rule = (yy: number, color = lightRule, thickness = 1) => {
    page.drawLine({
      start: { x: margin, y: yy },
      end: { x: width - margin, y: yy },
      thickness,
      color,
    });
  };

  const sectionTitle = (title: string) => {
    y -= 10;
    page.drawText(pdfText(title.toUpperCase()), {
      x: margin,
      y,
      size: 10,
      font: bold,
      color: gray,
    });
    y -= 7;
    rule(y);
    y -= 20;
  };

  const row = (
    label: string,
    value: string,
    options?: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> }
  ) => {
    const size = options?.size ?? 11;
    const font = options?.font ?? helvetica;
    const color = options?.color ?? black;
    page.drawText(pdfText(label), { x: labelX, y, size: 9.5, font: helvetica, color: gray });
    let lines = wrapText(pdfText(value), font, size, valueWidth);
    if (lines.length === 0) lines = ["-"];
    // Garde-fou : un texte très long ne doit pas déborder sur les signatures.
    if (lines.length > 6) {
      lines = lines.slice(0, 6);
      lines[5] = `${lines[5]}...`;
    }
    for (const line of lines) {
      page.drawText(line, { x: valueX, y, size, font, color });
      y -= size + 6;
    }
    y -= 4;
  };

  // En-tête
  page.drawText(pdfText(centerName), { x: margin, y, size: 20, font: bold, color: teal });
  y -= 28;
  page.drawText("BON DE CONGÉS VALIDÉS", { x: margin, y, size: 14, font: bold, color: black });
  y -= 18;
  page.drawText(pdfText(`Référence : ${reference}  ·  Émis le ${issuedOn}`), {
    x: margin,
    y,
    size: 9.5,
    font: helvetica,
    color: gray,
  });
  y -= 12;
  rule(y, teal, 1.5);
  y -= 26;

  // Bloc employé
  sectionTitle("Employé");
  row("Nom", fullName(leave.requester), { font: bold });
  row("Email", leave.requester.email);
  if (leave.requester.jobTitle) {
    row("Poste", leave.requester.jobTitle);
  }
  y -= 8;

  // Bloc congés
  sectionTitle("Congés");
  row("Du", formatDateLongFr(leave.startDate));
  row("Au", formatDateLongFr(leave.endDate));
  row("Jours décomptés", formatDays(leave.daysCount), { size: 16, font: bold });
  if (leave.reason) {
    row("Motif", leave.reason);
  }
  y -= 8;

  // Bloc validation
  sectionTitle("Validation");
  row("Validé par", leave.decidedBy ? fullName(leave.decidedBy) : "-", { font: bold });
  row("Le", leave.decidedAt ? formatDateFr(leave.decidedAt) : "-");
  if (leave.decisionComment) {
    row("Commentaire", leave.decisionComment);
  }

  // Signatures (positions fixes en bas de page)
  const signLineY = 150;
  const signWidth = 200;
  page.drawLine({
    start: { x: margin, y: signLineY },
    end: { x: margin + signWidth, y: signLineY },
    thickness: 1,
    color: gray,
  });
  page.drawLine({
    start: { x: width - margin - signWidth, y: signLineY },
    end: { x: width - margin, y: signLineY },
    thickness: 1,
    color: gray,
  });
  page.drawText(pdfText("Signature de l'employé"), {
    x: margin,
    y: signLineY - 14,
    size: 9,
    font: helvetica,
    color: gray,
  });
  const directionLabel = "Signature de la direction";
  page.drawText(pdfText(directionLabel), {
    x: width - margin - signWidth,
    y: signLineY - 14,
    size: 9,
    font: helvetica,
    color: gray,
  });

  // Pied de page
  rule(90);
  const mention = "Document établi à destination du service de paie.";
  page.drawText(pdfText(mention), {
    x: (width - helvetica.widthOfTextAtSize(pdfText(mention), 9)) / 2,
    y: 74,
    size: 9,
    font: helvetica,
    color: gray,
  });
  const generated = `Généré le ${issuedOn}`;
  page.drawText(pdfText(generated), {
    x: (width - helvetica.widthOfTextAtSize(pdfText(generated), 8)) / 2,
    y: 60,
    size: 8,
    font: helvetica,
    color: gray,
  });

  const bytes = await pdf.save();
  const filename = `bon-conges-${slugify(fullName(leave.requester))}-${toDateOnlyString(
    leave.startDate
  )}.pdf`;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
