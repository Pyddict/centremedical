/** 12345 (centimes) → "123,45 €" */
export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

/** "123,45" ou "123.45" → 12345 centimes (null si invalide). */
export function parseEurosToCents(input: string | null | undefined): number | null {
  if (!input) return null;
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/** "2,5 j" — affichage compact d'un nombre de jours. */
export function formatDays(days: number): string {
  return `${days.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`;
}
