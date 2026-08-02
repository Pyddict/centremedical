import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 Mo

function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

export type StoredFile = {
  fileName: string;
  storedPath: string;
  mimeType: string;
  size: number;
};

/**
 * Enregistre un fichier uploadé (formData) sous UPLOAD_DIR/<subdir>/…
 * Retourne les métadonnées à persister en base. Lève une Error avec un
 * message en français si le fichier est invalide.
 */
export async function saveUploadedFile(
  file: File,
  subdir: "devis" | "documents"
): Promise<StoredFile> {
  if (!file || file.size === 0) throw new Error("Fichier vide ou manquant");
  if (file.size > MAX_FILE_SIZE) throw new Error("Fichier trop volumineux (15 Mo maximum)");

  const safeName = (file.name || "fichier").replace(/[^\w.\-]+/g, "_").slice(-100);
  const storedPath = `${subdir}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeName}`;
  const absolute = path.join(uploadRoot(), storedPath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));

  return {
    fileName: file.name || safeName,
    storedPath,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

/** Lit un fichier stocké (protège contre les chemins hors du dossier d'upload). */
export async function readStoredFile(storedPath: string): Promise<Buffer> {
  const root = uploadRoot();
  const absolute = path.resolve(root, storedPath);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error("Chemin de fichier invalide");
  }
  return readFile(absolute);
}

export async function deleteStoredFile(storedPath: string): Promise<void> {
  try {
    const root = uploadRoot();
    const absolute = path.resolve(root, storedPath);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) return;
    await unlink(absolute);
  } catch {
    // fichier déjà supprimé : on ignore
  }
}
