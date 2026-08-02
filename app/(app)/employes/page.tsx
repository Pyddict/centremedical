import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fullName } from "@/lib/format";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LinkButton,
  PageHeader,
  SuccessBanner,
  Table,
  Td,
} from "@/components/ui";
import { RoleBadges } from "./RoleBadges";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employés" };

export default async function EmployesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(Role.ADMIN);
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  const employees = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employés"
        description="Fiches administratives, rôles, congés et documents des employés du centre."
        actions={<LinkButton href="/employes/nouveau">Nouvel employé</LinkButton>}
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card>
        {employees.length === 0 ? (
          <EmptyState message="Aucun employé pour le moment." />
        ) : (
          <Table headers={["Employé", "Email", "Rôles", "Poste", "Téléphone", "Actions"]}>
            {employees.map((employee) => (
              <tr key={employee.id} className={employee.active ? undefined : "opacity-60"}>
                <Td className="whitespace-nowrap font-medium text-slate-900">
                  <span className="inline-flex items-center gap-2">
                    {fullName(employee) || employee.email}
                    {!employee.active ? <Badge color="red">Désactivé</Badge> : null}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-slate-600">{employee.email}</Td>
                <Td>
                  <RoleBadges roles={employee.roles} />
                </Td>
                <Td className="text-slate-600">
                  {employee.jobTitle ?? <span className="text-slate-400">—</span>}
                </Td>
                <Td className="whitespace-nowrap text-slate-600">
                  {employee.phone ?? <span className="text-slate-400">—</span>}
                </Td>
                <Td>
                  <LinkButton href={`/employes/${employee.id}`} variant="secondary">
                    Fiche
                  </LinkButton>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
