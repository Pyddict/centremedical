"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-slate-500">
          L&apos;opération n&apos;a pas pu être menée à bien. Vous pouvez réessayer ; si le
          problème persiste, contactez l&apos;administrateur du centre.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
