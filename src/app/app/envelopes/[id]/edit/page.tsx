"use client";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Copy, KeyRound, LayoutTemplate, Loader2, MousePointer2,
  Plus, Send, Trash2, UserPlus, Users, X, CloudCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Modal, Segmented, Spinner, api } from "@/components/ui";
import { PdfViewer } from "@/components/pdf-viewer";
import type { ClientEnvelope, ClientRecipient } from "@/lib/client-types";
import type { Field, FieldType, RecipientRole } from "@/lib/types";
import { RECIPIENT_COLORS } from "@/lib/types";
import { FIELD_META, FIELD_ORDER } from "@/lib/fields";
import { cn, uid } from "@/lib/utils";

type Step = "recipients" | "fields" | "review";
const STEPS: { v: Step; l: string }[] = [{ v: "recipients", l: "Recipients" }, { v: "fields", l: "Fields" }, { v: "review", l: "Review & send" }];

export default function EditEnvelope({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const [env, setEnv] = useState<ClientEnvelope | null>(null);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [step, setStep] = useState<Step>((search.get("step") as Step) || "recipients");
  const [recipients, setRecipients] = useState<ClientRecipient[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [meta, setMeta] = useState({ title: "", message: "", signingOrder: "sequential" as "sequential" | "parallel", expiresAt: "" as string, reminderDays: 3 as number | null });
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const loaded = useRef(false);

  useEffect(() => {
    api<{ envelope: ClientEnvelope }>(`/api/envelopes/${id}`).then(({ envelope: e }) => {
      if (e.status !== "draft") { router.replace(`/app/envelopes/${id}`); return; }
      setEnv(e); setRecipients(e.recipients); setFields(e.fields);
      setMeta({ title: e.title, message: e.message, signingOrder: e.signingOrder, expiresAt: e.expiresAt ? e.expiresAt.slice(0, 10) : "", reminderDays: e.reminderDays ?? null });
      setTimeout(() => { loaded.current = true; }, 50);
    }).catch((err) => { toast.error(err.message); router.replace("/app/documents"); });
    api<{ user: { name: string; email: string } }>("/api/me").then((d) => setMe(d.user)).catch(() => {});
  }, [id, router]);

  const payload = useMemo(() => ({
    ...meta,
    expiresAt: meta.expiresAt ? new Date(meta.expiresAt + "T23:59:59").toISOString() : null,
    recipients: recipients.filter((r) => r.name.trim() && /\S+@\S+\.\S+/.test(r.email)).map(({ id, name, email, role, order, color, accessCode }) => ({ id, name, email, role, order, color, accessCode: accessCode || null })),
    fields,
  }), [meta, recipients, fields]);

  const save = useCallback(async (p = payload) => {
    setSaving("saving");
    try { await api(`/api/envelopes/${id}`, { method: "PATCH", json: p }); setSaving("saved"); }
    catch (e) { setSaving("idle"); throw e; }
  }, [id, payload]);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => save().catch((e) => toast.error(e.message)), 700);
    return () => clearTimeout(t);
  }, [payload, save]);

  if (!env) return <div className="grid min-h-dvh place-items-center"><Spinner className="h-8 w-8" /></div>;
  const self = env.tags?.includes("self-sign");
  const validRecipients = recipients.filter((r) => r.name.trim() && /\S+@\S+\.\S+/.test(r.email));

  function goto(s: Step) {
    if (s !== "recipients" && !validRecipients.some((r) => r.role !== "cc")) { toast.error("Add at least one signer with a valid name and email"); setStep("recipients"); return; }
    setStep(s); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-2.5 sm:px-5">
          <Link href="/app/documents" className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
          <input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            className="min-w-0 flex-1 truncate rounded-lg bg-transparent px-2 py-1 font-display text-base font-semibold outline-none hover:bg-surface-2 focus:bg-surface-2 sm:text-lg" />
          <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
            {saving === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving</> : saving === "saved" ? <><CloudCheck className="h-3.5 w-3.5 text-sky-500" />Saved</> : null}
          </span>
          <nav className="hidden items-center gap-1 md:flex">
            {STEPS.filter((s) => !self || s.v !== "recipients").map((s, i) => (
              <button key={s.v} onClick={() => goto(s.v)}
                className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition", step === s.v ? "bg-sky-500/10 text-sky-600 dark:text-sky-300" : "text-muted hover:text-ink")}>
                <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px]", step === s.v ? "bg-sky-500 text-white" : "bg-surface-2")}>{i + 1}</span>{s.l}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex md:hidden">
          {STEPS.filter((s) => !self || s.v !== "recipients").map((s) => (
            <button key={s.v} onClick={() => goto(s.v)} className={cn("relative flex-1 py-2 text-xs font-semibold", step === s.v ? "text-sky-600 dark:text-sky-300" : "text-muted")}>
              {s.l}{step === s.v && <motion.span layoutId="step-bar" className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sky-500" />}
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
          {step === "recipients" && (
            <RecipientsStep recipients={recipients} setRecipients={setRecipients} order={meta.signingOrder} setOrder={(v) => setMeta((m) => ({ ...m, signingOrder: v }))} me={me} onNext={() => goto("fields")} />
          )}
          {step === "fields" && (
            <FieldsStep env={env} recipients={validRecipients} fields={fields} setFields={setFields} onNext={() => goto("review")} />
          )}
          {step === "review" && (
            <ReviewStep env={env} recipients={validRecipients} fields={fields} meta={meta} setMeta={setMeta} self={Boolean(self)}
              flush={() => save()} onBack={() => setStep("fields")} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Recipients ───────────────────────── */

function RecipientsStep({ recipients, setRecipients, order, setOrder, me, onNext }: {
  recipients: ClientRecipient[]; setRecipients: (r: ClientRecipient[]) => void;
  order: "sequential" | "parallel"; setOrder: (v: "sequential" | "parallel") => void;
  me: { name: string; email: string } | null; onNext: () => void;
}) {
  const meta = { signingOrder: order };
  const add = (p?: { name: string; email: string }) => {
    const order = recipients.length ? Math.max(...recipients.map((r) => r.order)) + 1 : 1;
    setRecipients([...recipients, {
      id: uid(), name: p?.name ?? "", email: p?.email ?? "", role: "signer", order,
      color: RECIPIENT_COLORS[recipients.length % RECIPIENT_COLORS.length]!, status: "pending", token: "", accessCode: null,
    }]);
  };
  const update = (id: string, patch: Partial<ClientRecipient>) => setRecipients(recipients.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const list = [...recipients].sort((a, b) => a.order - b.order);
    const j = i + d; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    setRecipients(list.map((r, k) => ({ ...r, order: k + 1 })));
  };
  const sorted = [...recipients].sort((a, b) => a.order - b.order);
  const hasMe = me && recipients.some((r) => r.email === me.email);
  const [book, setBook] = useState<{ name: string; email: string }[]>([]);
  useEffect(() => { api<{ contacts: { name: string; email: string }[] }>("/api/contacts").then((d) => setBook(d.contacts)).catch(() => {}); }, []);
  const suggestions = book.filter((c) => !recipients.some((r) => r.email === c.email)).slice(0, 6);
  const onEmail = (r: ClientRecipient, email: string) => {
    const hit = book.find((c) => c.email === email.toLowerCase());
    update(r.id, { email, ...(hit && !r.name.trim() ? { name: hit.name } : {}) });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Who&apos;s involved?</h2>
          <p className="mt-1 text-sm text-muted">Add signers, approvers and people who just need a copy.</p>
        </div>
        <Segmented value={meta.signingOrder} onChange={setOrder} options={[
          { value: "sequential", label: "In order" }, { value: "parallel", label: "Any order" },
        ]} />
      </div>

      <div className="mt-6 space-y-3">
        <AnimatePresence initial={false}>
          {sorted.map((r, i) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -30 }}
              className="card relative overflow-hidden p-4 pl-5">
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: r.color }} />
              <div className="flex items-start gap-3">
                {meta.signingOrder === "sequential" && (
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-xs font-bold">{r.order}</span>
                    <button onClick={() => move(i, 1)} disabled={i === sorted.length - 1} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <input className="input" placeholder="Full name" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
                  <input className="input" placeholder="Email address" type="email" list="contact-book" value={r.email} onChange={(e) => onEmail(r, e.target.value.trim())} />
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <select className="input !w-auto !py-2" value={r.role} onChange={(e) => update(r.id, { role: e.target.value as RecipientRole })}>
                      <option value="signer">Needs to sign</option>
                      <option value="approver">Needs to approve</option>
                      <option value="cc">Receives a copy</option>
                    </select>
                    {meta.signingOrder === "sequential" && (
                      <label className="flex items-center gap-1.5 text-xs text-muted" title="Recipients with the same step number sign at the same time">
                        Step <input type="number" min={1} max={50} className="input !w-16 !px-2 !py-2" value={r.order} onChange={(e) => update(r.id, { order: Math.max(1, Number(e.target.value) || 1) })} />
                      </label>
                    )}
                    <button onClick={() => update(r.id, { accessCode: r.accessCode === null || r.accessCode === undefined ? "" : null })}
                      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition", r.accessCode !== null && r.accessCode !== undefined ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "text-muted hover:bg-surface-2")}>
                      <KeyRound className="h-3.5 w-3.5" />Access code
                    </button>
                    <div className="flex items-center gap-1">
                      {RECIPIENT_COLORS.slice(0, 6).map((c) => (
                        <button key={c} onClick={() => update(r.id, { color: c })} className={cn("h-5 w-5 rounded-full transition", r.color === c && "ring-2 ring-offset-2 ring-offset-surface")} style={{ background: c, ["--tw-ring-color" as string]: c }} aria-label="Colour" />
                      ))}
                    </div>
                  </div>
                  <AnimatePresence>
                    {r.accessCode !== null && r.accessCode !== undefined && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden sm:col-span-2">
                        <input className="input" placeholder="Code the recipient must enter (share it with them separately)" value={r.accessCode ?? ""} maxLength={32} onChange={(e) => update(r.id, { accessCode: e.target.value })} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={() => setRecipients(recipients.filter((x) => x.id !== r.id))} className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500" aria-label="Remove recipient"><Trash2 className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!recipients.length && (
          <div className="rounded-xl border-2 border-dashed border-line p-8 text-center text-sm text-muted">
            <Users className="mx-auto mb-2 h-8 w-8 text-sky-400" />No recipients yet — add the first person below.
          </div>
        )}
      </div>

      <datalist id="contact-book">{book.map((c) => <option key={c.email} value={c.email}>{c.name}</option>)}</datalist>
      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted">Recent contacts</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((c) => (
              <button key={c.email} onClick={() => add(c)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:border-sky-300">
                <Plus className="h-3 w-3" />{c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => add()}><UserPlus className="h-4 w-4" />Add recipient</Button>
        {me && !hasMe && <Button variant="ghost" onClick={() => add(me)}><Plus className="h-4 w-4" />Add me</Button>}
      </div>

      <div className="mt-10 flex justify-end">
        <Button size="lg" onClick={onNext}>Next: place fields<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Fields ───────────────────────── */

function FieldsStep({ env, recipients, fields, setFields, onNext }: {
  env: ClientEnvelope; recipients: ClientRecipient[]; fields: Field[]; setFields: React.Dispatch<React.SetStateAction<Field[]>>; onNext: () => void;
}) {
  const signers = recipients.filter((r) => r.role !== "cc");
  const [current, setCurrent] = useState(signers[0]?.id ?? "");
  const [armed, setArmed] = useState<FieldType | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const colorOf = (rid: string) => recipients.find((r) => r.id === rid)?.color ?? "#94a3b8";
  const nameOf = (rid: string) => recipients.find((r) => r.id === rid)?.name ?? "Unassigned";
  const sel = fields.find((f) => f.id === selected) ?? null;

  useEffect(() => { if (!signers.some((s) => s.id === current)) setCurrent(signers[0]?.id ?? ""); }, [signers, current]);

  const place = useCallback((type: FieldType, page: number, cx: number, cy: number) => {
    if (!current) { toast.error("Add a signer first"); return; }
    const p = env.pages[page]!;
    const m = FIELD_META[type];
    const w = m.w / p.w, h = m.h / p.h;
    const f: Field = {
      id: uid(), recipientId: current, type, page,
      x: Math.min(Math.max(0, cx - w / 2), 1 - w), y: Math.min(Math.max(0, cy - h / 2), 1 - h), w, h,
      required: type !== "checkbox", label: type === "text" ? "Text" : undefined,
    };
    setFields((fs) => [...fs, f]);
    setSelected(f.id);
    navigator.vibrate?.(8);
  }, [current, env.pages, setFields]);

  const patch = (id: string, p: Partial<Field>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const remove = (id: string) => { setFields((fs) => fs.filter((f) => f.id !== id)); setSelected(null); };
  const duplicate = (id: string) => {
    const f = fields.find((x) => x.id === id); if (!f) return;
    const copy = { ...f, id: uid(), y: Math.min(1 - f.h, f.y + f.h + 0.01) };
    setFields((fs) => [...fs, copy]); setSelected(copy.id);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (!selected) { if (e.key === "Escape") setArmed(null); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(selected); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(selected); }
      if (e.key === "Escape") setSelected(null);
      const step = e.shiftKey ? 0.02 : 0.004;
      const f = fields.find((x) => x.id === selected);
      if (f && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        patch(f.id, { x: Math.min(1 - f.w, Math.max(0, f.x + dx)), y: Math.min(1 - f.h, Math.max(0, f.y + dy)) });
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, fields]);

  const source = useMemo(() => ({ url: `/api/envelopes/${env._id}/file` }), [env._id]);
  const missing = signers.filter((s) => s.role === "signer" && !fields.some((f) => f.recipientId === s.id));

  const palette = (
    <div className="space-y-4">
      <div>
        <p className="label">Placing fields for</p>
        <div className="flex flex-wrap gap-1.5 lg:flex-col">
          {signers.map((r) => (
            <button key={r.id} onClick={() => setCurrent(r.id)}
              className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm font-semibold transition", current === r.id ? "border-transparent bg-surface shadow-soft ring-2" : "border-line text-muted hover:text-ink")}
              style={current === r.id ? { ["--tw-ring-color" as string]: r.color } : undefined}>
              <Avatar name={r.name} color={r.color} size={24} />
              <span className="max-w-[140px] truncate">{r.name}</span>
              <span className="ml-auto rounded-md bg-surface-2 px-1.5 text-[10px] text-muted">{fields.filter((f) => f.recipientId === r.id).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Fields <span className="normal-case tracking-normal text-muted/70">— drag onto the page, or tap then tap the page</span></p>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-1 lg:overflow-visible">
          {FIELD_ORDER.map((t) => {
            const M = FIELD_META[t];
            return (
              <button key={t} draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/x-field", t); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => setArmed(armed === t ? null : t)}
                className={cn("flex shrink-0 cursor-grab items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:cursor-grabbing",
                  armed === t ? "border-sky-400 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-line bg-surface hover:border-sky-300")}>
                <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: colorOf(current) }}><M.icon className="h-4 w-4" /></span>
                {M.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-[1500px] gap-0 lg:grid-cols-[260px_1fr_280px]">
      <aside className="sticky top-[57px] hidden h-[calc(100dvh-57px)] overflow-y-auto border-r border-line p-4 lg:block">{palette}</aside>

      <section className="min-w-0 px-3 py-4 sm:px-6 lg:py-8" onClick={() => setSelected(null)}>
        <AnimatePresence>
          {armed && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="sticky top-[110px] z-30 mx-auto mb-3 flex w-fit items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm lg:top-[70px]">
              <MousePointer2 className="h-4 w-4" />Tap the page to place {FIELD_META[armed].label.toLowerCase()}
              <button onClick={(e) => { e.stopPropagation(); setArmed(null); }} className="ml-1 rounded-full bg-white/20 p-0.5"><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          )}
        </AnimatePresence>
        <PdfViewer source={source} pages={env.pages} maxWidth={860}
          renderOverlay={(page, size) => (
            <div className={cn("absolute inset-0", armed && "cursor-crosshair")}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => {
                e.preventDefault();
                const t = e.dataTransfer.getData("text/x-field") as FieldType;
                if (!t || !FIELD_META[t]) return;
                const r = e.currentTarget.getBoundingClientRect();
                place(t, page, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!armed) { setSelected(null); return; }
                const r = e.currentTarget.getBoundingClientRect();
                place(armed, page, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
                setArmed(null);
              }}>
              {fields.filter((f) => f.page === page).map((f) => (
                <FieldBox key={f.id} f={f} size={size} color={colorOf(f.recipientId)} owner={nameOf(f.recipientId)} selected={selected === f.id}
                  onSelect={() => setSelected(f.id)} onChange={(p) => patch(f.id, p)} onDelete={() => remove(f.id)} />
              ))}
            </div>
          )} />
      </section>

      <aside className="sticky top-[57px] hidden h-[calc(100dvh-57px)] flex-col overflow-y-auto border-l border-line p-4 lg:flex">
        {sel ? <FieldProps f={sel} recipients={signers} onChange={(p) => patch(sel.id, p)} onDelete={() => remove(sel.id)} onDuplicate={() => duplicate(sel.id)} /> : (
          <div className="rounded-xl bg-surface-2 p-4 text-sm text-muted">
            <p className="font-semibold text-ink">Tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Drag fields to move them, pull the corner to resize.</li>
              <li>Arrow keys nudge · Shift for bigger steps.</li>
              <li><kbd className="rounded bg-surface px-1">Ctrl/⌘ D</kbd> duplicates · <kbd className="rounded bg-surface px-1">Del</kbd> removes.</li>
              <li>Name, email and date fill themselves in for signers.</li>
            </ul>
          </div>
        )}
        <div className="mt-auto space-y-2 pt-4">
          {missing.length > 0 && <p className="text-xs text-amber-600">Add at least one field for {missing.map((m) => m.name).join(", ")}.</p>}
          <Button className="w-full" size="lg" onClick={onNext}>Review &amp; send<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </aside>

      {/* Mobile bottom palette */}
      <div className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line p-3 lg:hidden">
        <AnimatePresence mode="wait">
          {sel ? (
            <motion.div key="sel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: colorOf(sel.recipientId) }}>{(() => { const I = FIELD_META[sel.type].icon; return <I className="h-4 w-4" />; })()}</span>
              <select className="input !py-2" value={sel.recipientId} onChange={(e) => patch(sel.id, { recipientId: e.target.value })}>
                {signers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={() => patch(sel.id, { required: !sel.required })} className={cn("rounded-lg px-2.5 py-2 text-xs font-semibold", sel.required ? "bg-sky-500/10 text-sky-600" : "text-muted")}>Req.</button>
              <button onClick={() => duplicate(sel.id)} className="rounded-lg p-2 text-muted" aria-label="Duplicate"><Copy className="h-4 w-4" /></button>
              <button onClick={() => remove(sel.id)} className="rounded-lg p-2 text-rose-500" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-muted" aria-label="Done"><Check className="h-4 w-4" /></button>
            </motion.div>
          ) : (
            <motion.div key="pal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {signers.map((r) => (
                  <button key={r.id} onClick={() => setCurrent(r.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold", current === r.id ? "border-transparent text-white" : "border-line text-muted")}
                    style={current === r.id ? { background: r.color } : undefined}>
                    {r.name.split(" ")[0]}
                  </button>
                ))}
                <Button size="sm" className="ml-auto shrink-0" onClick={onNext}>Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {FIELD_ORDER.map((t) => {
                  const M = FIELD_META[t];
                  return (
                    <button key={t} onClick={() => setArmed(armed === t ? null : t)}
                      className={cn("flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-semibold", armed === t ? "border-sky-400 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-line bg-surface")}>
                      <M.icon className="h-5 w-5" style={{ color: colorOf(current) }} />{M.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="h-36 lg:hidden" />
    </div>
  );
}

function FieldBox({ f, size, color, owner, selected, onSelect, onChange, onDelete }: {
  f: Field; size: { width: number; height: number }; color: string; owner: string; selected: boolean;
  onSelect: () => void; onChange: (p: Partial<Field>) => void; onDelete: () => void;
}) {
  const drag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; f: Field } | null>(null);
  const M = FIELD_META[f.type];
  const onDown = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, f };
    onSelect();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.sx) / size.width, dy = (e.clientY - d.sy) / size.height;
    if (d.mode === "move") onChange({ x: Math.min(1 - d.f.w, Math.max(0, d.f.x + dx)), y: Math.min(1 - d.f.h, Math.max(0, d.f.y + dy)) });
    else onChange({ w: Math.min(1 - d.f.x, Math.max(0.02, d.f.w + dx)), h: Math.min(1 - d.f.y, Math.max(0.012, d.f.h + dy)) });
  };
  const onUp = () => { drag.current = null; };
  const small = f.w * size.width < 70;

  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20, stiffness: 400 }}
      className={cn("group absolute touch-none select-none rounded-md border-2", selected ? "z-20 shadow-lg" : "z-10")}
      style={{ left: f.x * size.width, top: f.y * size.height, width: f.w * size.width, height: f.h * size.height, borderColor: color, background: `${color}22` }}
      onPointerDown={onDown("move")} onPointerMove={onMove} onPointerUp={onUp} onClick={(e) => e.stopPropagation()}>
      <div className="flex h-full items-center gap-1 overflow-hidden px-1.5 text-[11px] font-semibold" style={{ color }}>
        <M.icon className="h-3.5 w-3.5 shrink-0" />{!small && <span className="truncate">{f.label && f.type === "text" ? f.label : M.label}{f.required ? "*" : ""}</span>}
      </div>
      {selected && (
        <>
          <span className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>{owner}</span>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute -right-3 -top-3 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow" aria-label="Delete field"><X className="h-3.5 w-3.5" /></button>
          <span onPointerDown={onDown("resize")} onPointerMove={onMove} onPointerUp={onUp}
            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-full border-2 border-white shadow" style={{ background: color }} />
        </>
      )}
    </motion.div>
  );
}

function FieldProps({ f, recipients, onChange, onDelete, onDuplicate }: {
  f: Field; recipients: ClientRecipient[]; onChange: (p: Partial<Field>) => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const M = FIELD_META[f.type];
  return (
    <motion.div key={f.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-2"><M.icon className="h-5 w-5 text-sky-500" /><h3 className="font-display font-semibold">{M.label}</h3></div>
      <label className="block"><span className="label">Assigned to</span>
        <select className="input" value={f.recipientId} onChange={(e) => onChange({ recipientId: e.target.value })}>
          {recipients.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      {(f.type === "text" || f.type === "checkbox") && (
        <label className="block"><span className="label">Label / hint</span>
          <input className="input" value={f.label ?? ""} maxLength={80} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. ID number" />
        </label>
      )}
      <label className="flex items-center justify-between rounded-xl border border-line p-3 text-sm font-semibold">
        Required
        <input type="checkbox" className="h-5 w-5 accent-sky-500" checked={f.required} onChange={(e) => onChange({ required: e.target.checked })} />
      </label>
      {M.auto && <p className="rounded-xl bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">Auto-filled for the signer — they can still edit it.</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onDuplicate}><Copy className="h-4 w-4" />Duplicate</Button>
        <Button variant="ghost" size="sm" className="flex-1 !text-rose-500" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Button>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── Review ───────────────────────── */

function ReviewStep({ env, recipients, fields, meta, setMeta, self, flush, onBack }: {
  env: ClientEnvelope; recipients: ClientRecipient[]; fields: Field[];
  meta: { title: string; message: string; signingOrder: string; expiresAt: string; reminderDays: number | null };
  setMeta: React.Dispatch<React.SetStateAction<{ title: string; message: string; signingOrder: "sequential" | "parallel"; expiresAt: string; reminderDays: number | null }>>;
  self: boolean; flush: () => Promise<void>; onBack: () => void;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState(env.title);
  const [savingTpl, setSavingTpl] = useState(false);

  async function send() {
    setSending(true);
    try {
      await flush();
      const res = await api<{ selfLink: string | null; mail: boolean }>(`/api/envelopes/${env._id}/send`, { method: "POST" });
      if (res.selfLink && (self || recipients.filter((r) => r.role !== "cc").length === 1)) { router.push(res.selfLink); return; }
      toast.success(res.mail ? "Sent! Recipients have been emailed." : "Sent! Share the signing links from the envelope page.");
      router.push(`/app/envelopes/${env._id}?sent=1`);
    } catch (e) { toast.error((e as Error).message); setSending(false); }
  }

  async function saveTemplate() {
    setSavingTpl(true);
    try {
      await flush();
      await api(`/api/envelopes/${env._id}/template`, { method: "POST", json: { name: tplName } });
      toast.success("Template saved"); setTplOpen(false);
    } catch (e) { toast.error((e as Error).message); }
    setSavingTpl(false);
  }

  const sorted = [...recipients].sort((a, b) => a.order - b.order);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <h2 className="font-display text-2xl font-bold tracking-tight">{self ? "Ready to sign" : "Review & send"}</h2>
      <p className="mt-1 text-sm text-muted">{env.pages.length} page{env.pages.length > 1 ? "s" : ""} · {fields.length} field{fields.length === 1 ? "" : "s"}</p>

      <div className="card mt-6 divide-y divide-line">
        {sorted.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 p-4">
            {meta.signingOrder === "sequential" && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">{r.order}</span>}
            <Avatar name={r.name} color={r.color} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.name}</p>
              <p className="truncate text-xs text-muted">{r.email}</p>
            </div>
            <span className="text-right text-xs text-muted">
              {r.role === "cc" ? "Gets a copy" : r.role === "approver" ? "Approves" : `${fields.filter((f) => f.recipientId === r.id).length} fields`}
              {r.accessCode ? <span className="block text-amber-600">Access code</span> : null}
            </span>
          </motion.div>
        ))}
      </div>

      {!self && (
        <div className="mt-6 space-y-4">
          <label className="block"><span className="label">Message to recipients</span>
            <textarea className="input min-h-[110px]" maxLength={2000} placeholder="Hi! Please review and sign at your earliest convenience."
              value={meta.message} onChange={(e) => setMeta((m) => ({ ...m, message: e.target.value }))} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Expires on (optional)</span>
              <input type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={meta.expiresAt} onChange={(e) => setMeta((m) => ({ ...m, expiresAt: e.target.value }))} />
            </label>
            <label className="block"><span className="label">Auto-remind every</span>
              <select className="input" value={meta.reminderDays ?? 0} onChange={(e) => setMeta((m) => ({ ...m, reminderDays: Number(e.target.value) || null }))}>
                <option value={0}>Never</option><option value={1}>Day</option><option value={2}>2 days</option><option value={3}>3 days</option><option value={7}>Week</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button>
          {!self && <Button variant="outline" onClick={() => setTplOpen(true)}><LayoutTemplate className="h-4 w-4" />Save as template</Button>}
        </div>
        <Button size="lg" onClick={send} loading={sending}><Send className="h-4 w-4" />{self ? "Start signing" : "Send envelope"}</Button>
      </div>

      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Save as template"
        footer={<><Button variant="ghost" onClick={() => setTplOpen(false)}>Cancel</Button><Button onClick={saveTemplate} loading={savingTpl}>Save template</Button></>}>
        <p className="mb-4 text-sm text-muted">Recipients become roles you fill in each time. Fields and routing are kept.</p>
        <input className="input" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name" />
      </Modal>
    </div>
  );
}
