"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/components/ui";

type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Tableau de bord", icon: "🏠" },
  { href: "/stock", label: "Stock & commandes", icon: "📦" },
  { href: "/conges", label: "Congés", icon: "🌴" },
  { href: "/absences", label: "Absences & présence", icon: "📅" },
  { href: "/couts", label: "Coûts récurrents", icon: "💶", adminOnly: true },
  { href: "/employes", label: "Employés", icon: "👥", adminOnly: true },
];

export function AppShell({
  centerName,
  userName,
  roles,
  children,
}: {
  centerName: string;
  userName: string;
  roles: Role[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = roles.includes("ADMIN");
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-lg font-bold text-white">
            +
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{centerName}</p>
            <p className="text-xs text-slate-400">Gestion RH</p>
          </div>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-slate-100 px-5 py-4 md:block">
          <p className="truncate text-sm font-medium text-slate-800">{userName}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {roles.map((r) => ROLE_LABELS[r]).join(" · ") || "Aucun rôle"}
          </p>
          <a
            href="/auth/logout"
            className="mt-2 inline-block text-xs font-medium text-slate-500 underline-offset-2 hover:text-red-600 hover:underline"
          >
            Se déconnecter
          </a>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-2 md:hidden">
          <span className="text-sm text-slate-600">{userName}</span>
          <a href="/auth/logout" className="text-xs text-slate-500 underline">
            Déconnexion
          </a>
        </header>
        <main className="mx-auto w-full max-w-6xl p-6">{children}</main>
      </div>
    </div>
  );
}
