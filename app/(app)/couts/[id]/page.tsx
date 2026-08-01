import { notFound } from "next/navigation";
import { CostCategory, CostFrequency, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { toDateOnlyString } from "@/lib/dates";
import { COST_CATEGORY_LABELS, COST_FREQUENCY_LABELS } from "@/lib/roles";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { updateCost } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifier une charge" };

export default async function ModifierCoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(Role.ADMIN);
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const cost = await prisma.recurringCost.findUnique({ where: { id } });
  if (!cost) {
    notFound();
  }

  const amountValue = (cost.amountCents / 100).toFixed(2).replace(".", ",");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Modifier une charge"
        description={cost.label}
        actions={cost.active ? null : <Badge color="gray">Inactive</Badge>}
      />

      <ErrorBanner message={error} />

      <Card title="Informations de la charge">
        <form action={updateCost.bind(null, cost.id)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Libellé">
              <Input name="label" required maxLength={200} defaultValue={cost.label} />
            </Field>
            <Field label="Catégorie">
              <Select name="category" defaultValue={cost.category}>
                {Object.values(CostCategory).map((category) => (
                  <option key={category} value={category}>
                    {COST_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prestataire (optionnel)">
              <Input name="provider" maxLength={200} defaultValue={cost.provider ?? ""} />
            </Field>
            <Field label="Montant (€)">
              <Input
                name="amount"
                required
                placeholder="450,00"
                inputMode="decimal"
                defaultValue={amountValue}
              />
            </Field>
            <Field label="Fréquence">
              <Select name="frequency" defaultValue={cost.frequency}>
                {Object.values(CostFrequency).map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {COST_FREQUENCY_LABELS[frequency]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date de début (optionnelle)">
              <Input
                name="startDate"
                type="date"
                defaultValue={cost.startDate ? toDateOnlyString(cost.startDate) : ""}
              />
            </Field>
            <Field label="Notes (optionnelles)" className="sm:col-span-2">
              <Textarea name="notes" maxLength={1000} defaultValue={cost.notes ?? ""} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit">Enregistrer les modifications</Button>
            <LinkButton href="/couts" variant="secondary">
              Annuler
            </LinkButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
