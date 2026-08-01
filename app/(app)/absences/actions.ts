"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AbsenceType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireUser } from "@/lib/session";
import { parseDateOnly } from "@/lib/dates";

const DAY_MS = 86_400_000;

/** Lit un champ texte d'un FormData (null si absent ou vide). */
function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(message: string): never {
  redirect("/absences?error=" + encodeURIComponent(message));
}

function succeed(message: string): never {
  revalidatePath("/absences");
  redirect("/absences?success=" + encodeURIComponent(message));
}

/**
 * Déclaration d'une absence (médecins ; les administrateurs passent aussi).
 * L'absence est toujours créée pour l'utilisateur courant.
 */
export async function createAbsence(formData: FormData): Promise<void> {
  const user = await requireUser(Role.MEDECIN);

  const start = parseDateOnly(text(formData, "startDate"));
  const end = parseDateOnly(text(formData, "endDate"));
  if (!start || !end) {
    fail("Veuillez renseigner les dates de début et de fin.");
  }
  if (start.getTime() > end.getTime()) {
    fail("La date de début doit être antérieure ou égale à la date de fin.");
  }
  const durationDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (durationDays > 366) {
    fail("La durée d'une absence ne peut pas dépasser 366 jours.");
  }

  const typeRaw = text(formData, "type");
  const type =
    typeRaw && (Object.values(AbsenceType) as string[]).includes(typeRaw)
      ? (typeRaw as AbsenceType)
      : null;
  if (!type) {
    fail("Veuillez choisir un type d'absence valide.");
  }

  const note = text(formData, "note");
  if (note && note.length > 500) {
    fail("La note ne peut pas dépasser 500 caractères.");
  }

  await prisma.absence.create({
    data: {
      userId: user.id,
      startDate: start,
      endDate: end,
      type,
      note,
    },
  });

  succeed("Votre absence a bien été déclarée.");
}

/** Suppression d'une absence (propriétaire, ou administrateur). */
export async function deleteAbsence(id: string, _formData: FormData): Promise<void> {
  const user = await requireUser();

  const absence = await prisma.absence.findUnique({ where: { id } });
  if (!absence) {
    fail("Absence introuvable.");
  }
  if (absence.userId !== user.id && !isAdmin(user)) {
    fail("Vous ne pouvez supprimer que vos propres absences.");
  }

  let deleted = true;
  try {
    await prisma.absence.delete({ where: { id } });
  } catch {
    // Déjà supprimée entre-temps.
    deleted = false;
  }
  if (!deleted) {
    fail("Cette absence a déjà été supprimée.");
  }

  succeed("L'absence a été supprimée.");
}
