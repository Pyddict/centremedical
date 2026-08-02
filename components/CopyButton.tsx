"use client";

import { useState } from "react";

/**
 * Bouton "copier dans le presse-papiers" pour les champs de la fiche
 * administrative. Affiche brièvement une confirmation après la copie.
 */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible (http non sécurisé…) : sélection impossible, on ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={label ? `Copier « ${label} »` : "Copier"}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-teal-700"
    >
      {copied ? (
        <span className="font-medium text-emerald-600">Copié ✓</span>
      ) : (
        <>
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" />
            <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" stroke="currentColor" />
          </svg>
          Copier
        </>
      )}
    </button>
  );
}
