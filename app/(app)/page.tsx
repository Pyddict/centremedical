import { LeaveStatus, Role, StockOrderStatus, StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole, isAdmin } from "@/lib/session";
import {
  addDaysUTC,
  dayInRange,
  formatDateFr,
  formatDateLongFr,
  isWeekendUTC,
  todayDateOnly,
} from "@/lib/dates";
import { formatDays, formatEuros, fullName } from "@/lib/format";
import {
  ABSENCE_TYPE_LABELS,
  COST_FREQUENCY_PER_YEAR,
  DEFAULT_LEAVE_DAYS,
} from "@/lib/roles";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
  type BadgeColor,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  EN_ATTENTE: "En attente",
  VALIDEE: "Validée",
  REFUSEE: "Refusée",
  ANNULEE: "Annulée",
};

const LEAVE_STATUS_COLORS: Record<LeaveStatus, BadgeColor> = {
  EN_ATTENTE: "amber",
  VALIDEE: "green",
  REFUSEE: "red",
  ANNULEE: "gray",
};

type UpcomingEntry = {
  key: string;
  userName: string;
  startDate: Date;
  endDate: Date;
  label: string;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const canSeeOrders = hasRole(user, Role.ASSISTANTE);

  const today = todayDateOnly();
  const windowEnd = addDaysUTC(today, 30);
  const year = today.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

  const [
    balance,
    myValidatedAgg,
    pendingLeavesCount,
    stockToOrderCount,
    ordersToPayCount,
    medecins,
    windowAbsences,
    windowLeaves,
    activeCosts,
    myRecentLeaves,
  ] = await Promise.all([
    prisma.leaveBalance.findUnique({
      where: { userId_year: { userId: user.id, year } },
    }),
    prisma.leaveRequest.aggregate({
      _sum: { daysCount: true },
      where: {
        requesterId: user.id,
        status: LeaveStatus.VALIDEE,
        startDate: { gte: yearStart, lt: nextYearStart },
      },
    }),
    admin
      ? prisma.leaveRequest.count({ where: { status: LeaveStatus.EN_ATTENTE } })
      : Promise.resolve(0),
    prisma.stockRequest.count({ where: { status: StockRequestStatus.A_COMMANDER } }),
    canSeeOrders
      ? prisma.stockOrder.count({ where: { status: StockOrderStatus.RECUE_A_PAYER } })
      : Promise.resolve(0),
    prisma.user.findMany({
      where: { active: true, roles: { has: Role.MEDECIN } },
      select: { id: true },
    }),
    prisma.absence.findMany({
      where: { startDate: { lte: windowEnd }, endDate: { gte: today } },
      orderBy: { startDate: "asc" },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.VALIDEE,
        startDate: { lte: windowEnd },
        endDate: { gte: today },
      },
      orderBy: { startDate: "asc" },
      include: { requester: { select: { firstName: true, lastName: true } } },
    }),
    admin
      ? prisma.recurringCost.findMany({
          where: { active: true },
          select: { amountCents: true, frequency: true },
        })
      : Promise.resolve([]),
    prisma.leaveRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Mes congés restants sur l'année en cours.
  const allocatedDays = balance?.allocatedDays ?? DEFAULT_LEAVE_DAYS;
  const remainingDays = allocatedDays - (myValidatedAgg._sum.daysCount ?? 0);

  // Médecins présents aujourd'hui.
  const medecinIds = new Set(medecins.map((m) => m.id));
  const absentTodayIds = new Set<string>();
  for (const a of windowAbsences) {
    if (medecinIds.has(a.userId) && dayInRange(today, a.startDate, a.endDate)) {
      absentTodayIds.add(a.userId);
    }
  }
  for (const l of windowLeaves) {
    if (medecinIds.has(l.requesterId) && dayInRange(today, l.startDate, l.endDate)) {
      absentTodayIds.add(l.requesterId);
    }
  }
  const totalMedecins = medecinIds.size;
  const presentMedecins = totalMedecins - absentTodayIds.size;
  const noDoctorOnBusinessDay = presentMedecins === 0 && !isWeekendUTC(today);

  // Charges mensuelles (coûts récurrents actifs ramenés au mois).
  const monthlyCostCents = Math.round(
    activeCosts.reduce(
      (sum, c) => sum + c.amountCents * COST_FREQUENCY_PER_YEAR[c.frequency],
      0
    ) / 12
  );

  // Prochaines absences : absences + congés validés fusionnés sur 30 jours.
  const upcoming: UpcomingEntry[] = [
    ...windowAbsences.map((a) => ({
      key: `abs-${a.id}`,
      userName: fullName(a.user),
      startDate: a.startDate,
      endDate: a.endDate,
      label: ABSENCE_TYPE_LABELS[a.type],
    })),
    ...windowLeaves.map((l) => ({
      key: `leave-${l.id}`,
      userName: fullName(l.requester),
      startDate: l.startDate,
      endDate: l.endDate,
      label: "Congé validé",
    })),
  ]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title={`Bonjour ${user.firstName}`}
        description={`Vue d'ensemble du cabinet — ${formatDateLongFr(today)}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Mes congés restants"
          value={formatDays(remainingDays)}
          href="/conges"
          accent="teal"
        />
        {admin ? (
          <StatCard
            label="Congés à valider"
            value={pendingLeavesCount}
            href="/conges"
            accent={pendingLeavesCount > 0 ? "amber" : "slate"}
          />
        ) : null}
        <StatCard label="Articles à commander" value={stockToOrderCount} href="/stock" />
        {canSeeOrders ? (
          <StatCard
            label="Commandes à payer"
            value={ordersToPayCount}
            href="/stock"
            accent={ordersToPayCount > 0 ? "amber" : "slate"}
          />
        ) : null}
        <StatCard
          label="Médecins présents aujourd'hui"
          value={`${presentMedecins} / ${totalMedecins}`}
          href="/absences"
          accent={noDoctorOnBusinessDay ? "red" : "slate"}
        />
        {admin ? (
          <StatCard
            label="Charges mensuelles"
            value={formatEuros(monthlyCostCents)}
            href="/couts"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Prochaines absences (30 jours)">
          {upcoming.length === 0 ? (
            <EmptyState message="Personne d'absent dans les 30 prochains jours." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((entry) => (
                <li
                  key={entry.key}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{entry.userName}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateFr(entry.startDate)} — {formatDateFr(entry.endDate)}
                    </p>
                  </div>
                  <Badge color={entry.label === "Congé validé" ? "green" : "blue"}>
                    {entry.label}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Mes dernières demandes de congés"
          actions={
            <LinkButton href="/conges" variant="secondary">
              Faire une demande
            </LinkButton>
          }
        >
          {myRecentLeaves.length === 0 ? (
            <EmptyState message="Vous n'avez encore fait aucune demande de congés." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {myRecentLeaves.map((leave) => (
                <li
                  key={leave.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDateFr(leave.startDate)} — {formatDateFr(leave.endDate)}
                    </p>
                    <p className="text-xs text-slate-500">{formatDays(leave.daysCount)}</p>
                  </div>
                  <Badge color={LEAVE_STATUS_COLORS[leave.status]}>
                    {LEAVE_STATUS_LABELS[leave.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
