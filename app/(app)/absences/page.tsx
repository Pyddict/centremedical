import Link from "next/link";
import { AbsenceType, LeaveStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasRole, isAdmin, requireUser } from "@/lib/session";
import {
  addDaysUTC,
  dayInRange,
  formatDateFr,
  formatDateLongFr,
  isWeekendUTC,
  monthLabelFr,
  parseDateOnly,
  toDateOnlyString,
  todayDateOnly,
} from "@/lib/dates";
import { fullName } from "@/lib/format";
import { ABSENCE_TYPE_LABELS, ROLE_LABELS } from "@/lib/roles";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Select,
  SuccessBanner,
  Table,
  Td,
  cn,
  type BadgeColor,
} from "@/components/ui";
import { createAbsence, deleteAbsence } from "./actions";
import {
  buildUnavailabilityIntervals,
  computeDayPresence,
  monthBoundsUTC,
  monthDaysUTC,
  monthKey,
  parseMonthParam,
  shiftMonth,
  type MonthRef,
} from "./presence";

export const dynamic = "force-dynamic";

export const metadata = { title: "Absences & présence" };

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const ROLE_BADGE_COLORS: Record<Role, BadgeColor> = {
  ADMIN: "violet",
  MEDECIN: "teal",
  ASSISTANTE: "blue",
};

const ABSENCE_TYPE_BADGE_COLORS: Record<AbsenceType, BadgeColor> = {
  VACANCES: "teal",
  FORMATION: "blue",
  CONGRES: "violet",
  MALADIE: "red",
  AUTRE: "gray",
};

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 shrink-0 rounded", className)} aria-hidden />
      {label}
    </span>
  );
}

