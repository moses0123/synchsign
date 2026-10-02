"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookUser, FilePlus2, FileStack, FileUp, LayoutGrid, LayoutTemplate, LogOut, PenLine, Plus, Settings, ShieldCheck, ShieldHalf,
} from "lucide-react";
import { Logo, LogoMark } from "./logo";
import { Avatar, Button, Modal } from "./ui";
import { InstallPrompt } from "./install-prompt";
import { NotificationBell } from "./notifications";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/app/documents", label: "Envelopes", icon: FileStack },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/contacts", label: "Contacts", icon: BookUser },
  { href: "/verify", label: "Verify", icon: ShieldCheck },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const CREATE = [
  { href: "/app/new", icon: FileUp, t: "Upload a PDF", d: "Send an existing document for signature" },
  { href: "/app/templates?tab=library", icon: FilePlus2, t: "Create a document", d: "Write one here, from a template or blank" },
  { href: "/app/new?self=1", icon: PenLine, t: "Sign it myself", d: "Only you need to sign" },
  { href: "/app/templates?tab=envelopes", icon: LayoutTemplate, t: "Use an envelope template", d: "Reuse saved recipients and fields" },
];

export function AppShell({ user, children, isAdmin = false }: { user: { name: string; email: string }; children: React.ReactNode; isAdmin?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const active = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href));
  const focusMode = /\/app\/envelopes\/[^/]+\/edit/.test(path) || /\/app\/templates\/documents\/[^/]+/.test(path);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }

  return (
    <div className="min-h-dvh">
      {!focusMode && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
          <div className="flex items-center justify-between px-2">
            <Logo href="/app" />
            <NotificationBell align="left" />
          </div>
          <Button className="mt-6 w-full" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />New</Button>
          <nav className="mt-6 flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon, exact }) => (
              <Link key={href} href={href}
                className={cn("relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active(href, exact) ? "text-sky-700 dark:text-sky-300" : "text-muted hover:bg-surface-2 hover:text-ink")}>
                {active(href, exact) && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-lg bg-sky-500/10" transition={{ type: "spring", damping: 32, stiffness: 400 }} />}
                <Icon className="h-[18px] w-[18px]" />{label}
              </Link>
            ))}
          </nav>
          {isAdmin && (
            <Link href="/admin" className="mt-auto mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink">
              <ShieldHalf className="h-[18px] w-[18px]" />Admin portal
            </Link>
          )}
          <div className={cn("flex items-center gap-3 rounded-lg border border-line p-2.5", !isAdmin && "mt-auto")}>
            <Avatar name={user.name} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <button onClick={logout} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-rose-500" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </aside>
      )}

      {!focusMode && (
        <header className="glass sticky top-0 z-40 flex items-center justify-between border-b border-line px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.625rem)] lg:hidden">
          <Link href="/app" className="flex items-center gap-2 font-display font-bold"><LogoMark className="h-7 w-7" /><span>Sync<span className="text-sky-600 dark:text-sky-400">Sign</span></span></Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Link href="/app/settings" className="ml-1"><Avatar name={user.name} size={32} /></Link>
          </div>
        </header>
      )}

      <main className={cn(!focusMode && "lg:pl-60", !focusMode && "pb-24 lg:pb-10")}>{children}</main>

      {!focusMode && (
        <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pt-1">
            {[NAV[0]!, NAV[1]!].map(({ href, label, icon: Icon, exact }) => <Tab key={href} href={href} label={label} Icon={Icon} on={active(href, exact)} />)}
            <button onClick={() => setCreateOpen(true)} className="flex flex-col items-center py-1" aria-label="New">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-600 text-white shadow-sm active:bg-sky-700"><Plus className="h-6 w-6" /></span>
            </button>
            {[NAV[2]!, NAV[3]!].map(({ href, label, icon: Icon, exact }) => <Tab key={href} href={href} label={label} Icon={Icon} on={active(href, exact)} />)}
          </div>
        </nav>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Start something new">
        <div className="grid gap-2 pb-1">
          {CREATE.map((c) => (
            <Link key={c.href} href={c.href} onClick={() => setCreateOpen(false)}
              className="flex items-center gap-3.5 rounded-lg border border-line p-3.5 transition-colors hover:border-sky-300 hover:bg-surface-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400"><c.icon className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold">{c.t}</span><span className="block text-xs text-muted">{c.d}</span></span>
            </Link>
          ))}
        </div>
      </Modal>
      <InstallPrompt />
    </div>
  );
}

function Tab({ href, label, Icon, on }: { href: string; label: string; Icon: typeof Plus; on: boolean }) {
  return (
    <Link href={href} className={cn("relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium", on ? "text-sky-700 dark:text-sky-300" : "text-muted")}>
      <Icon className="h-[21px] w-[21px]" />{label}
    </Link>
  );
}
