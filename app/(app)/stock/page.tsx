import { Role, StockOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasRole, requireUser } from "@/lib/session";
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
import { ORDER_STATUS_META, REQUEST_STATUS_META } from "./labels";
import { cancelRequest, createOrder, createStockRequest, markOrderPaid } from "./actions";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireUser();
  const canManage = hasRole(user, Role.ASSISTANTE);
  const { error, success } = await searchParams;

  const [toOrder, orders, myRequests] = await Promise.all([
    prisma.stockRequest.findMany({
      where: { status: "A_COMMANDER" },
      orderBy: [{ urgent: "desc" }, { createdAt: "asc" }],
      include: { requester: { select: { firstName: true, lastName: true } } },
    }),
    prisma.stockOrder.findMany({
      orderBy: { orderedAt: "desc" },
      take: 50,
      include: { _count: { select: { requests: true } } },
    }),
    prisma.stockRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const toOrderRows = toOrder.map((request) => {
    const canCancel = canManage || request.requesterId === user.id;
    return (
      <tr key={request.id} className="hover:bg-slate-50">
        {canManage ? (
          <Td>
            <input
              type="checkbox"
              name="requestIds"
              value={request.id}
              aria-label={`Sélectionner « ${request.itemName} »`}
              className="h-4 w-4 rounded border-slate-300 accent-teal-700"
            />
          </Td>
        ) : null}
        <Td className="font-medium text-slate-900">{request.itemName}</Td>
        <Td>{request.quantity}</Td>
        <Td className="max-w-xs text-slate-500">{request.details || "—"}</Td>
        <Td>{fullName(request.requester)}</Td>
        <Td>{formatDateFr(request.createdAt)}</Td>
        <Td>{request.urgent ? <Badge color="red">Urgent</Badge> : null}</Td>
        <Td className="text-right">
          {canCancel ? (
            canManage ? (
              <Button
                type="submit"
                variant="secondary"
                formAction={cancelRequest.bind(null, request.id)}
                className="px-2.5 py-1 text-xs"
              >
                Annuler
              </Button>
            ) : (
              <form action={cancelRequest.bind(null, request.id)}>
                <Button type="submit" variant="secondary" className="px-2.5 py-1 text-xs">
                  Annuler
                </Button>
              </form>
            )
          ) : null}
        </Td>
      </tr>
    );
  });

  const toOrderHeaders = canManage
    ? ["", "Article", "Qté", "Précisions", "Demandeur", "Date", "Urgence", "Actions"]
    : ["Article", "Qté", "Précisions", "Demandeur", "Date", "Urgence", "Actions"];

  const orderHeaders = [
    "Date",
    "Fournisseur / référence",
    "Articles",
    "Montant",
    "Statut",
    "Devis",
    ...(canManage ? ["Actions"] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock & commandes"
        description="Demandes de matériel du cabinet et suivi des commandes fournisseurs."
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card title="Nouvelle demande">
        <form action={createStockRequest} className="grid gap-4 sm:grid-cols-4">
          <Field label="Article" className="sm:col-span-3">
            <Input name="itemName" required placeholder="Ex. Gants nitrile taille M" />
          </Field>
          <Field label="Quantité">
            <Input type="number" name="quantity" min={1} step={1} defaultValue={1} required />
          </Field>
          <Field label="Précisions" hint="Optionnel" className="sm:col-span-4">
            <Textarea name="details" placeholder="Marque, référence, conditionnement…" />
          </Field>
          <div className="flex items-center justify-between gap-4 sm:col-span-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="urgent" className="h-4 w-4 accent-teal-700" />
              Urgent
            </label>
            <Button type="submit">Déposer la demande</Button>
          </div>
        </form>
      </Card>

      <Card title="À commander">
        {toOrder.length === 0 ? (
          <EmptyState message="Aucune demande en attente de commande." />
        ) : canManage ? (
          <form action={createOrder}>
            <Table headers={toOrderHeaders}>{toOrderRows}</Table>
            <p className="mt-4 text-xs text-slate-400">
              Cochez les demandes à inclure, renseignez si besoin le fournisseur et la référence,
              puis créez la commande.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Fournisseur" hint="Optionnel">
                <Input name="supplier" placeholder="Ex. Medisupply" />
              </Field>
              <Field label="Référence" hint="Optionnel">
                <Input name="reference" placeholder="N° de commande fournisseur" />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit">Créer la commande</Button>
            </div>
          </form>
        ) : (
          <Table headers={toOrderHeaders}>{toOrderRows}</Table>
        )}
      </Card>

      <Card title="Commandes">
        {orders.length === 0 ? (
          <EmptyState message="Aucune commande pour le moment." />
        ) : (
          <Table headers={orderHeaders}>
            {orders.map((order) => {
              const meta = ORDER_STATUS_META[order.status];
              return (
                <tr key={order.id} className="hover:bg-slate-50">
                  <Td>{formatDateFr(order.orderedAt)}</Td>
                  <Td>
                    <span className="font-medium text-slate-900">{order.supplier || "—"}</span>
                    {order.reference ? (
                      <span className="block text-xs text-slate-400">Réf. {order.reference}</span>
                    ) : null}
                  </Td>
                  <Td>{order._count.requests}</Td>
                  <Td>{order.amountCents != null ? formatEuros(order.amountCents) : "—"}</Td>
                  <Td>
                    <Badge color={meta.color}>{meta.label}</Badge>
                  </Td>
                  <Td>
                    {order.devisPath ? (
                      <a
                        href={`/api/stock/orders/${order.id}/devis`}
                        className="font-medium text-teal-700 underline-offset-2 hover:underline"
                      >
                        Devis
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                  {canManage ? (
                    <Td className="text-right">
                      {order.status === StockOrderStatus.COMMANDEE ? (
                        <LinkButton
                          href={`/stock/commandes/${order.id}`}
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                        >
                          Réceptionner
                        </LinkButton>
                      ) : order.status === StockOrderStatus.RECUE_A_PAYER ? (
                        <form action={markOrderPaid.bind(null, order.id)}>
                          <Button type="submit" variant="secondary" className="px-2.5 py-1 text-xs">
                            Marquer payée
                          </Button>
                        </form>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card title="Mes demandes">
        {myRequests.length === 0 ? (
          <EmptyState message="Vous n'avez pas encore déposé de demande." />
        ) : (
          <Table headers={["Article", "Qté", "Précisions", "Date", "Statut"]}>
            {myRequests.map((request) => {
              const meta = REQUEST_STATUS_META[request.status];
              return (
                <tr key={request.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">
                    {request.itemName}{" "}
                    {request.urgent ? <Badge color="red">Urgent</Badge> : null}
                  </Td>
                  <Td>{request.quantity}</Td>
                  <Td className="max-w-xs text-slate-500">{request.details || "—"}</Td>
                  <Td>{formatDateFr(request.createdAt)}</Td>
                  <Td>
                    <Badge color={meta.color}>{meta.label}</Badge>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
