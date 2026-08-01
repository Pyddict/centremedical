import { CostCategory, CostFrequency, Role, type RecurringCost } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatEuros } from "@/lib/format";
import {
  COST_CATEGORY_LABELS,
  COST_FREQUENCY_LABELS,
  COST_FREQUENCY_PER_YEAR,
} from "@/lib/roles";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StatCard,
  SuccessBanner,
  Table,
  Td,
  Textarea,
} from "@/components/ui";
import { createCost, deleteCost, toggleCost } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Coûts récurrents" };

/** Équivalent mensuel en centimes d'une charge selon sa fréquence. */
function monthlyCents(cost: Pick<RecurringCost, "amountCents" | "frequency">): number {
  return (cost.amountCents * COST_FREQUENCY_PER_YEAR[cost.frequency]) / 12;
}

function annualCents(cost: Pick<RecurringCost, "amountCents" | "frequency">): number {
  return cost.amountCents * COST_FREQUENCY_PER_YEAR[cost.frequency];
}

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export default async function CoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(Role.ADMIN);
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  const costs = await prisma.recurringCost.findMany({
    orderBy: [{ active: "desc" }, { label: "asc" }],
  });

  const activeCosts = costs.filter((cost) => cost.active);
  const totalMonthlyCents = activeCosts.reduce((sum, cost) => sum + monthlyCents(cost), 0);
  const totalAnnualCents = activeCosts.reduce((sum, cost) => sum + annualCents(cost), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coûts récurrents"
        description="Charges régulières du cabinet : loyer, nettoyage, comptabilité, informatique…"
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total mensuel équivalent"
          value={formatEuros(totalMonthlyCents)}
          accent="teal"
        />
        <StatCard label="Total annuel" value={formatEuros(totalAnnualCents)} />
        <StatCard label="Charges actives" value={activeCosts.length} />
      </div>

      <Card title="Charges récurrentes">
        {costs.length === 0 ? (
          <EmptyState message="Aucune charge récurrente enregistrée pour le moment." />
        ) : (
          <Table
            headers={[
              "Libellé",
              "Catégorie",
              "Prestataire",
              "Montant",
              "Équivalent mensuel",
              "Notes",
              "Actions",
            ]}
          >
            {costs.map((cost) => (
              <tr key={cost.id} className={cost.active ? undefined : "text-slate-400"}>
                <Td className="font-medium text-slate-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cost.active ? undefined : "text-slate-500"}>
                      {cost.label}
                    </span>
                    {cost.active ? null : <Badge color="gray">Inactive</Badge>}
                  </div>
                </Td>
                <Td>
                  <Badge color="violet">{COST_CATEGORY_LABELS[cost.category]}</Badge>
                </Td>
                <Td className="text-slate-600">{cost.provider ?? "—"}</Td>
                <Td className="whitespace-nowrap">
                  {formatEuros(cost.amountCents)} · {COST_FREQUENCY_LABELS[cost.frequency]}
                </Td>
                <Td className="whitespace-nowrap">{formatEuros(monthlyCents(cost))}</Td>
                <Td className="max-w-56 text-slate-500">
                  {cost.notes ? truncate(cost.notes) : "—"}
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <LinkButton href={`/couts/${cost.id}`} variant="secondary">
                      Modifier
                    </LinkButton>
                    <form action={toggleCost.bind(null, cost.id)}>
                      <Button type="submit" variant="secondary">
                        {cost.active ? "Désactiver" : "Réactiver"}
                      </Button>
                    </form>
                    <form action={deleteCost.bind(null, cost.id)}>
                      <Button type="submit" variant="danger">
                        Supprimer
                      </Button>
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Les totaux ci-dessus ne prennent en compte que les charges actives.
        </p>
      </Card>

      <Card title="Ajouter une charge">
        <form action={createCost} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Libellé">
              <Input
                name="label"
                required
                maxLength={200}
                placeholder="Ex. : Ménage hebdomadaire"
              />
            </Field>
            <Field label="Catégorie">
              <Select name="category" defaultValue={CostCategory.AUTRE}>
                {Object.values(CostCategory).map((category) => (
                  <option key={category} value={category}>
                    {COST_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prestataire (optionnel)">
              <Input name="provider" maxLength={200} placeholder="Ex. : Propre & Net SARL" />
            </Field>
            <Field label="Montant (€)">
              <Input name="amount" required placeholder="450,00" inputMode="decimal" />
            </Field>
            <Field label="Fréquence">
              <Select name="frequency" defaultValue={CostFrequency.MENSUEL}>
                {Object.values(CostFrequency).map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {COST_FREQUENCY_LABELS[frequency]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date de début (optionnelle)">
              <Input name="startDate" type="date" />
            </Field>
            <Field label="Notes (optionnelles)" className="sm:col-span-2 lg:col-span-3">
              <Textarea
                name="notes"
                maxLength={1000}
                placeholder="Ex. : contrat renouvelé chaque année en janvier…"
              />
            </Field>
          </div>
          <Button type="submit">Ajouter la charge</Button>
        </form>
      </Card>
    </div>
  );
}
