import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getCurrentUser } from "@/lib/session";
import { fullName } from "@/lib/format";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    const session = await auth0().getSession();
    redirect(session ? "/non-autorise" : "/auth/login");
  }

  return (
    <AppShell
      centerName={process.env.CENTER_NAME || "Centre Médical"}
      userName={fullName(user)}
      roles={user.roles}
    >
      {children}
    </AppShell>
  );
}
