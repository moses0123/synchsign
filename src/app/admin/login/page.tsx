import { getSession } from "@/lib/auth";
import { AdminLoginForm } from "@/components/admin/login-form";

export const metadata = { title: "Admin sign in" };

export default async function AdminLogin() {
  const s = await getSession();
  return <AdminLoginForm defaultEmail={s?.email ?? ""} />;
}
