"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CostCategory, CostFrequency, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseDateOnly } from "@/lib/dates";
import { parseEurosToCents } from "@/lib/format";

/** Lit un champ texte d'un FormData (null si absent ou vide). */
function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(message: string, path = "/couts"): never {
  redirect(path + "?error=" + encodeURIComponent(message));
}

function succeed(message: string): never {
  revalidatePath("/couts");
  redirect("/couts?success=" + encodeURIComponent(message));
}

function isCostCategory(value: string): value is CostCategory {
  return (Object.values(CostCategory) as string[]).includes(value);
}

function isCostFrequency(value: string): value is CostFrequency {
  return (Object.values(CostFrequency) as string[]).includes(value);
}

type CostFields = {
  label: string;
  category: CostCategory;
  provider: string | null;
  amountCents: number;
  frequency: CostFrequency;
  startDate: Date | null;
  notes: string | null;
};

/** Valide les champs communs de création / modification d'une charge. */
function parseCostFields(formData: FormData, errorPath: string): CostFields {
  const label = text(formData, "label");
  if (!label) {
    fail("Le libellé est requis.", errorPath);
  }

  const categoryRaw = text(formData, "category") ?? "";
  if (!isCostCategory(categoryRaw)) {
    fail("Catégorie invalide.", errorPath);
  }

  const frequencyRaw = text(formData, "frequency") ?? "";
  if (!isCostFrequency(frequencyRaw)) {
    fail("Fréquence invalide.", errorPath);
  }

  const amountCents = parseEurosToCents(text(formData, "amount"));
  if (amountCents === null) {
    fail("Montant invalide", errorPath);
  }

  const startRaw = text(formData, "startDate");
  const startDate = startRaw ? parseDateOnly(startRaw) : null;
  if (startRaw && !startDate) {
    fail("Date de début invalide.", errorPath);
  }

  return {
    label,
    category: categoryRaw,
    provider: text(formData, "provider"),
    amountCents,
    frequency: frequencyRaw,
    startDate,
    notes: text(formData, "notes"),
  };
}

/** Création d'une charge récurrente (administrateur uniquement). */
export async function createCost(formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const fields = parseCostFields(formData, "/couts");

  await prisma.recurringCost.create({ data: fields });

  succeed(`La charge « ${fields.label} » a bien été ajoutée.`);
}

/** Modification d'une charge récurrente (administrateur uniquement). */
export async function updateCost(id: string, formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const existing = await prisma.recurringCost.findUnique({ where: { id } });
  if (!existing) {
    fail("Charge introuvable.");
  }

  const fields = parseCostFields(formData, `/couts/${id}`);

  await prisma.recurringCost.update({ where: { id }, data: fields });

  succeed(`La charge « ${fields.label} » a bien été modifiée.`);
}

/** Désactivation / réactivation d'une charge (administrateur uniquement). */
export async function toggleCost(id: string, _formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const cost = await prisma.recurringCost.findUnique({ where: { id } });
  if (!cost) {
    fail("Charge introuvable.");
  }

  await prisma.recurringCost.update({
    where: { id },
    data: { active: !cost.active },
  });

  succeed(
    cost.active
      ? `La charge « ${cost.label} » a été désactivée.`
      : `La charge « ${cost.label} » a été réactivée.`
  );
}

/** Suppression définitive d'une charge (administrateur uniquement). */
export async function deleteCost(id: string, _formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const cost = await prisma.recurringCost.findUnique({ where: { id } });
  if (!cost) {
    fail("Charge introuvable.");
  }

  await prisma.recurringCost.delete({ where: { id } });

  succeed(`La charge « ${cost.label} » a été supprimée.`);
}
