import { LinkButton } from "@/components/ui";

export default function AccesRefusePage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-4xl" aria-hidden>
        ⛔
      </p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Accès refusé</h1>
      <p className="mt-2 text-sm text-slate-500">
        Cette page est réservée à un autre rôle (administrateur par exemple). Si vous pensez
        qu&apos;il s&apos;agit d&apos;une erreur, contactez un administrateur du centre.
      </p>
      <div className="mt-6">
        <LinkButton href="/">Retour au tableau de bord</LinkButton>
      </div>
    </div>
  );
}
