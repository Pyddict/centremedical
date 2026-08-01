import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Role, StockOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDateFr } from "@/lib/dates";
import { formatEuros, fullName } from "@/lib/format";
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
  SuccessBanner,
  Table,
  Td,
  Textarea,
} from "@/components/ui";
import { ORDER_STATUS_META } from "../../labels";
import { markOrderPaid, receiveOrder } from "../../actions";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default async function StockOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ASSISTANTE);
  const { id } = await params;
  const { error, success } = await searchParams;

  const order = await prisma.stockOrder.findUnique({
    where: { id },
    include: {
      orderedBy: { select: { firstName: true, lastName: true } },
      requests: {
        orderBy: { createdAt: "asc" },
        include: { requester: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!order) notFound();

  const meta = ORDER_STATUS_META[order.status];
  const devisLink = order.devisPath ? (
    <a
      href={`/api/stock/orders/${order.id}/devis`}
      className="font-medium text-teal-700 underline-offset-2 hover:underline"
    >
      {order.devisFileName || "Devis"}
    </a>
  ) : (
    "—"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.reference ? `Commande ${order.reference}` : "Détail de la commande"}
        description={`Commandée le ${formatDateFr(order.orderedAt)}${
          order.supplier ? ` — ${order.supplier}` : ""
        }`}
        actions={
          <LinkButton href="/stock" variant="secondary">
            Retour au stock
          </LinkButton>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card title="Informations">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info
            label="Statut"
            value={<Badge color={meta.color}>{meta.label}</Badge>}
          />
          <Info label="Fournisseur" value={order.supplier || "—"} />
          <Info label="Référence" value={order.reference || "—"} />
          <Info
            label="Commandée par"
            value={order.orderedBy ? fullName(order.orderedBy) : "—"}
          />
          <Info label="Commandée le" value={formatDateFr(order.orderedAt)} />
          <Info
            label="Reçue le"
            value={order.receivedAt ? formatDateFr(order.receivedAt) : "—"}
          />
          <Info
            label="Payée le"
            value={order.paidAt ? formatDateFr(order.paidAt) : "—"}
          />
          <Info
            label="Montant"
            value={order.amountCents != null ? formatEuros(order.amountCents) : "—"}
          />
          <Info label="Devis" value={devisLink} />
          {order.notes ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Info label="Notes" value={order.notes} />
            </div>
          ) : null}
        </dl>
      </Card>

      <Card title={`Demandes incluses (${order.requests.length})`}>
        {order.requests.length === 0 ? (
          <EmptyState message="Aucune demande n'est rattachée à cette commande." />
        ) : (
          <Table headers={["Article", "Qté", "Demandeur"]}>
            {order.requests.map((request) => (
              <tr key={request.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">
                  {request.itemName}{" "}
                  {request.urgent ? <Badge color="red">Urgent</Badge> : null}
                </Td>
                <Td>{request.quantity}</Td>
                <Td>{fullName(request.requester)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {order.status === StockOrderStatus.COMMANDEE ? (
        <Card title="Réceptionner la commande">
          <form action={receiveOrder.bind(null, order.id)} className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Devis (fichier)"
              hint="Optionnel — PDF ou image (.pdf, .jpg, .png), 15 Mo maximum."
            >
              <Input type="file" name="devis" accept=".pdf,.jpg,.jpeg,.png" />
            </Field>
            <Field label="Montant (€)" hint="Optionnel — ex. « 123,45 »">
              <Input name="amount" inputMode="decimal" placeholder="123,45" />
            </Field>
            <Field label="Notes" hint="Optionnel" className="sm:col-span-2">
              <Textarea name="notes" placeholder="Remarques sur la livraison, écarts constatés…" />
            </Field>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit">Réceptionner la commande</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {order.status === StockOrderStatus.RECUE_A_PAYER ? (
        <Card title="Paiement">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Commande reçue{order.receivedAt ? ` le ${formatDateFr(order.receivedAt)}` : ""} —
              montant :{" "}
              <span className="font-semibold text-slate-900">
                {order.amountCents != null ? formatEuros(order.amountCents) : "non renseigné"}
              </span>
              {order.devisPath ? <> · {devisLink}</> : null}
            </p>
            <form action={markOrderPaid.bind(null, order.id)}>
              <Button type="submit">Marquer payée</Button>
            </form>
          </div>
        </Card>
      ) : null}

      {order.status === StockOrderStatus.PAYEE ? (
        <Card title="Paiement">
          <p className="text-sm text-slate-600">
            Cette commande a été payée
            {order.paidAt ? ` le ${formatDateFr(order.paidAt)}` : ""}
            {order.amountCents != null ? (
              <>
                {" "}
                pour un montant de{" "}
                <span className="font-semibold text-slate-900">
                  {formatEuros(order.amountCents)}
                </span>
              </>
            ) : null}
            .
          </p>
        </Card>
      ) : null}
    </div>
  );
}
