import { LeaveStatus, type Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireUser } from "@/lib/session";
import { formatDateFr, todayDateOnly } from "@/lib/dates";
import { formatDays, fullName } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  StatCard,
  SuccessBanner,
  Table,
  Td,
  Textarea,
  type BadgeColor,
} from "@/components/ui";
import { LeaveRequestFields } from "./LeaveRequestFields";
import { getLeaveSummary, yearBoundsUTC, type LeaveSummary } from "./solde";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  rejectLeaveRequest,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Congés" };

const STATUS_BADGES: Record<LeaveStatus, { label: string; color: BadgeColor }> = {
  EN_ATTENTE: { label: "En attente", color: "amber" },
  VALIDEE: { label: "Validée", color: "green" },
  REFUSEE: { label: "Refusée", color: "red" },
  ANNULEE: { label: "Annulée", color: "gray" },
};

function StatusBadge({ status }: { status: LeaveStatus }) {
  const { label, color } = STATUS_BADGES[status];
  return <Badge color={color}>{label}</Badge>;
}

function PdfLink({ requestId }: { requestId: string }) {
  return (
    <a
      href={`/api/conges/${requestId}/bon`}
      className="text-sm font-medium text-teal-700 hover:underline"
    >
      Bon PDF
    </a>
  );
}

type PendingRow = {
  request: Prisma.LeaveRequestGetPayload<{ include: { requester: true } }>;
  remaining: number;
};

type ValidatedRequest = Prisma.LeaveRequestGetPayload<{
  include: { requester: true; decidedBy: true };
}>;

