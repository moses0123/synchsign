import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  if (path === "/admin/login") return <>{children}</>;
  const s = await getAdminSession();
  // Token missing, expired, or the admin role was removed: clear the admin cookie and go to the login page
  if (!s) redirect("/api/admin/auth/logout?next=/admin/login");
  return <AdminShell user={{ name: s.name, email: s.email }} expiresAt={s.exp * 1000}>{children}</AdminShell>;
}
