import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LEAVE_DAYS } from "@/lib/roles";

export type LeaveSummary = {
  year: number;
  /** Jours alloués pour l'année (LeaveBalance ou valeur par défaut). */
  allocated: number;
  /** Jours des demandes VALIDEE dont le début est dans l'année. */
  taken: number;
  /** Jours des demandes EN_ATTENTE dont le début est dans l'année. */
  pending: number;
  /** alloués − pris. */
  remaining: number;
};

/** Bornes UTC de l'année civile : [1er janvier, 1er janvier suivant[. */
export function yearBoundsUTC(year: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

/**
 * Solde de congés d'un utilisateur pour une année civile.
 * Une demande compte pour l'année de sa date de début.
 */
export async function getLeaveSummary(userId: string, year: number): Promise<LeaveSummary> {
  const startDate = yearBoundsUTC(year);
  const [balance, taken, pending] = await Promise.all([
    prisma.leaveBalance.findUnique({ where: { userId_year: { userId, year } } }),
    prisma.leaveRequest.aggregate({
      _sum: { daysCount: true },
      where: { requesterId: userId, status: LeaveStatus.VALIDEE, startDate },
    }),
    prisma.leaveRequest.aggregate({
      _sum: { daysCount: true },
      where: { requesterId: userId, status: LeaveStatus.EN_ATTENTE, startDate },
    }),
  ]);

  const allocated = balance?.allocatedDays ?? DEFAULT_LEAVE_DAYS;
  const takenDays = taken._sum.daysCount ?? 0;
  const pendingDays = pending._sum.daysCount ?? 0;

  return {
    year,
    allocated,
    taken: takenDays,
    pending: pendingDays,
    remaining: allocated - takenDays,
  };
}
