"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role, StockOrderStatus, StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/session";
import { parseEurosToCents } from "@/lib/format";
import { saveUploadedFile, type StoredFile } from "@/lib/uploads";

function errorUrl(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}

function successUrl(path: string, message: string): string {
  return `${path}?success=${encodeURIComponent(message)}`;
}

/** Dépôt d'une demande de matériel — tout utilisateur connecté. */
export async function createStockRequest(formData: FormData): Promise<void> {
  const user = await requireUser();

  const itemName = String(formData.get("itemName") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const urgent = formData.get("urgent") === "on";

  if (!itemName) {
    redirect(errorUrl("/stock", "Veuillez indiquer l'article demandé."));
  }
  const quantity = quantityRaw === "" ? 1 : Number.parseInt(quantityRaw, 10);
  if (!Number.isInteger(quantity) || quantity < 1) {
    redirect(errorUrl("/stock", "La quantité doit être un nombre entier supérieur ou égal à 1."));
  }

  await prisma.stockRequest.create({
    data: {
      requesterId: user.id,
      itemName,
      quantity,
      details: details || null,
      urgent,
    },
  });

  revalidatePath("/stock");
  redirect(successUrl("/stock", "Votre demande a bien été enregistrée."));
}

/** Annulation d'une demande encore « À commander » — demandeur, assistante ou admin. */
export async function cancelRequest(requestId: string, _formData: FormData): Promise<void> {
  const user = await requireUser();

  const request = await prisma.stockRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    redirect(errorUrl("/stock", "Demande introuvable."));
  }
  if (request.requesterId !== user.id && !hasRole(user, Role.ASSISTANTE)) {
    redirect(errorUrl("/stock", "Vous ne pouvez annuler que vos propres demandes."));
  }
  if (request.status !== StockRequestStatus.A_COMMANDER) {
    redirect(errorUrl("/stock", "Cette demande ne peut plus être annulée."));
  }

  await prisma.stockRequest.updateMany({
    where: { id: requestId, status: StockRequestStatus.A_COMMANDER },
    data: { status: StockRequestStatus.ANNULEE },
  });

  revalidatePath("/stock");
  redirect(successUrl("/stock", "La demande a été annulée."));
}

/** Création d'une commande à partir des demandes cochées — assistante ou admin. */
export async function createOrder(formData: FormData): Promise<void> {
  const user = await requireUser(Role.ASSISTANTE);

  const requestIds = [
    ...new Set(
      formData
        .getAll("requestIds")
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    ),
  ];
  const supplier = String(formData.get("supplier") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();

  if (requestIds.length === 0) {
    redirect(errorUrl("/stock", "Veuillez cocher au moins une demande à commander."));
  }

  const created = await prisma.$transaction(async (tx) => {
    const pending = await tx.stockRequest.findMany({
      where: { id: { in: requestIds }, status: StockRequestStatus.A_COMMANDER },
      select: { id: true },
    });
    if (pending.length !== requestIds.length) return null;

    const order = await tx.stockOrder.create({
      data: {
        supplier: supplier || null,
        reference: reference || null,
        status: StockOrderStatus.COMMANDEE,
        orderedById: user.id,
      },
    });
    await tx.stockRequest.updateMany({
      where: { id: { in: requestIds } },
      data: { status: StockRequestStatus.COMMANDEE, orderId: order.id },
    });
    return order;
  });

  if (!created) {
    redirect(
      errorUrl(
        "/stock",
        "Certaines demandes sélectionnées ne sont plus à commander. Veuillez actualiser la page et réessayer."
      )
    );
  }

  revalidatePath("/stock");
  redirect(
    successUrl(
      "/stock",
      `La commande a été créée (${requestIds.length} demande${requestIds.length > 1 ? "s" : ""}).`
    )
  );
}

/** Réception d'une commande : devis, montant, notes — assistante ou admin. */
export async function receiveOrder(orderId: string, formData: FormData): Promise<void> {
  await requireUser(Role.ASSISTANTE);
  const detailPath = `/stock/commandes/${orderId}`;

  const order = await prisma.stockOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    redirect(errorUrl("/stock", "Commande introuvable."));
  }
  if (order.status !== StockOrderStatus.COMMANDEE) {
    redirect(errorUrl(detailPath, "Cette commande a déjà été réceptionnée."));
  }

  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amountCents: number | null = null;
  if (amountRaw !== "") {
    const parsed = parseEurosToCents(amountRaw);
    if (parsed === null) {
      redirect(errorUrl(detailPath, "Montant invalide. Utilisez le format « 123,45 »."));
    }
    amountCents = parsed;
  }

  const notes = String(formData.get("notes") ?? "").trim();

  // Un input file laissé vide arrive comme un File de taille 0 : on l'ignore.
  const fileEntry = formData.get("devis");
  let stored: StoredFile | null = null;
  let uploadError: string | null = null;
  if (fileEntry instanceof File && fileEntry.size > 0) {
    try {
      stored = await saveUploadedFile(fileEntry, "devis");
    } catch (err) {
      uploadError =
        err instanceof Error ? err.message : "Impossible d'enregistrer le fichier du devis.";
    }
  }
  if (uploadError) {
    redirect(errorUrl(detailPath, uploadError));
  }

  await prisma.$transaction([
    prisma.stockOrder.update({
      where: { id: orderId },
      data: {
        status: StockOrderStatus.RECUE_A_PAYER,
        receivedAt: new Date(),
        amountCents,
        notes: notes || null,
        ...(stored ? { devisFileName: stored.fileName, devisPath: stored.storedPath } : {}),
      },
    }),
    prisma.stockRequest.updateMany({
      where: { orderId },
      data: { status: StockRequestStatus.RECUE },
    }),
  ]);

  revalidatePath("/stock");
  revalidatePath(detailPath);
  redirect(successUrl(detailPath, "La commande a été réceptionnée. Elle est en attente de paiement."));
}

/** Passage d'une commande « Reçue — à payer » à « Payée » — assistante ou admin. */
export async function markOrderPaid(orderId: string, _formData: FormData): Promise<void> {
  await requireUser(Role.ASSISTANTE);

  const order = await prisma.stockOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    redirect(errorUrl("/stock", "Commande introuvable."));
  }
  if (order.status !== StockOrderStatus.RECUE_A_PAYER) {
    redirect(
      errorUrl("/stock", "Seule une commande « Reçue — à payer » peut être marquée comme payée.")
    );
  }

  await prisma.stockOrder.update({
    where: { id: orderId },
    data: { status: StockOrderStatus.PAYEE, paidAt: new Date() },
  });

  revalidatePath("/stock");
  revalidatePath(`/stock/commandes/${orderId}`);
  redirect(successUrl("/stock", "La commande a été marquée comme payée."));
}
