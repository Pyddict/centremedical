/**
 * Convention du projet : les dates "jour" (congés, absences) sont stockées en
 * DateTime à minuit UTC. Toujours passer par ces helpers pour parser/formater,
 * afin d'éviter tout décalage de fuseau horaire.
 */

const DAY_MS = 86_400_000;

/** Parse une chaîne "YYYY-MM-DD" (input type=date) en Date à minuit UTC. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DD" (pour les inputs type=date). */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "01/08/2026" */
export function formatDateFr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "samedi 1 août 2026" */
export function formatDateLongFr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "01/08/2026 à 14:30" (pour les horodatages créés côté serveur). */
export function formatDateTimeFr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isWeekendUTC(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Tous les jours entre start et end inclus (dates à minuit UTC). */
export function eachDayUTC(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    days.push(new Date(t));
  }
  return days;
}

/** Nombre de jours ouvrés (lundi → vendredi) entre start et end inclus. */
export function countBusinessDays(start: Date, end: Date): number {
  return eachDayUTC(start, end).filter((d) => !isWeekendUTC(d)).length;
}

/** Vrai si `day` est dans l'intervalle [start, end] (inclus). */
export function dayInRange(day: Date, start: Date, end: Date): boolean {
  return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
}

/** "août 2026" */
export function monthLabelFr(year: number, monthIndex0: number): string {
  return new Date(Date.UTC(year, monthIndex0, 1)).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** Aujourd'hui, à minuit UTC (basé sur la date à Paris). */
export function todayDateOnly(): Date {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00.000Z`);
}
