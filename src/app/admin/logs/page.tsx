"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, MinusCircle, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Skeleton, api } from "@/components/ui";
import { PageHeader } from "@/components/admin/kit";
import { cn, fmtDate } from "@/lib/utils";

interface L { _id: string; to: string; subject: string; kind: string; status: "sent" | "failed" | "skipped"; error?: string; at: string }
const KIND: Record<string, string> = { invite: "Invitation", reminder: "Reminder", completed: "Completed", declined: "Declined", voided: "Voided", signerDone: "Signer update", test: "Test" };

export default function MailLog() {
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState<L[] | null>(null);
  const load = () => { setItems(null); api<{ items: L[] }>(`/api/admin/mail-log?status=${status}`).then((d) => setItems(d.items)).catch((e) => toast.error(e.message)); };
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <PageHeader title="Email log" body="The last 200 emails SyncSign tried to send, with the server's error if delivery failed."
        action={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
      <div className="mb-3 flex gap-2">
        {[["all", "All"], ["sent", "Sent"], ["failed", "Failed"], ["skipped", "Not sent"]].map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v!)} className={cn("rounded-full border px-3 py-1 text-sm font-medium", status === v ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink")}>{l}</button>
        ))}
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {!items && <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        {items?.length === 0 && <p className="p-8 text-center text-sm text-muted">Nothing here yet.</p>}
        {items?.map((m) => (
          <div key={m._id} className="flex gap-3 px-4 py-3">
            {m.status === "sent" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : m.status === "failed" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.subject}</p>
              <p className="truncate text-xs text-muted">To {m.to} · {KIND[m.kind] ?? m.kind} · {fmtDate(m.at, true)}</p>
              {m.error && <p className={cn("mt-1 break-words text-xs", m.status === "failed" ? "text-rose-600" : "text-muted")}>{m.error}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
