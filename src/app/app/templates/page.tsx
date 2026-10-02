"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { LayoutTemplate, Send, Trash2, Users, FilePen, Layers } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, EmptyState, Modal, Segmented, Skeleton, api } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { DocumentLibrary } from "@/components/document-library";

interface Tpl {
  _id: string; name: string; description: string; fileName: string; pages: unknown[]; fieldCount: number; uses: number; updatedAt: string;
  signingOrder: string; roles: { id: string; name: string; role: string; order: number; color: string }[];
}

function EnvelopeTemplates() {
  const [items, setItems] = useState<Tpl[] | null>(null);
  const [use, setUse] = useState<Tpl | null>(null);
  const load = () => api<{ templates: Tpl[] }>("/api/templates").then((d) => setItems(d.templates)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  async function remove(t: Tpl) {
    if (!confirm(`Delete template “${t.name}”?`)) return;
    try { await api(`/api/templates/${t._id}`, { method: "DELETE" }); toast.success("Template deleted"); load(); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <p className="text-sm text-muted">Saved envelopes with their recipients, routing and fields. Use one for a single send, or bulk-send it to many people.</p>

      {!items && <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>}
      {items && !items.length && (
        <div className="card mt-6">
          <EmptyState icon={<LayoutTemplate className="h-7 w-7" />} title="No templates yet"
            body="Prepare any envelope, then choose “Save as template” on the review step. Its roles and fields are saved for next time."
            action={<Link href="/app/new"><Button><FilePen className="h-4 w-4" />Prepare a document</Button></Link>} />
        </div>
      )}
      {items && items.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <motion.div key={t._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card group flex flex-col p-5 transition hover:border-sky-300 hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/10 text-sky-500"><LayoutTemplate className="h-5 w-5" /></span>
                <button onClick={() => remove(t)} className="rounded-lg p-2 text-muted opacity-0 transition hover:text-rose-500 group-hover:opacity-100 max-lg:opacity-100" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
              <h3 className="mt-4 truncate font-display font-semibold">{t.name}</h3>
              <p className="mt-0.5 text-xs text-muted">{t.pages.length} pages · {t.fieldCount} fields · used {t.uses}× · {timeAgo(t.updatedAt)}</p>
              <div className="mt-3 flex -space-x-2">{t.roles.map((r) => <Avatar key={r.id} name={r.name} color={r.color} size={28} />)}</div>
              <div className="mt-auto flex gap-2 pt-5">
                <Button size="sm" className="flex-1" onClick={() => setUse(t)}><Send className="h-4 w-4" />Use</Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <UseModal t={use} onClose={() => setUse(null)} />
    </div>
  );
}

function UseModal({ t, onClose }: { t: Tpl | null; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [people, setPeople] = useState<Record<string, { name: string; email: string }>>({});
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (t) { setPeople({}); setBulk(""); setMode("single"); } }, [t]);
  if (!t) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const roles = [...t.roles].sort((a, b) => a.order - b.order);
  const first = roles[0]!;
  const rows = bulk.split(/\n+/).map((l) => l.split(/[,;\t]/).map((s) => s.trim())).filter((p) => p.length >= 2 && /\S+@\S+/.test(p[1]!)).map(([name, email]) => ({ name: name!, email: email! }));

  async function single(send: boolean) {
    setBusy(send ? "send" : "edit");
    try {
      const r = await api<{ id: string }>(`/api/templates/${t!._id}/use`, { method: "POST", json: { people, send } });
      toast.success(send ? "Sent!" : "Draft created");
      router.push(send ? `/app/envelopes/${r.id}?sent=1` : `/app/envelopes/${r.id}/edit?step=fields`);
    } catch (e) { toast.error((e as Error).message); setBusy(null); }
  }
  async function sendBulk() {
    setBusy("bulk");
    try {
      const fixed = Object.fromEntries(roles.slice(1).map((r) => [r.id, people[r.id] ?? { name: "", email: "" }]));
      const r = await api<{ count: number }>(`/api/templates/${t!._id}/bulk`, { method: "POST", json: { rows, fixed } });
      toast.success(`Sent ${r.count} envelopes`); onClose(); router.push("/app/documents?status=waiting");
    } catch (e) { toast.error((e as Error).message); setBusy(null); }
  }

  const roleInputs = (list: typeof roles) => list.map((r) => (
    <div key={r.id} className="rounded-xl border border-line p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.name} <span className="text-xs font-normal text-muted">· {r.role}</span></p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder="Name" value={people[r.id]?.name ?? ""} onChange={(e) => setPeople({ ...people, [r.id]: { ...(people[r.id] ?? { email: "" }), name: e.target.value } })} />
        <input className="input" placeholder="Email" type="email" value={people[r.id]?.email ?? ""} onChange={(e) => setPeople({ ...people, [r.id]: { ...(people[r.id] ?? { name: "" }), email: e.target.value } })} />
      </div>
    </div>
  ));

  return (
    <Modal open onClose={onClose} title={`Use “${t.name}”`} wide
      footer={mode === "single" ? <>
        <Button variant="ghost" onClick={() => single(false)} loading={busy === "edit"}>Open as draft</Button>
        <Button onClick={() => single(true)} loading={busy === "send"}><Send className="h-4 w-4" />Send now</Button>
      </> : <Button onClick={sendBulk} loading={busy === "bulk"} disabled={!rows.length}><Layers className="h-4 w-4" />Send {rows.length || ""} envelopes</Button>}>
      <Segmented className="mb-4" value={mode} onChange={setMode} options={[{ value: "single", label: <><Users className="h-4 w-4" />Single</> }, { value: "bulk", label: <><Layers className="h-4 w-4" />Bulk send</> }]} />
      {mode === "single" ? <div className="space-y-3">{roleInputs(roles)}</div> : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Each line creates its own envelope for the <strong>{first.name}</strong> role. Paste <code className="rounded bg-surface-2 px-1">Name, email</code> — one per line (you can paste from a spreadsheet).</p>
          <textarea className="input min-h-[160px] font-mono text-xs" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Thandiwe Phiri, thandiwe@example.com\nSamuel Okoro, sam@example.com"} />
          <p className="text-xs font-semibold text-sky-600">{rows.length} valid recipient{rows.length === 1 ? "" : "s"}</p>
          {roles.length > 1 && <><p className="text-sm text-muted">These roles are the same on every envelope:</p>{roleInputs(roles.slice(1))}</>}
        </div>
      )}
    </Modal>
  );
}

function TemplatesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "envelopes" ? "envelopes" : "library";
  const tabs = [{ v: "library", l: "Document builder" }, { v: "envelopes", l: "Envelope templates" }] as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">Templates</h1>
      <div className="mt-5 flex gap-6 border-b border-line">
        {tabs.map((t) => (
          <button key={t.v} onClick={() => router.replace(`/app/templates?tab=${t.v}`)}
            className={cn("relative -mb-px pb-3 text-sm font-medium transition-colors", tab === t.v ? "text-ink" : "text-muted hover:text-ink")}>
            {t.l}
            {tab === t.v && <motion.span layoutId="tpl-tab" className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-600" />}
          </button>
        ))}
      </div>
      <div className="mt-6">{tab === "library" ? <DocumentLibrary /> : <EnvelopeTemplates />}</div>
    </div>
  );
}

export default function Page() { return <Suspense><TemplatesPage /></Suspense>; }
