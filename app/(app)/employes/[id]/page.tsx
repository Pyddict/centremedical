import { notFound } from "next/navigation";
import { DocumentType, LeaveStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDateFr, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { formatDays, fullName } from "@/lib/format";
import { DEFAULT_LEAVE_DAYS, DOCUMENT_TYPE_LABELS, ROLE_LABELS } from "@/lib/roles";
import { CopyButton } from "@/components/CopyButton";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  SuccessBanner,
  Table,
  Td,
  Textarea,
} from "@/components/ui";
import { RoleBadges } from "../RoleBadges";
import {
  deleteDocument,
  setLeaveBalance,
  updateAccess,
  updateEmployee,
  uploadDocument,
} from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fiche employé" };

/** Ligne label/valeur du mode lecture, avec bouton de copie si renseignée. */
function InfoRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  const shown = value && value.trim().length > 0 ? value : null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {shown ? (
          <p className={cn("mt-0.5 text-sm text-slate-900", multiline && "whitespace-pre-wrap")}>
            {shown}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-400">—</p>
        )}
      </div>
      {shown ? <CopyButton value={shown} label={label} /> : null}
    </div>
  );
}

/** Taille de fichier lisible ("245 Ko", "1,8 Mo"). */
function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fr-FR")} Ko`;
}

