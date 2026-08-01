import { Role, type AbsenceType } from "@prisma/client";
import { dayInRange, eachDayUTC } from "@/lib/dates";
import { ABSENCE_TYPE_LABELS } from "@/lib/roles";

/**
 * Calcul de présence du cabinet : fonctions pures (testables) utilisées par la
 * page du calendrier. Un employé est « absent » un jour J s'il a une absence
 * déclarée OU un congé validé couvrant J ; les autres employés actifs sont
 * « présents ».
 */

/** Utilisateur minimal nécessaire au calcul de présence. */
export type PresenceUser = {
  id: string;
  firstName: string;
  lastName: string;
  roles: Role[];
};

/** Intervalle d'indisponibilité (absence déclarée ou congé validé), motif inclus. */
export type UnavailabilityInterval = {
  userId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
};

/** Présence détaillée d'un jour donné. */
export type DayPresence = {
  absents: Array<{ user: PresenceUser; reason: string }>;
  presentDoctors: PresenceUser[];
  presentOthers: PresenceUser[];
};

/**
 * Fusionne absences déclarées et congés validés en intervalles d'indisponibilité.
 * Les absences déclarées sont placées en premier : leur motif (« Vacances »…)
 * est prioritaire sur « Congé validé » si les deux couvrent le même jour.
 */
export function buildUnavailabilityIntervals(
  absences: Array<{ userId: string; startDate: Date; endDate: Date; type: AbsenceType }>,
  validatedLeaves: Array<{ requesterId: string; startDate: Date; endDate: Date }>
): UnavailabilityInterval[] {
  return [
    ...absences.map((a) => ({
      userId: a.userId,
      startDate: a.startDate,
      endDate: a.endDate,
      reason: ABSENCE_TYPE_LABELS[a.type],
    })),
    ...validatedLeaves.map((l) => ({
      userId: l.requesterId,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: "Congé validé",
    })),
  ];
}

/** Répartit les utilisateurs actifs entre absents / médecins présents / autres présents pour un jour. */
export function computeDayPresence(
  day: Date,
  users: PresenceUser[],
  intervals: UnavailabilityInterval[]
): DayPresence {
  const reasonByUserId = new Map<string, string>();
  for (const interval of intervals) {
    if (
      !reasonByUserId.has(interval.userId) &&
      dayInRange(day, interval.startDate, interval.endDate)
    ) {
      reasonByUserId.set(interval.userId, interval.reason);
    }
  }

  const absents: Array<{ user: PresenceUser; reason: string }> = [];
  const presentDoctors: PresenceUser[] = [];
  const presentOthers: PresenceUser[] = [];

  for (const user of users) {
    const reason = reasonByUserId.get(user.id);
    if (reason !== undefined) {
      absents.push({ user, reason });
    } else if (user.roles.includes(Role.MEDECIN)) {
      presentDoctors.push(user);
    } else {
      presentOthers.push(user);
    }
  }

  return { absents, presentDoctors, presentOthers };
}

// ----- Helpers de mois (paramètre ?mois=YYYY-MM) -----

export type MonthRef = { year: number; month0: number };

/** Parse "YYYY-MM" (null si invalide). */
export function parseMonthParam(value: string | null | undefined): MonthRef | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(5, 7), 10);
  if (month < 1 || month > 12) return null;
  return { year, month0: month - 1 };
}

/** MonthRef → "YYYY-MM". */
export function monthKey(ref: MonthRef): string {
  return `${String(ref.year).padStart(4, "0")}-${String(ref.month0 + 1).padStart(2, "0")}`;
}

/** Mois décalé de `delta` mois (gère les changements d'année). */
export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const d = new Date(Date.UTC(ref.year, ref.month0 + delta, 1));
  return { year: d.getUTCFullYear(), month0: d.getUTCMonth() };
}

/** Premier et dernier jour du mois, à minuit UTC. */
export function monthBoundsUTC(ref: MonthRef): { first: Date; last: Date } {
  return {
    first: new Date(Date.UTC(ref.year, ref.month0, 1)),
    last: new Date(Date.UTC(ref.year, ref.month0 + 1, 0)),
  };
}

/** Tous les jours du mois, à minuit UTC. */
export function monthDaysUTC(ref: MonthRef): Date[] {
  const { first, last } = monthBoundsUTC(ref);
  return eachDayUTC(first, last);
}
