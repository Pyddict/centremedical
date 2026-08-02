export const dynamic = "force-dynamic";

export default function NonAutorisePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          🔒
        </p>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Compte non autorisé</h1>
        <p className="mt-2 text-sm text-slate-500">
          Votre connexion a réussi, mais aucun compte employé ne correspond à votre adresse
          email. Demandez à un administrateur de créer votre fiche employé avec l&apos;adresse
          email exacte de votre compte, puis reconnectez-vous.
        </p>
        <a
          href="/auth/logout"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Se déconnecter
        </a>
      </div>
    </div>
  );
}
