import { redirect } from "next/navigation";
import { getSession, isDisabled } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { AppShell } from "@/components/app-shell";
import { Suspended } from "@/components/suspended";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (await isDisabled(s.uid)) return <Suspended />;
  const admin = await isAdmin(s.uid, s.email);
  return <AppShell user={{ name: s.name, email: s.email }} isAdmin={admin}>{children}</AppShell>;
}
