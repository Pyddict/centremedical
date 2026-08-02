import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Role, type User } from "@prisma/client";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

/**
 * Retourne l'utilisateur local correspondant à la session Auth0, ou null si :
 * - pas de session Auth0 ;
 * - aucun employé avec cet email n'existe (compte non provisionné) ;
 * - le compte est désactivé.
 *
 * Amorçage : si la table est vide, le premier utilisateur qui se connecte
 * devient automatiquement administrateur.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth0().getSession();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!session || !email) return null;

  // Le rattachement d'un compte Auth0 à un employé se fait par l'email : il faut
  // donc que l'email ait été vérifié, sinon n'importe qui pourrait s'inscrire
  // avec l'adresse d'un employé et récupérer son compte.
  if (session.user.email_verified !== true) return null;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const userCount = await prisma.user.count();
    if (userCount > 0) return null;
    user = await prisma.user.create({
      data: {
        email,
        firstName:
          (session.user.given_name as string | undefined) ??
          session.user.name?.split(" ")[0] ??
          "Admin",
        lastName: (session.user.family_name as string | undefined) ?? "",
        roles: [Role.ADMIN],
        auth0Sub: session.user.sub,
      },
    });
  }

  if (!user.active) return null;

  if (!user.auth0Sub && session.user.sub) {
    try {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: session.user.sub },
      });
    } catch {
      // auth0Sub déjà rattaché à une autre fiche (email réattribué) : on
      // n'empêche pas la connexion pour autant.
    }
  }

  return user;
});

export function isAdmin(user: Pick<User, "roles">): boolean {
  return user.roles.includes(Role.ADMIN);
}

/** Vrai si l'utilisateur possède au moins un des rôles donnés (ADMIN passe toujours). */
export function hasRole(user: Pick<User, "roles">, ...roles: Role[]): boolean {
  if (isAdmin(user)) return true;
  return roles.some((r) => user.roles.includes(r));
}

/**
 * À utiliser dans les pages et les server actions.
 * Redirige vers la connexion / la page d'erreur adéquate si nécessaire.
 * Sans argument : exige simplement un utilisateur connecté et autorisé.
 */
export async function requireUser(...roles: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const session = await auth0().getSession();
    redirect(session ? "/non-autorise" : "/auth/login");
  }
  if (roles.length > 0 && !hasRole(user, ...roles)) {
    redirect("/acces-refuse");
  }
  return user;
}

/**
 * À utiliser dans les route handlers (téléchargements de fichiers, PDF…).
 * Retourne soit l'utilisateur, soit une réponse 401/403 prête à renvoyer.
 */
export async function getApiUser(
  ...roles: Role[]
): Promise<{ user: User; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  if (roles.length > 0 && !hasRole(user, ...roles)) {
    return {
      response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    };
  }
  return { user };
}
