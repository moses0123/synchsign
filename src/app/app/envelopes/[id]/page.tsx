"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Ban, Bell, Check, CheckCircle2, Clock, Copy, Download, Eye, FileDown, Link2, MoreHorizontal,
  PenLine, Send, ShieldCheck, Trash2, UserCog, XCircle, Fingerprint, Mail, KeyRound, Files, Share2, Award,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Modal, Spinner, StatusBadge, api } from "@/components/ui";
import { PdfViewer } from "@/components/pdf-viewer";
import type { ClientEnvelope, ClientRecipient } from "@/lib/client-types";
import { FIELD_META } from "@/lib/fields";
import { cn, fmtDate, timeAgo } from "@/lib/utils";

interface AuditEvent { _id: string; action: string; at: string; actor?: string; email?: string; ip?: string; details?: string }

const EVENT_ICON: Record<string, typeof Send> = {
  created: Files, sent: Send, delivered: Mail, viewed: Eye, signed: PenLine, approved: CheckCircle2, declined: XCircle,
  completed: ShieldCheck, voided: Ban, reminded: Bell, downloaded: Download, code_verified: KeyRound, code_failed: KeyRound,
  corrected: UserCog, expired: Clock, updated: Files,
};

export default function EnvelopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const [env, setEnv] = useState<ClientEnvelope | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [tab, setTab] = useState<"activity" | "document">("activity");
  const [busy, setBusy] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [correct, setCorrect] = useState<ClientRecipient | null>(null);
  const [menu, setMenu] = useState(false);
  const [celebrate, setCelebrate] = useState(search.get("sent") === "1");

  const load = useCallback(async () => {
    try {
      const [{ envelope }, { events }] = await Promise.all([
        api<{ envelope: ClientEnvelope }>(`/api/envelopes/${id}`),
        api<{ events: AuditEvent[] }>(`/api/envelopes/${id}/audit`),
      ]);
      if (envelope.status === "draft") { router.replace(`/app/envelopes/${id}/edit`); return; }
      setEnv(envelope); setEvents(events);
    } catch (e) { toast.error((e as Error).message); router.replace("/app/documents"); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (env?.status !== "sent") return;
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => clearInterval(t);
  }, [env?.status, load]);
  useEffect(() => { if (celebrate) { toast.success("Envelope sent", { description: "Recipients will be notified in signing order." }); setCelebrate(false); } }, [celebrate]);

  const source = useMemo(() => env ? { url: `/api/envelopes/${id}/file${env.completedFileId ? "?kind=final" : ""}` } : null, [env, id]);

  if (!env) return <div className="grid min-h-[60dvh] place-items-center"><Spinner className="h-8 w-8" /></div>;

  const actionable = env.recipients.filter((r) => r.role !== "cc");
  const done = actionable.filter((r) => r.status === "signed" || r.status === "approved").length;
  const pct = actionable.length ? Math.round((done / actionable.length) * 100) : 0;

  async function act(name: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(name);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }
  const copy = async (text: string, what = "Link") => { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); };
  const share = async (r: ClientRecipient) => {
    if (navigator.share) { try { await navigator.share({ title: env.title, text: `Please sign “${env.title}”`, url: r.link }); } catch { /* cancelled */ } }
    else copy(r.link!);
  };

  const menuItems = [
    { icon: Copy, label: "Duplicate", run: () => act("dup", async () => { const r = await api<{ id: string }>(`/api/envelopes/${id}/duplicate`, { method: "POST" }); router.push(`/app/envelopes/${r.id}/edit`); }, "Duplicated as a new draft") },
    { icon: ShieldCheck, label: "Public verification page", run: () => window.open(`/verify/${id}`, "_blank") },
    ...(env.status !== "sent" ? [{ icon: Trash2, label: "Delete", danger: true, run: () => { if (confirmDelete()) act("del", async () => { await api(`/api/envelopes/${id}`, { method: "DELETE" }); router.push("/app/documents"); }, "Envelope deleted"); } }] : []),
  ];
  function confirmDelete() { return window.confirm("Delete this envelope and its files permanently?"); }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">

      <Link href="/app/documents" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Documents</Link>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={env.status} />{env.tags?.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{t}</span>)}</div>
          <h1 className="mt-2 break-words font-display text-2xl font-bold tracking-tight sm:text-3xl">{env.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Sent {fmtDate(env.sentAt, true)}{env.completedAt ? ` · Completed ${fmtDate(env.completedAt, true)}` : ""}{env.expiresAt ? ` · Expires ${fmtDate(env.expiresAt)}` : ""}
          </p>
          {env.voidReason && <p className="mt-2 text-sm text-rose-600">Voided: {env.voidReason}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {env.status === "completed" && (
            <>
              <a href={`/api/envelopes/${id}/file?kind=final&download=1`}><Button><FileDown className="h-4 w-4" />Signed document</Button></a>
              {env.certificateFileId && <a href={`/api/envelopes/${id}/file?kind=certificate&download=1`}><Button variant="outline"><Award className="h-4 w-4" />Certificate</Button></a>}
            </>
          )}
          {env.status === "sent" && (
            <>
              <Button variant="outline" loading={busy === "remind"} onClick={() => act("remind", () => api(`/api/envelopes/${id}/remind`, { method: "POST" }), "Reminders sent")}><Bell className="h-4 w-4" />Remind</Button>
              <Button variant="outline" onClick={() => setVoidOpen(true)} className="!text-rose-500"><Ban className="h-4 w-4" />Void</Button>
            </>
          )}
          <a href={`/api/envelopes/${id}/file?download=1`} title="Download original"><Button variant="ghost" size="icon" aria-label="Download original"><Download className="h-4 w-4" /></Button></a>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setMenu(!menu)} aria-label="More"><MoreHorizontal className="h-5 w-5" /></Button>
            <AnimatePresence>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="card absolute right-0 z-50 mt-2 w-60 origin-top-right p-1.5">
                    {menuItems.map((m) => (
                      <button key={m.label} onClick={() => { setMenu(false); m.run(); }}
                        className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-surface-2", "danger" in m && m.danger && "text-rose-500")}>
                        <m.icon className="h-4 w-4" />{m.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Recipients / progress */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <ProgressRing pct={pct} />
              <div>
                <p className="font-display text-lg font-semibold">{done} of {actionable.length} complete</p>
                <p className="text-sm text-muted">{env.signingOrder === "sequential" ? "Signing in order" : "Signing in any order"}</p>
              </div>
            </div>
            <ol className="relative mt-5 space-y-1">
              {[...env.recipients].sort((a, b) => a.order - b.order).map((r, i, arr) => (
                <motion.li key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-3 pb-4">
                  {i < arr.length - 1 && <span className="absolute left-[17px] top-10 h-[calc(100%-28px)] w-0.5 bg-line" />}
                  <div className="relative">
                    <Avatar name={r.name} color={r.color} size={36} />
                    {(r.status === "signed" || r.status === "approved") && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-surface"><Check className="h-2.5 w-2.5" /></motion.span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{r.name}</p>
                      {r.role === "cc" && env.status === "completed" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Copy sent</span> : <StatusBadge status={r.status} recipient />}
                    </div>
                    <p className="truncate text-xs text-muted">{r.email} · {r.role === "cc" ? "copy" : r.role}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.completedAt ? `${r.status === "declined" ? "Declined" : "Completed"} ${timeAgo(r.completedAt)}` : r.viewedAt ? `Viewed ${timeAgo(r.viewedAt)}` : r.sentAt ? `Sent ${timeAgo(r.sentAt)}` : r.role === "cc" ? (env.status === "completed" ? "Final documents emailed" : "Receives the final copy") : "Waiting for earlier signers"}
                    </p>
                    {r.declineReason && <p className="mt-1 rounded-lg bg-rose-500/10 px-2 py-1 text-xs text-rose-600">“{r.declineReason}”</p>}
                    {env.status === "sent" && r.role !== "cc" && (r.status === "sent" || r.status === "viewed") && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button onClick={() => copy(r.link!, "Signing link")} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs font-semibold hover:text-sky-600"><Link2 className="h-3.5 w-3.5" />Copy link</button>
                        <button onClick={() => share(r)} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs font-semibold hover:text-sky-600"><Share2 className="h-3.5 w-3.5" />Share</button>
                        <button onClick={() => setCorrect(r)} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs font-semibold hover:text-sky-600"><UserCog className="h-3.5 w-3.5" />Correct</button>
                        {r.email === env.ownerEmail && <Link href={`/sign/${r.token}`} className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-2 py-1 text-xs font-semibold text-white"><PenLine className="h-3.5 w-3.5" />Sign now</Link>}
                      </div>
                    )}
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>

          <div className="card space-y-2 p-5 text-xs">
            <p className="flex items-center gap-2 font-display text-sm font-semibold"><Fingerprint className="h-4 w-4 text-sky-500" />Integrity</p>
            <div><p className="text-muted">Original SHA-256</p><p className="break-all font-mono">{env.originalHash}</p></div>
            {env.completedHash && <div><p className="text-muted">Signed document SHA-256</p><p className="break-all font-mono">{env.completedHash}</p></div>}
            {env.certificateHash && <div><p className="text-muted">Certificate SHA-256</p><p className="break-all font-mono">{env.certificateHash}</p></div>}
            <p className="text-muted">Envelope ID <span className="font-mono text-ink">{env._id}</span></p>
          </div>
        </div>

        {/* Activity + document */}
        <div className="min-w-0">
          <div className="mb-4 inline-flex rounded-xl border border-line bg-surface-2 p-1">
            {(["activity", "document"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("relative rounded-lg px-4 py-1.5 text-sm font-semibold capitalize", tab === t ? "text-ink" : "text-muted")}>
                {tab === t && <motion.span layoutId="env-tab" className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-soft" />}
                {t}
              </button>
            ))}
          </div>
          {tab === "activity" ? (
            <div className="card p-5">
              <ol className="relative border-l-2 border-line pl-6">
                {[...events].reverse().map((e, i) => {
                  const I = EVENT_ICON[e.action] ?? Clock;
                  return (
                    <motion.li key={e._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="relative pb-5 last:pb-0">
                      <span className={cn("absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full ring-4 ring-surface",
                        e.action === "completed" || e.action === "signed" || e.action === "approved" ? "bg-emerald-500 text-white" : e.action === "declined" || e.action === "voided" || e.action === "code_failed" ? "bg-rose-500 text-white" : "bg-sky-500/15 text-sky-600")}>
                        <I className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-sm"><span className="font-semibold">{e.actor ?? "SyncSign"}</span> <span className="text-muted">{e.action.replace("_", " ")}</span></p>
                      {e.details && <p className="text-xs text-muted">{e.details}</p>}
                      <p className="mt-0.5 text-[11px] text-muted">{fmtDate(e.at, true)}{e.ip && e.ip !== "unknown" ? ` · IP ${e.ip}` : ""}</p>
                    </motion.li>
                  );
                })}
              </ol>
            </div>
          ) : (
            source && (
              <PdfViewer source={source} pages={env.completedFileId ? [...env.pages] : env.pages} maxWidth={780}
                renderOverlay={env.completedFileId ? undefined : (page, size) => env.fields.filter((f) => f.page === page).map((f) => {
                  const r = env.recipients.find((x) => x.id === f.recipientId);
                  const M = FIELD_META[f.type];
                  return (
                    <div key={f.id} className="absolute flex items-center gap-1 overflow-hidden rounded border border-dashed px-1 text-[10px] font-semibold"
                      style={{ left: f.x * size.width, top: f.y * size.height, width: f.w * size.width, height: f.h * size.height, borderColor: r?.color, color: r?.color, background: `${r?.color}14` }}>
                      <M.icon className="h-3 w-3 shrink-0" /><span className="truncate">{r?.name}</span>
                    </div>
                  );
                })} />
            )
          )}
        </div>
      </div>

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Void envelope"
        footer={<><Button variant="ghost" onClick={() => setVoidOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={busy === "void"} onClick={() => act("void", () => api(`/api/envelopes/${id}/void`, { method: "POST", json: { reason: voidReason } }), "Envelope voided").then(() => setVoidOpen(false))}>Void envelope</Button></>}>
        <p className="mb-3 text-sm text-muted">Recipients will be notified and can no longer sign. This can&apos;t be undone.</p>
        <textarea className="input min-h-[90px]" placeholder="Reason (shared with recipients)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} maxLength={500} />
      </Modal>

      <CorrectModal env={env} r={correct} onClose={() => setCorrect(null)} onDone={load} />
    </div>
  );
}

function CorrectModal({ env, r, onClose, onDone }: { env: ClientEnvelope; r: ClientRecipient | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [exp, setExp] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (r) { setName(r.name); setEmail(r.email); setExp(env.expiresAt ? env.expiresAt.slice(0, 10) : ""); } }, [r, env.expiresAt]);
  async function save() {
    setBusy(true);
    try {
      await api(`/api/envelopes/${env._id}/correct`, { method: "POST", json: { recipientId: r!.id, name, email, expiresAt: exp ? new Date(exp + "T23:59:59").toISOString() : null } });
      toast.success(email !== r!.email ? "Corrected — a fresh link was sent" : "Envelope corrected"); onClose(); onDone();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  return (
    <Modal open={Boolean(r)} onClose={onClose} title="Correct recipient"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save correction</Button></>}>
      <p className="mb-4 text-sm text-muted">Changing the email invalidates the old link and sends a new one. Completed signatures are kept.</p>
      <div className="space-y-3">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
        <label className="block"><span className="label">Expiry</span><input type="date" className="input" value={exp} onChange={(e) => setExp(e.target.value)} /></label>
      </div>
    </Modal>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-surface-2" />
        <motion.circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke="url(#pr)"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (pct / 100) * c }} transition={{ duration: 1, ease: "easeOut" }} />
        <defs><linearGradient id="pr"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#0284c7" /></linearGradient></defs>
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold">{pct}%</span>
    </div>
  );
}
