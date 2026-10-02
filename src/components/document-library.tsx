"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { STARTERS, type Starter } from "@/lib/doc-library";
import { Skeleton, api } from "./ui";
import { cn, timeAgo } from "@/lib/utils";

interface DocRow { _id: string; title: string; updatedAt: string; uses: number; blocks: number; roles: { id: string; name: string; color: string }[] }

const CATS = ["All", "Legal", "HR", "Sales", "Property", "General"] as const;

function Thumb({ s }: { s: Starter }) {
  const blocks = s.build().blocks.slice(0, 9);
  return (
    <div className="relative h-36 overflow-hidden rounded-t-xl border-b border-line bg-surface-2 px-6 pt-5">
      <div className="mx-auto h-full w-full max-w-[150px] rounded-t-sm bg-white px-3 pt-3 shadow-sm ring-1 ring-black/5">
        {blocks.map((b, i) => {
          if (b.type === "heading") return <div key={i} className="mx-auto mb-2 h-1.5 w-3/4 rounded-full bg-slate-700" />;
          if (b.type === "subheading") return <div key={i} className="mb-1 mt-1.5 h-1 w-1/3 rounded-full bg-sky-600" />;
          if (b.type === "table") return <div key={i} className="mb-1.5 grid grid-cols-2 gap-px border border-slate-200">{[0, 1, 2, 3].map((k) => <div key={k} className="h-1.5 bg-slate-100" />)}</div>;
          if (b.type === "signature") return <div key={i} className="mt-2 h-px w-1/2 bg-slate-500" />;
          if (b.type === "divider") return <div key={i} className="my-1.5 h-px bg-slate-200" />;
          return <div key={i} className="mb-1.5 space-y-[3px]"><div className="h-[3px] rounded-full bg-slate-200" /><div className="h-[3px] w-5/6 rounded-full bg-slate-200" /></div>;
        })}
      </div>
    </div>
  );
}

export function DocumentLibrary() {
  const router = useRouter();
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [mine, setMine] = useState<DocRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api<{ documents: DocRow[] }>("/api/documents").then((d) => setMine(d.documents)).catch(() => setMine([]));
  useEffect(() => { load(); }, []);

  async function create(body: { starter?: string; from?: string }, key: string) {
    setBusy(key);
    try {
      const r = await api<{ id: string }>("/api/documents", { method: "POST", json: body });
      router.push(`/app/templates/documents/${r.id}`);
    } catch (e) { toast.error((e as Error).message); setBusy(null); }
  }
  async function remove(d: DocRow) {
    if (!confirm(`Delete “${d.title}”? Envelopes already sent from it are not affected.`)) return;
    try { await api(`/api/documents/${d._id}`, { method: "DELETE" }); toast.success("Document deleted"); load(); } catch (e) { toast.error((e as Error).message); }
  }

  const starters = STARTERS.filter((s) => s.key !== "blank" && (cat === "All" || s.category === cat));

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-muted">Write and format a document right here, add fill-in fields and signature blocks, then send it for signing — no Word file needed.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", cat === c ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-ink")}>{c}</button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => create({ starter: "blank" }, "blank")} disabled={Boolean(busy)}
            className="card flex min-h-[236px] flex-col items-center justify-center gap-2 border-dashed text-center transition-colors hover:border-sky-400">
            {busy === "blank" ? <Loader2 className="h-6 w-6 animate-spin text-sky-600" /> : <Plus className="h-6 w-6 text-sky-600" />}
            <span className="text-sm font-semibold">Blank document</span>
            <span className="px-6 text-xs text-muted">Start from scratch</span>
          </motion.button>
          {starters.map((s, i) => (
            <motion.button key={s.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => create({ starter: s.key }, s.key)} disabled={Boolean(busy)}
              className="card group flex flex-col overflow-hidden text-left transition-colors hover:border-sky-400">
              <Thumb s={s} />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{s.name}</p>
                  {busy === s.key ? <Loader2 className="h-4 w-4 animate-spin text-sky-600" /> : <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">{s.category}</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{s.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Starter wording is a general guide. Adapt it to your situation and check it with a legal adviser where needed.</p>
      </section>

      <section>
        <h2 className="font-display text-base font-semibold">Your documents</h2>
        <div className="card mt-3 divide-y divide-line">
          {!mine && <div className="p-4"><Skeleton className="h-12" /></div>}
          {mine && !mine.length && <p className="p-6 text-center text-sm text-muted">Documents you create appear here so you can reuse them.</p>}
          {mine?.map((d) => (
            <div key={d._id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-muted" />
              <button onClick={() => router.push(`/app/templates/documents/${d._id}`)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold hover:text-sky-700 dark:hover:text-sky-400">{d.title}</p>
                <p className="truncate text-xs text-muted">Edited {timeAgo(d.updatedAt)} · {d.roles.map((r) => r.name).join(", ") || "No signers"} · sent {d.uses}×</p>
              </button>
              <button onClick={() => create({ from: d._id }, d._id)} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink" title="Duplicate" aria-label="Duplicate">
                {busy === d._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              </button>
              <button onClick={() => remove(d)} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-rose-500" title="Delete" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