export default async function CongesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  const admin = isAdmin(user);
  const year = todayDateOnly().getUTCFullYear();

  const [summary, myRequests] = await Promise.all([
    getLeaveSummary(user.id, year),
    prisma.leaveRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      include: { decidedBy: true },
    }),
  ]);

  let pendingRows: PendingRow[] = [];
  let balanceRows: Array<{ employee: User; summary: LeaveSummary }> = [];
  let validatedRequests: ValidatedRequest[] = [];

  if (admin) {
    const [pending, activeUsers, validated] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { status: LeaveStatus.EN_ATTENTE },
        orderBy: { createdAt: "asc" },
        include: { requester: true },
      }),
      prisma.user.findMany({
        where: { active: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.leaveRequest.findMany({
        where: { status: LeaveStatus.VALIDEE, startDate: yearBoundsUTC(year) },
        orderBy: { startDate: "desc" },
        include: { requester: true, decidedBy: true },
      }),
    ]);

    [pendingRows, balanceRows] = await Promise.all([
      Promise.all(
        pending.map(async (request) => ({
          request,
          remaining: (
            await getLeaveSummary(request.requesterId, request.startDate.getUTCFullYear())
          ).remaining,
        }))
      ),
      Promise.all(
        activeUsers.map(async (employee) => ({
          employee,
          summary: await getLeaveSummary(employee.id, year),
        }))
      ),
    ]);
    validatedRequests = validated;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Congés"
        description="Vos demandes de congés, leur validation et votre solde annuel."
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <section aria-label={`Mon solde ${year}`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Mon solde {year}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Jours alloués" value={formatDays(summary.allocated)} />
          <StatCard label="Pris (validés)" value={formatDays(summary.taken)} />
          <StatCard label="En attente" value={formatDays(summary.pending)} />
          <StatCard
            label="Restants"
            value={formatDays(summary.remaining)}
            accent={summary.remaining < 0 ? "red" : "teal"}
          />
        </div>
      </section>

      <Card title="Nouvelle demande">
        <form action={createLeaveRequest} className="space-y-4">
          <LeaveRequestFields />
          <Field label="Motif (optionnel)">
            <Textarea
              name="reason"
              maxLength={1000}
              placeholder="Ex. : congés d'été, événement familial…"
            />
          </Field>
          <Button type="submit">Envoyer la demande</Button>
        </form>
      </Card>

      <Card title="Mes demandes">
        {myRequests.length === 0 ? (
          <EmptyState message="Vous n'avez pas encore de demande de congés." />
        ) : (
          <Table headers={["Période", "Jours", "Motif", "Statut", "Décision", "Actions"]}>
            {myRequests.map((request) => (
              <tr key={request.id}>
                <Td className="whitespace-nowrap">
                  {formatDateFr(request.startDate)} — {formatDateFr(request.endDate)}
                </Td>
                <Td className="whitespace-nowrap">{formatDays(request.daysCount)}</Td>
                <Td className="max-w-64 text-slate-600">{request.reason ?? "—"}</Td>
                <Td>
                  <StatusBadge status={request.status} />
                </Td>
                <Td>
                  {request.decidedAt ? (
                    <div className="text-xs text-slate-600">
                      <p>
                        {request.decidedBy ? fullName(request.decidedBy) : "—"} ·{" "}
                        {formatDateFr(request.decidedAt)}
                      </p>
                      {request.decisionComment ? (
                        <p className="mt-0.5 text-slate-500">« {request.decisionComment} »</p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Td>
                <Td>
                  {request.status === LeaveStatus.EN_ATTENTE ? (
                    <form action={cancelLeaveRequest.bind(null, request.id)}>
                      <Button type="submit" variant="secondary">
                        Annuler
                      </Button>
                    </form>
                  ) : request.status === LeaveStatus.VALIDEE ? (
                    <PdfLink requestId={request.id} />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {admin ? (
        <>
          <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Administration
          </h2>

          <Card title="Demandes en attente">
            {pendingRows.length === 0 ? (
              <EmptyState message="Aucune demande de congés en attente." />
            ) : (
              <Table
                headers={["Employé", "Période", "Jours", "Motif", "Solde restant", "Décision"]}
              >
                {pendingRows.map(({ request, remaining }) => (
                  <tr key={request.id}>
                    <Td className="whitespace-nowrap font-medium text-slate-900">
                      {fullName(request.requester)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDateFr(request.startDate)} — {formatDateFr(request.endDate)}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDays(request.daysCount)}</Td>
                    <Td className="max-w-56 text-slate-600">{request.reason ?? "—"}</Td>
                    <Td
                      className={
                        remaining < 0
                          ? "whitespace-nowrap font-medium text-red-600"
                          : "whitespace-nowrap"
                      }
                    >
                      {formatDays(remaining)}
                    </Td>
                    <Td>
                      <form className="flex flex-wrap items-center gap-2">
                        {/*
                          Bouton par défaut désactivé : la touche Entrée dans le champ
                          commentaire ne doit pas valider la demande à l'insu de
                          l'administrateur — la décision passe par un clic explicite.
                        */}
                        <button type="submit" disabled hidden aria-hidden tabIndex={-1} />
                        <Input
                          name="comment"
                          placeholder="Commentaire (optionnel)"
                          maxLength={500}
                          className="w-52"
                        />
                        <button
                          type="submit"
                          formAction={approveLeaveRequest.bind(null, request.id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                        >
                          Valider
                        </button>
                        <Button
                          type="submit"
                          variant="danger"
                          formAction={rejectLeaveRequest.bind(null, request.id)}
                        >
                          Refuser
                        </Button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title={`Soldes des employés (${year})`}>
            {balanceRows.length === 0 ? (
              <EmptyState message="Aucun employé actif." />
            ) : (
              <Table headers={["Employé", "Rôles", "Alloués", "Pris", "En attente", "Restants"]}>
                {balanceRows.map(({ employee, summary: s }) => (
                  <tr key={employee.id}>
                    <Td className="whitespace-nowrap font-medium text-slate-900">
                      {fullName(employee)}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {employee.roles.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          employee.roles.map((role) => (
                            <Badge key={role} color={role === "ADMIN" ? "violet" : "blue"}>
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))
                        )}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDays(s.allocated)}</Td>
                    <Td className="whitespace-nowrap">{formatDays(s.taken)}</Td>
                    <Td className="whitespace-nowrap">{formatDays(s.pending)}</Td>
                    <Td
                      className={
                        s.remaining < 0
                          ? "whitespace-nowrap font-semibold text-red-600"
                          : "whitespace-nowrap font-semibold text-teal-700"
                      }
                    >
                      {formatDays(s.remaining)}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Les jours alloués se règlent dans la fiche employé.
            </p>
          </Card>

          <Card title={`Congés validés ${year}`}>
            {validatedRequests.length === 0 ? (
              <EmptyState message={`Aucun congé validé pour ${year}.`} />
            ) : (
              <Table headers={["Employé", "Période", "Jours", "Validé par", "Bon"]}>
                {validatedRequests.map((request) => (
                  <tr key={request.id}>
                    <Td className="whitespace-nowrap font-medium text-slate-900">
                      {fullName(request.requester)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDateFr(request.startDate)} — {formatDateFr(request.endDate)}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDays(request.daysCount)}</Td>
                    <Td className="text-slate-600">
                      {request.decidedBy ? fullName(request.decidedBy) : "—"}
                      {request.decidedAt ? `, le ${formatDateFr(request.decidedAt)}` : ""}
                    </Td>
                    <Td>
                      <PdfLink requestId={request.id} />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Ces bons sont à transmettre au service de paie.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
