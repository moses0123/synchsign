"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { api, EmptyState, Skeleton } from "@/components/ui";
import { EnvelopeList } from "@/components/envelope-list";
import type { ClientEnvelope } from "@/lib/client-types";
import { cn } from "@/lib/utils";

const TABS = [
  { v: "all", l: "All" }, { v: "action", l: "Action required" }, { v: "waiting", l: "Waiting" },
  { v: "completed", l: "Completed" }, { v: "draft", l: "Drafts" }, { v: "declined", l: "Declined" },
  { v: "voided", l: "Voided" }, { v: "expired", l: "Expired" },
];

function Docs() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status") ?? "all";
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ClientEnvelope[] | null>(null);

  useEffect(() => {
    setItems(null);
    const t = setTimeout(() => {
      api<{ envelopes: ClientEnvelope[] }>(`/api/envelopes?status=${status}&q=${encodeURIComponent(q)}`).then((d) => setItems(d.envelopes)).catch(() => setItems([]));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [status, q]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Envelopes</h1>
          <p className="mt-1 text-muted">Everything you&apos;ve sent, signed or drafted.</p>
        </div>
        <label className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button key={t.v} onClick={() => router.replace(`/app/documents?status=${t.v}`)}
            className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", status === t.v ? "border-sky-500 bg-sky-500 text-white" : "border-line bg-surface text-muted hover:text-ink")}>
            {t.l}
          </button>
        ))}
      </div>
      <div className="card mt-4 p-2 sm:p-3">
        {!items && <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
        {items && !items.length && <EmptyState icon={<Inbox className="h-7 w-7" />} title="Nothing here" body="No envelopes match this filter yet." />}
        {items && items.length > 0 && <EnvelopeList items={items} />}
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><Docs /></Suspense>; }
