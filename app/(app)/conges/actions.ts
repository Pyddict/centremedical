"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeaveStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireUser } from "@/lib/session";
import { parseDateOnly } from "@/lib/dates";

/** Lit un champ texte d'un FormData (null si absent ou vide). */
function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(message: string): never {
  redirect("/conges?error=" + encodeURIComponent(message));
}

function succeed(message: string): never {
  revalidatePath("/conges");
  redirect("/conges?success=" + encodeURIComponent(message));
}

/** Création d'une demande de congés (tout utilisateur connecté). */
export async function createLeaveRequest(formData: FormData): Promise<void> {
  const user = await requireUser();

  const start = parseDateOnly(text(formData, "startDate"));
  const end = parseDateOnly(text(formData, "endDate"));
  if (!start || !end) {
    fail("Veuillez renseigner les dates de début et de fin.");
  }
  if (start.getTime() > end.getTime()) {
    fail("La date de début doit être antérieure ou égale à la date de fin.");
  }

  const daysRaw = text(formData, "daysCount");
  const days = daysRaw ? Number.parseFloat(daysRaw.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(days) || days < 0.5 || days > 366) {
    fail("Le nombre de jours doit être compris entre 0,5 et 366.");
  }

  await prisma.leaveRequest.create({
    data: {
      requesterId: user.id,
      startDate: start,
      endDate: end,
      daysCount: days,
      reason: text(formData, "reason"),
      status: LeaveStatus.EN_ATTENTE,
    },
  });

  succeed("Votre demande de congés a bien été envoyée.");
}

/** Annulation d'une demande en attente (propriétaire, ou administrateur). */
export async function cancelLeaveRequest(id: string, _formData: FormData): Promise<void> {
  const user = await requireUser();

  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) {
    fail("Demande introuvable.");
  }
  if (request.requesterId !== user.id && !isAdmin(user)) {
    fail("Vous ne pouvez annuler que vos propres demandes.");
  }
  if (request.status !== LeaveStatus.EN_ATTENTE) {
    fail("Seule une demande en attente peut être annulée.");
  }

  let updated = true;
  try {
    await prisma.leaveRequest.update({
      where: { id, status: LeaveStatus.EN_ATTENTE },
      data: { status: LeaveStatus.ANNULEE },
    });
  } catch {
    updated = false;
  }
  if (!updated) {
    fail("Cette demande a déjà été traitée et ne peut plus être annulée.");
  }

  succeed("La demande de congés a été annulée.");
}

/** Décision administrateur commune (revérifie le statut EN_ATTENTE en base). */
async function decideLeaveRequest(
  id: string,
  formData: FormData,
  status: typeof LeaveStatus.VALIDEE | typeof LeaveStatus.REFUSEE,
  successMessage: string
): Promise<void> {
  const admin = await requireUser(Role.ADMIN);

  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) {
    fail("Demande introuvable.");
  }
  if (request.status !== LeaveStatus.EN_ATTENTE) {
    fail("Cette demande a déjà été traitée.");
  }

  let updated = true;
  try {
    await prisma.leaveRequest.update({
      // Le statut dans le `where` protège contre une double décision simultanée.
      where: { id, status: LeaveStatus.EN_ATTENTE },
      data: {
        status,
        decidedById: admin.id,
        decidedAt: new Date(),
        decisionComment: text(formData, "comment"),
      },
    });
  } catch {
    updated = false;
  }
  if (!updated) {
    fail("Cette demande a déjà été traitée.");
  }

  succeed(successMessage);
}

/** Validation d'une demande (administrateur). */
export async function approveLeaveRequest(id: string, formData: FormData): Promise<void> {
  await decideLeaveRequest(id, formData, LeaveStatus.VALIDEE, "La demande de congés a été validée.");
}

/** Refus d'une demande (administrateur). */
export async function rejectLeaveRequest(id: string, formData: FormData): Promise<void> {
  await decideLeaveRequest(id, formData, LeaveStatus.REFUSEE, "La demande de congés a été refusée.");
}
