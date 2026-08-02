import type { Role } from "@prisma/client";
import { Badge, type BadgeColor } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/roles";

const ROLE_BADGE_COLORS: Record<Role, BadgeColor> = {
  ADMIN: "violet",
  MEDECIN: "teal",
  ASSISTANTE: "blue",
};

/** Badges colorés des rôles d'un employé (violet/teal/bleu). */
export function RoleBadges({ roles }: { roles: Role[] }) {
  if (roles.length === 0) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} color={ROLE_BADGE_COLORS[role]}>
          {ROLE_LABELS[role]}
        </Badge>
      ))}
    </div>
  );
}