export default async function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  const today = todayDateOnly();
  const todayKey = toDateOnlyString(today);
  const currentMonth: MonthRef = { year: today.getUTCFullYear(), month0: today.getUTCMonth() };
  const month = parseMonthParam(typeof sp.mois === "string" ? sp.mois : null) ?? currentMonth;
  const moisKey = monthKey(month);
  const { first, last } = monthBoundsUTC(month);

  // Jour sélectionné : uniquement s'il appartient au mois affiché.
  const jourRaw = parseDateOnly(typeof sp.jour === "string" ? sp.jour : null);
  const selectedDay = jourRaw && dayInRange(jourRaw, first, last) ? jourRaw : null;

  const admin = isAdmin(user);
  const canDeclare = hasRole(user, Role.MEDECIN);

  const [activeUsers, monthAbsences, monthLeaves, myAbsences, upcomingAbsences] =
    await Promise.all([
      prisma.user.findMany({
        where: { active: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true, roles: true },
      }),
      prisma.absence.findMany({
        where: { startDate: { lte: last }, endDate: { gte: first } },
      }),
      prisma.leaveRequest.findMany({
        where: { status: LeaveStatus.VALIDEE, startDate: { lte: last }, endDate: { gte: first } },
        select: { requesterId: true, startDate: true, endDate: true },
      }),
      prisma.absence.findMany({
        where: { userId: user.id, endDate: { gte: addDaysUTC(today, -60) } },
        orderBy: { startDate: "asc" },
      }),
      admin
        ? prisma.absence.findMany({
            where: { startDate: { gte: today } },
            orderBy: { startDate: "asc" },
            include: { user: true },
          })
        : Promise.resolve([] as Prisma.AbsenceGetPayload<{ include: { user: true } }>[]),
    ]);

  const intervals = buildUnavailabilityIntervals(monthAbsences, monthLeaves);
  const days = monthDaysUTC(month);
  const leadingBlanks = (first.getUTCDay() + 6) % 7; // lundi = colonne 1
  const detail = selectedDay ? computeDayPresence(selectedDay, activeUsers, intervals) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absences & présence"
        description="Déclaration des absences des médecins et calendrier de présence du cabinet."
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {canDeclare ? (
        <Card title="Déclarer une absence">
          <form action={createAbsence} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Date de début">
                <Input type="date" name="startDate" required />
              </Field>
              <Field label="Date de fin">
                <Input type="date" name="endDate" required />
              </Field>
              <Field label="Type">
                <Select name="type" defaultValue={AbsenceType.VACANCES} required>
                  {Object.entries(ABSENCE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Note (optionnel)">
                <Input name="note" maxLength={500} placeholder="Ex. : joignable par téléphone…" />
              </Field>
            </div>
            <Button type="submit">Déclarer l'absence</Button>
          </form>
        </Card>
      ) : null}

      <Card
        title={`Calendrier ${monthLabelFr(month.year, month.month0)}`}
        actions={
          <nav className="flex items-center gap-1 text-sm" aria-label="Navigation du calendrier">
            <Link
              href={`?mois=${monthKey(shiftMonth(month, -1))}`}
              className="rounded-md px-2 py-1 font-medium text-teal-700 hover:bg-teal-50"
            >
              ← Mois précédent
            </Link>
            <Link
              href={`?mois=${monthKey(currentMonth)}`}
              className="rounded-md px-2 py-1 font-medium text-teal-700 hover:bg-teal-50"
            >
              Aujourd'hui
            </Link>
            <Link
              href={`?mois=${monthKey(shiftMonth(month, 1))}`}
              className="rounded-md px-2 py-1 font-medium text-teal-700 hover:bg-teal-50"
            >
              Mois suivant →
            </Link>
          </nav>
        }
      >
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_HEADERS.map((label) => (
            <div
              key={label}
              className="px-1 pb-1 text-center text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              {label}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`vide-${i}`} />
          ))}
          {days.map((day) => {
            const presence = computeDayPresence(day, activeUsers, intervals);
            const dayStr = toDateOnlyString(day);
            const weekend = isWeekendUTC(day);
            const noDoctor = !weekend && presence.presentDoctors.length === 0;
            const hasAbsent = presence.absents.length > 0;
            const isToday = dayStr === todayKey;
            const isSelected = selectedDay !== null && toDateOnlyString(selectedDay) === dayStr;
            const absentOthersCount = presence.absents.filter(
              ({ user: u }) => !u.roles.includes(Role.MEDECIN)
            ).length;

            return (
              <Link
                key={dayStr}
                href={`?mois=${moisKey}&jour=${dayStr}`}
                className={cn(
                  "flex min-h-[4.5rem] flex-col rounded-lg p-1.5 transition-colors",
                  weekend
                    ? "bg-slate-50 text-slate-300"
                    : noDoctor
                      ? "bg-red-100"
                      : isSelected
                        ? "bg-teal-50"
                        : hasAbsent
                          ? "bg-amber-50 hover:bg-amber-100"
                          : "bg-white hover:bg-slate-50",
                  isSelected
                    ? "border-2 border-teal-400"
                    : noDoctor
                      ? "border border-red-300"
                      : "border border-slate-200",
                  isToday && "ring-2 ring-teal-500"
                )}
              >
                <span className={cn("text-xs font-semibold", !weekend && "text-slate-700")}>
                  {day.getUTCDate()}
                </span>
                <span
                  className={cn(
                    "mt-auto text-xs",
                    !weekend && (noDoctor ? "font-bold text-red-600" : "text-slate-500")
                  )}
                >
                  {presence.presentDoctors.length} méd.
                </span>
                {!weekend && absentOthersCount > 0 ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-700">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                    {absentOthersCount} abs.
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <LegendSwatch
            className="border border-red-300 bg-red-100"
            label="Aucun médecin présent"
          />
          <LegendSwatch className="border border-slate-200 bg-amber-50" label="Au moins un absent" />
          <LegendSwatch className="border border-slate-200 bg-white" label="Effectif complet" />
          <LegendSwatch className="border border-slate-200 bg-slate-50" label="Week-end" />
        </div>
      </Card>

      {selectedDay && detail ? (
        <Card title={`Détail du ${formatDateLongFr(selectedDay)}`}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Absents ({detail.absents.length})
              </h3>
              {detail.absents.length === 0 ? (
                <EmptyState message="Aucun absent ce jour-là." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {detail.absents.map(({ user: u, reason }) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-900">{fullName(u)}</span>
                      <span className="text-slate-500">{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Présents ({detail.presentDoctors.length + detail.presentOthers.length})
              </h3>
              {detail.presentDoctors.length + detail.presentOthers.length === 0 ? (
                <EmptyState message="Personne n'est présent ce jour-là." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...detail.presentDoctors, ...detail.presentOthers].map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-900">{fullName(u)}</span>
                      <span className="flex flex-wrap justify-end gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          u.roles.map((role) => (
                            <Badge key={role} color={ROLE_BADGE_COLORS[role]}>
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="Mes absences">
        {myAbsences.length === 0 ? (
          <EmptyState message="Aucune absence récente ou à venir." />
        ) : (
          <Table headers={["Période", "Type", "Note", "Actions"]}>
            {myAbsences.map((absence) => (
              <tr key={absence.id}>
                <Td className="whitespace-nowrap">
                  {formatDateFr(absence.startDate)} — {formatDateFr(absence.endDate)}
                </Td>
                <Td>
                  <Badge color={ABSENCE_TYPE_BADGE_COLORS[absence.type]}>
                    {ABSENCE_TYPE_LABELS[absence.type]}
                  </Badge>
                </Td>
                <Td className="max-w-64 text-slate-600">{absence.note ?? "—"}</Td>
                <Td>
                  <form action={deleteAbsence.bind(null, absence.id)}>
                    <Button type="submit" variant="secondary">
                      Supprimer
                    </Button>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Vos absences en cours, à venir, ou terminées depuis moins de 60 jours.
        </p>

        {admin ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Toutes les absences à venir
            </h3>
            {upcomingAbsences.length === 0 ? (
              <EmptyState message="Aucune absence à venir." />
            ) : (
              <Table headers={["Employé", "Période", "Type", "Note", "Actions"]}>
                {upcomingAbsences.map((absence) => (
                  <tr key={absence.id}>
                    <Td className="whitespace-nowrap font-medium text-slate-900">
                      {fullName(absence.user)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDateFr(absence.startDate)} — {formatDateFr(absence.endDate)}
                    </Td>
                    <Td>
                      <Badge color={ABSENCE_TYPE_BADGE_COLORS[absence.type]}>
                        {ABSENCE_TYPE_LABELS[absence.type]}
                      </Badge>
                    </Td>
                    <Td className="max-w-64 text-slate-600">{absence.note ?? "—"}</Td>
                    <Td>
                      <form action={deleteAbsence.bind(null, absence.id)}>
                        <Button type="submit" variant="secondary">
                          Supprimer
                        </Button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
