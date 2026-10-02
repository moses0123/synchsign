"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, LogOut, Gauge, Mail, Palette, ScrollText, SlidersHorizontal, Users, Files } from "lucide-react";
import { LogoMark } from "../logo";
import { Avatar } from "../ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/email", label: "Email (SMTP)", icon: Mail },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/envelopes", label: "Envelopes", icon: Files },
  { href: "/admin/policies", label: "Signing & access", icon: SlidersHorizontal },
  { href: "/admin/branding", label: "Branding", icon: Palette },
  { href: "/admin/logs", label: "Email log", icon: ScrollText },
];

export function AdminShell({ user, children, expiresAt }: { user: { name: string; email: string }; children: React.ReactNode; expiresAt: number }) {
  const path = usePathname();
  const router = useRouter();
  async function signOut() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login"); router.refresh();
  }
  // Send the admin back to the login page when the 8-hour session runs out
  useEffect(() => {
    const ms = expiresAt - Date.now();
    const t = setTimeout(() => { router.replace("/admin/login?expired=1"); router.refresh(); }, Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(t);
  }, [expiresAt, router]);
  const on = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href));
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <LogoMark className="h-8 w-8" />
          <div className="leading-tight"><p className="font-display text-sm font-bold">SyncSign</p><p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Admin portal</p></div>
        </div>
        <nav className="mt-7 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => (
            <Link key={href} href={href} className={cn("relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", on(href, exact) ? "text-sky-700 dark:text-sky-300" : "text-muted hover:bg-surface-2 hover:text-ink")}>
              {on(href, exact) && <motion.span layoutId="admin-pill" className="absolute inset-0 -z-10 rounded-lg bg-sky-500/10" transition={{ type: "spring", damping: 32, stiffness: 400 }} />}
              <Icon className="h-[18px] w-[18px]" />{label}
            </Link>
          ))}
        </nav>
        <Link href="/app" className="mt-auto mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink"><ArrowLeft className="h-[18px] w-[18px]" />Back to app</Link>
        <div className="flex items-center gap-3 rounded-lg border border-line p-2.5">
          <Avatar name={user.name} size={32} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted">Administrator</p></div>
          <button onClick={signOut} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-rose-500" title="Sign out of admin portal" aria-label="Sign out of admin portal"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <header className="glass sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2"><LogoMark className="h-7 w-7" /><span className="font-display text-sm font-bold">Admin portal</span></div>
          <div className="flex items-center gap-3"><Link href="/app" className="text-sm font-medium text-sky-700 dark:text-sky-400">Back to app</Link><button onClick={signOut} className="text-muted" aria-label="Sign out of admin portal"><LogOut className="h-4 w-4" /></button></div>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label, exact }) => (
            <Link key={href} href={href} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium", on(href, exact) ? "bg-ink text-surface" : "text-muted")}>{label}</Link>
          ))}
        </nav>
      </header>

      <main className="lg:pl-60">
        <motion.div key={path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
          {children}
        </motion.div>
      </main>
    </div>
  );
}
