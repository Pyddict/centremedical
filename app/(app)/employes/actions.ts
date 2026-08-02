"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DocumentType, Role, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseDateOnly } from "@/lib/dates";
import { DOCUMENT_TYPE_LABELS } from "@/lib/roles";
import { deleteStoredFile, saveUploadedFile, type StoredFile } from "@/lib/uploads";

const ALL_ROLES: Role[] = Object.values(Role);
const ALL_DOCUMENT_TYPES: DocumentType[] = Object.values(DocumentType);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lit un champ texte d'un FormData (null si absent ou vide). */
function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Cases à cocher "roles" → tableau de rôles valides. */
function parseRoles(formData: FormData): Role[] {
  const values = formData
    .getAll("roles")
    .filter((v): v is string => typeof v === "string");
  return ALL_ROLES.filter((role) => values.includes(role));
}

/** Redirection d'erreur (gère un chemin avec ou sans query existante). */
function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

/** Redirection de succès vers un chemin SANS query. */
function succeed(path: string, message: string): never {
  revalidatePath("/employes");
  revalidatePath(path);
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

/** Création d'un employé (administrateur). */
export async function createEmployee(formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const email = text(formData, "email")?.toLowerCase() ?? null;
  const roles = parseRoles(formData);
  const jobTitle = text(formData, "jobTitle");

  if (!firstName || !lastName) {
    fail("/employes/nouveau", "Le prénom et le nom sont requis.");
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    fail("/employes/nouveau", "Veuillez renseigner une adresse email valide.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    fail("/employes/nouveau", "Un employé avec cet email existe déjà");
  }

  let created: User | null = null;
  try {
    created = await prisma.user.create({
      data: { firstName, lastName, email, roles, jobTitle },
    });
  } catch {
    created = null;
  }
  if (!created) {
    // Course avec une création simultanée : la contrainte d'unicité a refusé l'email.
    fail("/employes/nouveau", "Un employé avec cet email existe déjà");
  }

  succeed(
    `/employes/${created.id}`,
    "Employé créé. Vous pouvez maintenant compléter sa fiche administrative."
  );
}

/** Mise à jour de la fiche administrative (administrateur). */
export async function updateEmployee(id: string, formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const employee = await prisma.user.findUnique({ where: { id } });
  if (!employee) {
    fail("/employes", "Employé introuvable.");
  }

  const editPath = `/employes/${id}?edit=1`;

  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const email = text(formData, "email")?.toLowerCase() ?? null;

  if (!firstName || !lastName) {
    fail(editPath, "Le prénom et le nom sont requis.");
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    fail(editPath, "Veuillez renseigner une adresse email valide.");
  }

  const emailChanged = email !== employee.email;
  if (emailChanged) {
    const other = await prisma.user.findUnique({ where: { email } });
    if (other && other.id !== id) {
      fail(editPath, "Un autre employé utilise déjà cet email.");
    }
  }

  let updated = true;
  try {
    await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email,
        phone: text(formData, "phone"),
        birthDate: parseDateOnly(text(formData, "birthDate")),
        address: text(formData, "address"),
        socialSecurityNumber: text(formData, "socialSecurityNumber"),
        jobTitle: text(formData, "jobTitle"),
        contractType: text(formData, "contractType"),
        hireDate: parseDateOnly(text(formData, "hireDate")),
        iban: text(formData, "iban"),
        emergencyContact: text(formData, "emergencyContact"),
        notes: text(formData, "notes"),
        // Changer l'email de connexion détache le compte Auth0 précédent :
        // il sera rattaché à nouveau à la prochaine connexion.
        ...(emailChanged ? { auth0Sub: null } : {}),
      },
    });
  } catch {
    updated = false;
  }
  if (!updated) {
    fail(editPath, "Un autre employé utilise déjà cet email.");
  }

  succeed(`/employes/${id}`, "Fiche mise à jour");
}

/** Mise à jour des rôles et de l'activation du compte (administrateur). */
export async function updateAccess(id: string, formData: FormData): Promise<void> {
  const admin = await requireUser(Role.ADMIN);

  const employee = await prisma.user.findUnique({ where: { id } });
  if (!employee) {
    fail("/employes", "Employé introuvable.");
  }

  const fichePath = `/employes/${id}`;
  const roles = parseRoles(formData);
  const active = formData.get("active") === "1";

  if (id === admin.id && !roles.includes(Role.ADMIN)) {
    fail(fichePath, "Vous ne pouvez pas vous retirer vous-même le rôle Administrateur.");
  }
  if (id === admin.id && !active) {
    fail(fichePath, "Vous ne pouvez pas désactiver votre propre compte.");
  }

  await prisma.user.update({ where: { id }, data: { roles, active } });

  succeed(fichePath, "Rôles et accès mis à jour.");
}

/** Définit les jours de congés alloués pour une année (administrateur). */
export async function setLeaveBalance(
  userId: string,
  year: number,
  formData: FormData
): Promise<void> {
  await requireUser(Role.ADMIN);

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  if (!employee) {
    fail("/employes", "Employé introuvable.");
  }

  const fichePath = `/employes/${userId}`;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    fail(fichePath, "Année invalide.");
  }

  const raw = text(formData, "allocatedDays");
  const allocated = raw ? Number.parseFloat(raw.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(allocated) || allocated < 0 || allocated > 365) {
    fail(fichePath, "Le nombre de jours alloués doit être compris entre 0 et 365.");
  }

  await prisma.leaveBalance.upsert({
    where: { userId_year: { userId, year } },
    create: { userId, year, allocatedDays: allocated },
    update: { allocatedDays: allocated },
  });

  revalidatePath("/conges");
  succeed(fichePath, `Jours alloués pour ${year} enregistrés.`);
}

/** Ajout d'un document administratif (administrateur). */
export async function uploadDocument(userId: string, formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  if (!employee) {
    fail("/employes", "Employé introuvable.");
  }

  const fichePath = `/employes/${userId}`;

  const typeRaw = text(formData, "type");
  const type =
    typeRaw && (ALL_DOCUMENT_TYPES as string[]).includes(typeRaw)
      ? (typeRaw as DocumentType)
      : null;
  if (!type) {
    fail(fichePath, "Type de document invalide.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    fail(fichePath, "Veuillez sélectionner un fichier.");
  }

  let stored: StoredFile | null = null;
  let uploadError = "Échec de l'enregistrement du fichier.";
  try {
    stored = await saveUploadedFile(file, "documents");
  } catch (err) {
    if (err instanceof Error && err.message) uploadError = err.message;
  }
  if (!stored) {
    fail(fichePath, uploadError);
  }

  await prisma.document.create({
    data: {
      userId,
      type,
      label: text(formData, "label") ?? DOCUMENT_TYPE_LABELS[type],
      fileName: stored.fileName,
      storedPath: stored.storedPath,
      mimeType: stored.mimeType,
      size: stored.size,
    },
  });

  succeed(fichePath, "Document ajouté.");
}

/** Suppression d'un document (ligne + fichier stocké) (administrateur). */
export async function deleteDocument(id: string, _formData: FormData): Promise<void> {
  await requireUser(Role.ADMIN);

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    fail("/employes", "Document introuvable.");
  }

  await prisma.document.delete({ where: { id } });
  await deleteStoredFile(document.storedPath);

  succeed(`/employes/${document.userId}`, "Document supprimé.");
}