export default async function FicheEmployePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(Role.ADMIN);
  const { id } = await params;
  const sp = await searchParams;
  const editing = sp.edit === "1";
  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  const employee = await prisma.user.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      leaveBalances: true,
    },
  });
  if (!employee) notFound();

  const currentYear = todayDateOnly().getUTCFullYear();
  const years = [currentYear, currentYear + 1];

  const takenAgg = await prisma.leaveRequest.aggregate({
    _sum: { daysCount: true },
    where: {
      requesterId: employee.id,
      status: LeaveStatus.VALIDEE,
      startDate: {
        gte: new Date(Date.UTC(currentYear, 0, 1)),
        lt: new Date(Date.UTC(currentYear + 1, 0, 1)),
      },
    },
  });
  const takenDays = takenAgg._sum.daysCount ?? 0;

  const allocatedFor = (year: number): number =>
    employee.leaveBalances.find((b) => b.year === year)?.allocatedDays ?? DEFAULT_LEAVE_DAYS;
  const remainingDays = allocatedFor(currentYear) - takenDays;

  const infoRows: Array<{ label: string; value: string | null; multiline?: boolean }> = [
    { label: "Prénom", value: employee.firstName },
    { label: "Nom", value: employee.lastName },
    { label: "Email", value: employee.email },
    { label: "Téléphone", value: employee.phone },
    {
      label: "Date de naissance",
      value: employee.birthDate ? formatDateFr(employee.birthDate) : null,
    },
    { label: "Adresse", value: employee.address },
    { label: "N° de sécurité sociale", value: employee.socialSecurityNumber },
    { label: "Poste", value: employee.jobTitle },
    { label: "Type de contrat", value: employee.contractType },
    {
      label: "Date d'embauche",
      value: employee.hireDate ? formatDateFr(employee.hireDate) : null,
    },
    { label: "IBAN", value: employee.iban },
    { label: "Contact d'urgence", value: employee.emergencyContact },
    { label: "Notes", value: employee.notes, multiline: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName(employee) || employee.email}
        description={employee.jobTitle ?? "Fiche administrative de l'employé"}
        actions={
          <LinkButton href="/employes" variant="secondary">
            Tous les employés
          </LinkButton>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card
        title="Fiche administrative"
        actions={
          editing ? undefined : (
            <LinkButton href={`/employes/${employee.id}?edit=1`} variant="secondary">
              Modifier
            </LinkButton>
          )
        }
      >
        {editing ? (
          <form action={updateEmployee.bind(null, employee.id)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom">
                <Input name="firstName" defaultValue={employee.firstName} required maxLength={100} />
              </Field>
              <Field label="Nom">
                <Input name="lastName" defaultValue={employee.lastName} required maxLength={100} />
              </Field>
              <Field
                label="Email"
                hint="Doit correspondre exactement à l'email du compte Auth0 de l'employé."
                className="sm:col-span-2"
              >
                <Input
                  type="email"
                  name="email"
                  defaultValue={employee.email}
                  required
                  maxLength={200}
                />
              </Field>
              <Field label="Téléphone">
                <Input name="phone" defaultValue={employee.phone ?? ""} maxLength={50} />
              </Field>
              <Field label="Date de naissance">
                <Input
                  type="date"
                  name="birthDate"
                  defaultValue={employee.birthDate ? toDateOnlyString(employee.birthDate) : ""}
                />
              </Field>
              <Field label="Adresse" className="sm:col-span-2">
                <Input name="address" defaultValue={employee.address ?? ""} maxLength={300} />
              </Field>
              <Field label="N° de sécurité sociale">
                <Input
                  name="socialSecurityNumber"
                  defaultValue={employee.socialSecurityNumber ?? ""}
                  maxLength={50}
                />
              </Field>
              <Field label="Poste">
                <Input name="jobTitle" defaultValue={employee.jobTitle ?? ""} maxLength={150} />
              </Field>
              <Field label="Type de contrat">
                <Input
                  name="contractType"
                  defaultValue={employee.contractType ?? ""}
                  placeholder="CDI, CDD, titulaire…"
                  maxLength={100}
                />
              </Field>
              <Field label="Date d'embauche">
                <Input
                  type="date"
                  name="hireDate"
                  defaultValue={employee.hireDate ? toDateOnlyString(employee.hireDate) : ""}
                />
              </Field>
              <Field label="IBAN">
                <Input name="iban" defaultValue={employee.iban ?? ""} maxLength={50} />
              </Field>
              <Field label="Contact d'urgence">
                <Input
                  name="emergencyContact"
                  defaultValue={employee.emergencyContact ?? ""}
                  placeholder="Nom et téléphone"
                  maxLength={300}
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea name="notes" defaultValue={employee.notes ?? ""} maxLength={2000} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit">Enregistrer</Button>
              <LinkButton href={`/employes/${employee.id}`} variant="secondary">
                Annuler
              </LinkButton>
            </div>
          </form>
        ) : (
          <div className="divide-y divide-slate-100">
            {infoRows.map((row) => (
              <InfoRow
                key={row.label}
                label={row.label}
                value={row.value}
                multiline={row.multiline}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title={"Rôles & accès"}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <RoleBadges roles={employee.roles} />
          {!employee.active ? <Badge color="red">Désactivé</Badge> : null}
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Connexion Auth0 :{" "}
          {employee.auth0Sub ? (
            <span className="font-medium text-emerald-600">✔ déjà connecté</span>
          ) : (
            <span className="text-slate-400">jamais connecté</span>
          )}
        </p>
        <form action={updateAccess.bind(null, employee.id)} className="space-y-4">
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
                    defaultChecked={employee.roles.includes(role)}
                    className="h-4 w-4 rounded border-slate-300 accent-teal-700"
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="active"
              value="1"
              defaultChecked={employee.active}
              className="h-4 w-4 rounded border-slate-300 accent-teal-700"
            />
            Compte actif
          </label>
          <div>
            <Button type="submit" variant="secondary">
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Congés">
        <p className="mb-4 text-sm text-slate-600">
          {currentYear} : {formatDays(takenDays)} pris (validés) ·{" "}
          <span
            className={cn(
              "font-medium",
              remainingDays < 0 ? "text-red-600" : "text-teal-700"
            )}
          >
            {formatDays(remainingDays)} restants
          </span>
        </p>
        <div className="space-y-3">
          {years.map((year) => (
            <form
              key={year}
              action={setLeaveBalance.bind(null, employee.id, year)}
              className="flex flex-wrap items-end gap-3"
            >
              <Field label={`Jours alloués ${year}`} className="w-44">
                <Input
                  type="number"
                  name="allocatedDays"
                  step={0.5}
                  min={0}
                  max={365}
                  required
                  defaultValue={allocatedFor(year)}
                />
              </Field>
              <Button type="submit" variant="secondary">
                Enregistrer
              </Button>
            </form>
          ))}
        </div>
      </Card>

      <Card title="Documents">
        {employee.documents.length === 0 ? (
          <EmptyState message="Aucun document pour cet employé." />
        ) : (
          <Table headers={["Type", "Libellé", "Fichier", "Taille", "Ajouté le", "Actions"]}>
            {employee.documents.map((doc) => (
              <tr key={doc.id}>
                <Td className="whitespace-nowrap">{DOCUMENT_TYPE_LABELS[doc.type]}</Td>
                <Td className="max-w-56 font-medium text-slate-900">{doc.label}</Td>
                <Td className="max-w-56 break-all text-slate-600">{doc.fileName}</Td>
                <Td className="whitespace-nowrap text-slate-600">{formatFileSize(doc.size)}</Td>
                <Td className="whitespace-nowrap text-slate-600">
                  {formatDateFr(doc.createdAt)}
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/api/documents/${doc.id}`}
                      className="text-sm font-medium text-teal-700 hover:underline"
                    >
                      Télécharger
                    </a>
                    <form action={deleteDocument.bind(null, doc.id)}>
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

        <form
          action={uploadDocument.bind(null, employee.id)}
          className="mt-5 border-t border-slate-100 pt-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Ajouter un document</h3>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Type" className="w-48">
              <Select name="type" defaultValue={DocumentType.AUTRE}>
                {Object.values(DocumentType).map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Libellé (optionnel)" className="w-56">
              <Input name="label" maxLength={200} placeholder="Ex. : contrat 2026" />
            </Field>
            <Field label="Fichier" className="w-72">
              <Input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png" />
            </Field>
            <Button type="submit">Ajouter</Button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            PDF ou image (JPG, PNG), 15 Mo maximum. Sans libellé, le nom du type est utilisé.
          </p>
        </form>
      </Card>
    </div>
  );
}
