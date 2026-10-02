"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Clock, HardDrive, Loader2, Mail, PlayCircle, Users, Files, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Skeleton, api } from "@/components/ui";
import { PageHeader, Section } from "@/components/admin/kit";
import { fmtDate, timeAgo } from "@/lib/utils";

interface Overview {
  users: { total: number; admins: number; suspended: number; activeWeek: number };
  envelopes: { total: number; completedMonth: number; sent?: number; completed?: number; draft?: number; declined?: number; voided?: number; expired?: number };
  documents: number; templates: number;
  storage: { bytes: number; files: number };
  mail: { configured: boolean; source: "portal" | "env" | null; host: string | null; week: Record<string, number> };
  jobs: { reminded: number; expired: number; checked: number; at: string; trigger: string } | null;
  appUrl: string | null; cronProtected: boolean;
}

const bytes = (b: number) => b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} KB` : b < 1024 ** 3 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${(b / 1024 ** 3).toFixed(2)} GB`;

export default function AdminOverview() {
  const [o, setO] = useState<Overview | null>(null);
  const [running, setRunning] = useState(false);
  const load = () => api<Overview>("/api/admin/overview").then(setO).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  async function runJobs() {
    setRunning(true);
    try { const r = await api<{ reminded: number; expired: number }>("/api/admin/jobs", { method: "POST" }); toast.success(`Sent ${r.reminded} reminder${r.reminded === 1 ? "" : "s"}, expired ${r.expired} envelope${r.expired === 1 ? "" : "s"}`); load(); }
    catch (e) { toast.error((e as Error).message); }
    setRunning(false);
  }

  if (!o) return <><PageHeader title="Overview" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div></>;

  const localUrl = !o.appUrl || /localhost|127\.0\.0\.1/.test(o.appUrl);
  const checks = [
    { ok: o.mail.configured, title: "Email delivery", body: o.mail.configured ? `Sending via ${o.mail.host}${o.mail.source === "env" ? " (from .env)" : ""}` : "Not configured — recipients won't receive invitations.", href: "/admin/email", cta: "Set up email" },
    { ok: !localUrl, title: "Public app URL", body: localUrl ? `APP_URL is ${o.appUrl ?? "not set"}. Links in emails will only work on this computer until you set your real domain.` : `Links in emails point to ${o.appUrl}`, cta: undefined, href: undefined },
    { ok: o.cronProtected, title: "Scheduled reminders", body: o.cronProtected ? "CRON_SECRET is set, so only your scheduler can trigger the daily job." : "Set CRON_SECRET in your environment so nobody else can trigger the reminders job.", cta: undefined, href: undefined },
    { ok: o.users.admins >= 1, title: "Administrators", body: `${o.users.admins} admin${o.users.admins === 1 ? "" : "s"}. Consider adding a second one as a backup.`, href: "/admin/users", cta: "Manage users" },
  ];

  const kpis = [
    { k: "Users", v: o.users.total, sub: `${o.users.activeWeek} active this week`, icon: Users },
    { k: "Envelopes", v: o.envelopes.total, sub: `${o.envelopes.sent ?? 0} in progress`, icon: Files },
    { k: "Completed this month", v: o.envelopes.completedMonth, sub: `${o.envelopes.completed ?? 0} all time`, icon: FileCheck2 },
    { k: "Storage", v: bytes(o.storage.bytes), sub: `${o.storage.files} files in Atlas`, icon: HardDrive },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Overview" body="Health and usage of your SyncSign workspace." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted sm:text-sm">{s.k}</p><s.icon className="h-4 w-4 text-muted" /></div>
            <p className="mt-3 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{s.v}</p>
            <p className="mt-0.5 text-xs text-muted">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      <Section title="Setup checklist">
        <ul className="divide-y divide-line">
          {checks.map((c) => (
            <li key={c.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
              <div className="flex-1"><p className="text-sm font-semibold">{c.title}</p><p className="text-sm text-muted">{c.body}</p></div>
              {c.href && <Link href={c.href} className="shrink-0 text-sm font-medium text-sky-700 dark:text-sky-400">{c.cta}</Link>}
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Email in the last 7 days">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[["sent", "Sent", "text-emerald-600"], ["failed", "Failed", "text-rose-600"], ["skipped", "Not sent", "text-muted"]].map(([k, l, c]) => (
              <div key={k} className="rounded-lg bg-surface-2 p-3"><p className={`font-display text-2xl font-semibold tabular-nums ${c}`}>{o.mail.week[k!] ?? 0}</p><p className="text-xs text-muted">{l}</p></div>
            ))}
          </div>
          <Link href="/admin/logs" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 dark:text-sky-400"><Mail className="h-4 w-4" />Open email log</Link>
        </Section>
        <Section title="Reminders & expiry job" body="Runs daily via /api/cron/reminders. You can also run it now.">
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-muted" />
            {o.jobs ? <span>Last run {timeAgo(o.jobs.at)} ({fmtDate(o.jobs.at, true)}, {o.jobs.trigger}) — {o.jobs.reminded} reminders, {o.jobs.expired} expired</span> : <span className="text-muted">Hasn&apos;t run yet</span>}
          </div>
          <Button variant="outline" onClick={runJobs} disabled={running}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}Run now</Button>
        </Section>
      </div>
    </div>
  );
}
