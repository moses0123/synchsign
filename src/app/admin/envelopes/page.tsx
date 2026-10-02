"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Skeleton, StatusBadge, api } from "@/components/ui";
import { PageHeader } from "@/components/admin/kit";
import { cn, fmtDate } from "@/lib/utils";

interface E { _id: string; title: string; ownerName: string; ownerEmail: string; status: string; createdAt: string; sentAt: string | null; completedAt: string | null; pages: number; recipients: number; done: number }
const STATUSES = ["all", "sent", "completed", "draft", "declined", "voided", "expired"];

export default function EnvelopesAdmin() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState("all");
  const [items, setItems] = useState<E[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api<{ envelopes: E[] }>(`/api/admin/envelopes?status=${status}&q=${encodeURIComponent(q)}`).then((d) => setItems(d.envelopes)).catch((e) => toast.error(e.message)), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, status]);
  return (
    <div>
      <PageHeader title="Envelopes" body="Every envelope in the workspace. Admins see details and status only — document contents stay private to the sender and recipients."
        action={<label className="relative sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search title, sender or recipient" value={q} onChange={(e) => setQ(e.target.value)} /></label>} />
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {STATUSES.map((s) => <button key={s} onClick={() => setStatus(s)} className={cn("shrink-0 rounded-full border px-3 py-1 text-sm font-medium capitalize", status === s ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink")}>{s === "sent" ? "In progress" : s}</button>)}
      </div>
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_1.2fr_110px_110px_120px] gap-4 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-medium text-muted md:grid">
          <span>Envelope</span><span>Sender</span><span>Signed</span><span>Created</span><span>Status</span>
        </div>
        {!items && <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {items?.length === 0 && <p className="p-8 text-center text-sm text-muted">No envelopes match.</p>}
        {items?.map((e) => (
          <div key={e._id} className="grid grid-cols-1 gap-1 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[1.6fr_1.2fr_110px_110px_120px] md:items-center md:gap-4">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{e.title}</p><p className="truncate font-mono text-[11px] text-muted">{e._id} · {e.pages} pages</p></div>
            <div className="min-w-0"><p className="truncate text-sm">{e.ownerName}</p><p className="truncate text-xs text-muted">{e.ownerEmail}</p></div>
            <span className="text-sm tabular-nums text-muted">{e.done}/{e.recipients}</span>
            <span className="text-sm text-muted">{fmtDate(e.createdAt)}</span>
            <span><StatusBadge status={e.status} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
