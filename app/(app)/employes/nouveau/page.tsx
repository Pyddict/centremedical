import { Role } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { createEmployee } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouvel employé" };

export default async function NouvelEmployePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(Role.ADMIN);
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nouvel employé"
        description="Créez la fiche d'un employé. Il pourra ensuite se connecter avec son compte Auth0."
        actions={
          <LinkButton href="/employes" variant="secondary">
            Retour à la liste
          </LinkButton>
        }
      />

      <ErrorBanner message={error} />

      <Card title="Informations de base">
        <form action={createEmployee} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom">
              <Input name="firstName" required maxLength={100} autoFocus />
            </Field>
            <Field label="Nom">
              <Input name="lastName" required maxLength={100} />
            </Field>
          </div>

          <Field
            label="Email de connexion"
            hint="Doit correspondre exactement à l'email du compte Auth0 de l'employé."
          >
            <Input
              type="email"
              name="email"
              required
              maxLength={200}
              placeholder="prenom.nom@exemple.fr"
            />
          </Field>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Rôles</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {Object.values(Role).map((role) => (
                <label
                  key={role}
                  className="inline-flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    className="h-4 w-4 rounded border-slate-300 accent-teal-700"
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </div>

          <Field label="Poste (optionnel)">
            <Input
              name="jobTitle"
              maxLength={150}
              placeholder="Ex. : médecin généraliste, secrétaire médicale…"
            />
          </Field>

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit">Créer l&apos;employé</Button>
            <LinkButton href="/employes" variant="secondary">
              Annuler
            </LinkButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
