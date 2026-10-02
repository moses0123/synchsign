"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, FilePen, FilePlus2, FileUp, Hourglass, Inbox, PenLine, ShieldCheck } from "lucide-react";
import { api, Skeleton, EmptyState, Button } from "@/components/ui";
import { EnvelopeList } from "@/components/envelope-list";
import { WeeklyChart, type WeekPoint } from "@/components/weekly-chart";
import type { ClientEnvelope } from "@/lib/client-types";

interface Stats { sent: number; completionRate: number | null; medianHours: number | null; weeks: WeekPoint[] }

const fmtHours = (h: number | null) => h === null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${Math.round(h / 24)} days`;

export default function Dashboard() {
  const [items, setItems] = useState<ClientEnvelope[] | null>(null);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    api<{ envelopes: ClientEnvelope[] }>("/api/envelopes").then((d) => setItems(d.envelopes)).catch(() => setItems([]));
    api<{ user: { name: string; email: string } }>("/api/me").then((d) => setMe(d.user)).catch(() => {});
    api<Stats>("/api/stats").then(setStats).catch(() => {});
  }, []);

  const list = items ?? [];
  const action = list.filter((e) => e.status === "sent" && e.recipients.some((r) => r.email === me?.email && (r.status === "sent" || r.status === "viewed")));
  const kpis = [
    { k: "Action required", v: action.length, icon: AlertCircle, tone: "text-rose-600", href: "/app/documents?status=action" },
    { k: "Waiting on others", v: list.filter((e) => e.status === "sent").length, icon: Hourglass, tone: "text-sky-600", href: "/app/documents?status=waiting" },
    { k: "Completed", v: list.filter((e) => e.status === "completed").length, icon: CheckCircle2, tone: "text-emerald-600", href: "/app/documents?status=completed" },
    { k: "Drafts", v: list.filter((e) => e.status === "draft").length, icon: FilePen, tone: "text-slate-500", href: "/app/documents?status=draft" },
  ];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{today}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-[28px]">Welcome back{me ? `, ${me.name.split(" ")[0]}` : ""}</h1>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Link href="/app/templates?tab=library"><Button variant="outline"><FilePlus2 className="h-4 w-4" />Create document</Button></Link>
          <Link href="/app/new"><Button><FileUp className="h-4 w-4" />Upload &amp; send</Button></Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link href={s.href} className="card block p-4 transition-colors hover:border-sky-300 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted sm:text-sm">{s.k}</p>
                <s.icon className={`h-4 w-4 ${s.tone}`} />
              </div>
              <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{items ? s.v : "–"}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold">Envelopes sent</h2>
              <p className="text-xs text-muted">Last 8 weeks</p>
            </div>
            <dl className="flex gap-6 sm:text-right">
              <div><dt className="text-xs text-muted">Completion rate</dt><dd className="font-display text-lg font-semibold tabular-nums">{stats?.completionRate == null ? "—" : `${Math.round(stats.completionRate * 100)}%`}</dd></div>
              <div><dt className="text-xs text-muted">Median time to sign</dt><dd className="font-display text-lg font-semibold tabular-nums">{fmtHours(stats?.medianHours ?? null)}</dd></div>
            </dl>
          </div>
          <div className="mt-5">{stats ? <WeeklyChart data={stats.weeks} /> : <Skeleton className="h-44" />}</div>
        </div>

        <div className="card flex flex-col p-5">
          <h2 className="font-display text-base font-semibold">Quick start</h2>
          <div className="mt-3 grid gap-2">
            {[
              { href: "/app/new", icon: FileUp, t: "Upload a PDF", d: "Send for signature" },
              { href: "/app/templates?tab=library", icon: FilePlus2, t: "Create a document", d: "NDA, offer letter, lease…" },
              { href: "/app/new?self=1", icon: PenLine, t: "Sign it myself", d: "Just you" },
              { href: "/verify", icon: ShieldCheck, t: "Verify a PDF", d: "Check it is authentic" },
            ].map((q) => (
              <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-sky-300 hover:bg-surface-2">
                <q.icon className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{q.t}</span><span className="block truncate text-xs text-muted">{q.d}</span></span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-4 p-2 sm:p-3">
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <h2 className="font-display text-base font-semibold">Recent envelopes</h2>
          <Link href="/app/documents" className="text-sm font-medium text-sky-700 dark:text-sky-400">View all</Link>
        </div>
        {!items && <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
        {items && !items.length && (
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="No envelopes yet" body="Upload a PDF or create a document from a template to send your first envelope."
            action={<Link href="/app/new"><Button><FileUp className="h-4 w-4" />Upload &amp; send</Button></Link>} />
        )}
        {items && items.length > 0 && <EnvelopeList items={items.slice(0, 8)} />}
      </div>
    </div>
  );
}
