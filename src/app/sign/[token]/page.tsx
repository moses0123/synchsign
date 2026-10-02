"use client";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, Ban, Check, CheckCircle2, Clock, Download, FileSignature, KeyRound, Loader2, Lock, MoreVertical,
  Award, ShieldCheck, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Modal, api } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import { PdfViewer } from "@/components/pdf-viewer";
import { SignatureModal } from "@/components/signature-pad";
import type { Field } from "@/lib/types";
import { FIELD_META, todayString } from "@/lib/fields";
import { cn } from "@/lib/utils";

interface SignData {
  title: string; ownerName: string; ownerEmail: string; status: string; locked: boolean; wrongCode?: boolean;
  recipient: { id: string; name: string; email: string; role: string; status: string; color: string };
  message?: string; pages?: { w: number; h: number }[]; canAct?: boolean; waitingOnOthers?: boolean; completedAvailable?: boolean; certificateAvailable?: boolean;
  recipients?: { id: string; name: string; role: string; status: string; color: string; order: number }[];
  myFields?: Field[]; otherFields?: Field[];
  allowDecline?: boolean; consentText?: string;
  saved?: { signature?: string | null; initials?: string | null; company?: string; title?: string } | null;
}

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const search = useSearchParams();
  const [data, setData] = useState<SignData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [started, setStarted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sigFor, setSigFor] = useState<Field | null>(null);
  const [adopted, setAdopted] = useState<{ signature?: string; initials?: string }>({});
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState<null | { completed: boolean }>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [menu, setMenu] = useState(false);
  const [pulse, setPulse] = useState<string | null>(null);
  const codeRef = useRef("");

  const headers = useCallback((): Record<string, string> => (codeRef.current ? { "x-access-code": codeRef.current } : {}), []);

  const load = useCallback(async () => {
    try {
      const d = await api<SignData>(`/api/sign/${token}`, { headers: headers() });
      setData(d);
      if (!d.locked && d.myFields) {
        const init: Record<string, string> = {};
        for (const f of d.myFields) {
          if (f.type === "name") init[f.id] = d.recipient.name;
          if (f.type === "email") init[f.id] = d.recipient.email;
          if (f.type === "date") init[f.id] = todayString();
          if (f.type === "company" && d.saved?.company) init[f.id] = d.saved.company;
          if (f.type === "title" && d.saved?.title) init[f.id] = d.saved.title;
        }
        setValues((v) => ({ ...init, ...v }));
      }
      return d;
    } catch (e) { setError((e as Error).message); return null; }
  }, [token, headers]);

  useEffect(() => { load(); }, [load]);

  const fields = useMemo(() => data?.myFields ?? [], [data]);
  const required = fields.filter((f) => f.required);
  const filled = (f: Field) => Boolean(values[f.id]) && (f.type !== "checkbox" || values[f.id] === "true");
  const remaining = required.filter((f) => !filled(f));
  const progress = required.length ? (required.length - remaining.length) / required.length : 1;

  const source = useMemo(() => ({ url: `/api/sign/${token}/file${data?.completedAvailable ? "?kind=final" : ""}`, headers: headers() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, data?.completedAvailable, data?.locked]);

  function nextField() {
    const target = remaining[0] ?? fields.find((f) => !filled(f));
    if (!target) return;
    const el = document.querySelector(`[data-field="${target.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setPulse(target.id); setTimeout(() => setPulse(null), 1400);
      if ((target.type === "signature" || target.type === "initials") && !values[target.id]) setTimeout(() => clickSig(target), 450);
      else setTimeout(() => (el.querySelector("input") as HTMLInputElement | null)?.focus(), 450);
    } else {
      document.querySelector(`[data-page="${target.page}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(nextField, 700);
    }
  }

  function clickSig(f: Field) {
    const kind = f.type as "signature" | "initials";
    const existing = adopted[kind];
    if (existing && !values[f.id]) { setValues((v) => ({ ...v, [f.id]: existing })); navigator.vibrate?.(10); return; }
    setSigFor(f);
  }

  async function finish() {
    if (remaining.length) { toast.error(`${remaining.length} required field${remaining.length > 1 ? "s" : ""} left`); nextField(); return; }
    setFinishing(true);
    try {
      const res = await api<{ completed: boolean }>(`/api/sign/${token}/complete`, {
        method: "POST", headers: headers(), json: { values, adopt: data?.saved && !data.saved.signature ? adopted : undefined },
      });
      navigator.vibrate?.([20, 60, 20]);
      setDone(res);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    setFinishing(false);
  }

  async function decline() {
    try {
      await api(`/api/sign/${token}/decline`, { method: "POST", headers: headers(), json: { reason } });
      setDeclineOpen(false); toast.success("You declined this document"); await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setUnlocking(true);
    codeRef.current = code.trim();
    const d = await load();
    if (d?.locked) { codeRef.current = ""; toast.error("That code isn't right"); }
    setUnlocking(false);
  }

  const shell = (children: React.ReactNode) => (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card w-full max-w-md p-7 text-center sm:p-8">
        <LogoMark className="mx-auto h-11 w-11" />
        {children}
      </motion.div>
    </div>
  );

  if (error) return shell(<><XCircle className="mx-auto mt-6 h-10 w-10 text-rose-500" /><h1 className="mt-3 font-display text-xl font-bold">Link unavailable</h1><p className="mt-2 text-sm text-muted">{error}</p></>);
  if (!data) return <div className="grid min-h-dvh place-items-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>;

  if (data.locked) return shell(
    <form onSubmit={unlock}>
      <span className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-xl bg-amber-500/15 text-amber-600"><Lock className="h-7 w-7" /></span>
      <h1 className="mt-4 font-display text-xl font-bold">Enter your access code</h1>
      <p className="mt-2 text-sm text-muted"><strong>{data.ownerName}</strong> protected “{data.title}” with a code. They should have shared it with you separately.</p>
      <div className="relative mt-5">
        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input autoFocus className="input pl-10 text-center font-mono tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" />
      </div>
      <Button type="submit" className="mt-4 w-full" size="lg" loading={unlocking}>Unlock document</Button>
    </form>,
  );

  const r = data.recipient;
  const isApprover = r.role === "approver";

  if (done || (!data.canAct && !data.waitingOnOthers)) {
    const st = data.status;
    const icon = st === "completed" || r.status === "signed" || r.status === "approved" ? <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      : st === "voided" ? <Ban className="h-10 w-10 text-zinc-500" /> : st === "declined" ? <XCircle className="h-10 w-10 text-rose-500" /> : <Clock className="h-10 w-10 text-amber-500" />;
    const title = done ? (done.completed ? "Everyone has signed!" : isApprover ? "Approved — thank you!" : "You're all done!")
      : st === "completed" ? "This document is complete" : st === "voided" ? "This envelope was voided" : st === "declined" ? "This envelope was declined"
      : st === "expired" ? "This envelope has expired" : r.status === "signed" || r.status === "approved" ? "You've already completed this" : "Nothing to do";
    const body = done ? (done.completed ? "The signed document and its certificate of completion are ready to download." : `We'll email you the final copy once everyone has finished. ${data.ownerName} has been notified.`)
      : st === "completed" ? "Download the signed document and its certificate below." : st === "expired" ? `Ask ${data.ownerName} to extend or resend it.` : "No further action is needed from you.";
    return shell(
      <>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="mt-6 flex justify-center">
          {done ? <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10"><CheckCircle2 className="h-7 w-7 text-emerald-600" /></span> : icon}
        </motion.div>
        <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <p className="mt-4 truncate rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold">{data.title}</p>
        {data.completedAvailable && (
          <div className="mt-5 grid gap-2">
            <a href={`/api/sign/${token}/file?kind=final&download=1${codeRef.current ? `&code=${encodeURIComponent(codeRef.current)}` : ""}`}>
              <Button size="lg" className="w-full"><Download className="h-4 w-4" />Signed document</Button>
            </a>
            {data.certificateAvailable && (
              <a href={`/api/sign/${token}/file?kind=certificate&download=1${codeRef.current ? `&code=${encodeURIComponent(codeRef.current)}` : ""}`}>
                <Button size="lg" variant="outline" className="w-full"><Award className="h-4 w-4" />Certificate of completion</Button>
              </a>
            )}
          </div>
        )}
        <div className="mt-6 border-t border-line pt-5 text-sm text-muted">
          Need to send your own documents? <Link href="/register" className="font-semibold text-sky-600">Try SyncSign free</Link>
        </div>
      </>,
    );
  }

  if (data.waitingOnOthers) return shell(
    <>
      <Clock className="mx-auto mt-6 h-10 w-10 text-sky-500" />
      <h1 className="mt-3 font-display text-xl font-bold">Not your turn yet</h1>
      <p className="mt-2 text-sm text-muted">“{data.title}” is being signed in order. We&apos;ll email you as soon as it&apos;s your turn.</p>
      <div className="mt-5 space-y-2 text-left">
        {data.recipients?.filter((x) => x.role !== "cc").sort((a, b) => a.order - b.order).map((x) => (
          <div key={x.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
            <Avatar name={x.name} color={x.color} size={28} /><span className="flex-1 text-sm font-semibold">{x.name}{x.id === r.id && " (you)"}</span>
            <span className="text-xs text-muted">{x.status === "signed" || x.status === "approved" ? "Done" : x.status === "pending" ? "Waiting" : "In progress"}</span>
          </div>
        ))}
      </div>
    </>,
  );

  if (!started && !search.get("go")) return shell(
    <>
      <p className="mt-6 text-sm text-muted">{data.ownerName} sent you a document to {isApprover ? "approve" : "sign"}</p>
      <h1 className="mt-2 font-display text-2xl font-bold">{data.title}</h1>
      {data.message && <p className="mt-4 whitespace-pre-line rounded-xl bg-surface-2 p-4 text-left text-sm">{data.message}</p>}
      <div className="mt-5 flex items-center justify-center gap-6 text-sm">
        <span><strong className="font-display text-xl">{data.pages?.length}</strong><span className="block text-xs text-muted">pages</span></span>
        <span><strong className="font-display text-xl">{fields.length}</strong><span className="block text-xs text-muted">fields for you</span></span>
      </div>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-left text-xs leading-relaxed text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500" />
        {data.consentText || "I agree to use electronic records and signatures."} <span className="text-ink">({r.name}, {r.email})</span>
      </label>
      <Button size="lg" className="mt-4 w-full" disabled={!consent} onClick={() => { setStarted(true); setTimeout(nextField, 900); }}>
        <FileSignature className="h-5 w-5" />Review &amp; {isApprover ? "approve" : "sign"}
      </Button>
      {data.allowDecline !== false && <button onClick={() => setDeclineOpen(true)} className="mt-3 text-sm font-semibold text-muted hover:text-rose-500">Decline to sign</button>}
      <DeclineModal open={declineOpen} onClose={() => setDeclineOpen(false)} reason={reason} setReason={setReason} onDecline={decline} />
    </>,
  );

  const colorOf = (rid: string) => data.recipients?.find((x) => x.id === rid)?.color ?? "#94a3b8";

  return (
    <div className="min-h-dvh bg-surface-2/50">
      <header className="glass sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <LogoMark className="h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{data.title}</p>
            <p className="truncate text-xs text-muted">From {data.ownerName}</p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-xs font-semibold text-muted">{required.length - remaining.length}/{required.length} required</span>
            <Button onClick={finish} loading={finishing} disabled={remaining.length > 0}><Check className="h-4 w-4" />Finish</Button>
          </div>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="rounded-xl p-2 text-muted hover:bg-surface-2" aria-label="More"><MoreVertical className="h-5 w-5" /></button>
            <AnimatePresence>{menu && (<>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="card absolute right-0 z-50 mt-2 w-56 origin-top-right p-1.5">
                <a href={`${source.url}${source.url.includes("?") ? "&" : "?"}download=1${codeRef.current ? `&code=${encodeURIComponent(codeRef.current)}` : ""}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface-2"><Download className="h-4 w-4" />Download PDF</a>
                {data.allowDecline !== false && <button onClick={() => { setMenu(false); setDeclineOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-surface-2"><XCircle className="h-4 w-4" />Decline to sign</button>}
              </motion.div>
            </>)}</AnimatePresence>
          </div>
        </div>
        <div className="h-1 bg-surface-2"><motion.div className="h-full bg-gradient-to-r from-sky-400 to-sky-600" animate={{ width: `${progress * 100}%` }} /></div>
      </header>

      <main className="mx-auto max-w-5xl px-2 py-5 pb-32 sm:px-6">
        <PdfViewer source={source} pages={data.pages ?? []} maxWidth={860}
          renderOverlay={(page, size) => (
            <>
              {data.otherFields?.filter((f) => f.page === page).map((f) => (
                <div key={f.id} className="absolute flex items-center overflow-hidden" style={{ left: f.x * size.width, top: f.y * size.height, width: f.w * size.width, height: f.h * size.height }}>
                  {f.value?.startsWith("data:image") ? <img src={f.value} alt="" className="h-full w-full object-contain" />
                    : f.type === "checkbox" ? (f.value === "true" && <Check className="h-full w-full text-slate-800" />)
                    : <span className="truncate px-0.5 text-slate-800" style={{ fontSize: Math.min(f.h * size.height * 0.62, 14 * size.width / 612) }}>{f.value}</span>}
                </div>
              ))}
              {fields.filter((f) => f.page === page).map((f) => (
                <SignField key={f.id} f={f} size={size} color={colorOf(f.recipientId)} value={values[f.id] ?? ""} pulse={pulse === f.id}
                  onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))} onSig={() => clickSig(f)} />
              ))}
            </>
          )} />
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5 text-sky-500" />Secured by SyncSign · every action is recorded in the audit trail</p>
      </main>

      {/* Floating guide */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:pb-6">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <AnimatePresence mode="wait">
            {remaining.length > 0 ? (
              <motion.button key="next" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onClick={nextField}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 font-semibold text-white shadow-sm active:scale-[.98]">
                <motion.span animate={{ y: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}><ArrowDown className="h-5 w-5" /></motion.span>
                Next field · {remaining.length} left
              </motion.button>
            ) : (
              <motion.button key="finish" initial={{ y: 30, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onClick={finish} disabled={finishing}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white shadow-[0_10px_30px_-10px_rgb(16_185_129/.8)] active:scale-[.98]">
                {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{isApprover ? "Approve & finish" : "Finish signing"}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SignatureModal open={Boolean(sigFor)} onClose={() => setSigFor(null)} kind={sigFor?.type === "initials" ? "initials" : "signature"} name={r.name}
        initial={sigFor?.type === "initials" ? data.saved?.initials : data.saved?.signature}
        onAdopt={(url) => {
          const kind = sigFor?.type === "initials" ? "initials" : "signature";
          setAdopted((a) => ({ ...a, [kind]: url }));
          if (sigFor) setValues((v) => ({ ...v, [sigFor.id]: url }));
        }} />
      <DeclineModal open={declineOpen} onClose={() => setDeclineOpen(false)} reason={reason} setReason={setReason} onDecline={decline} />
    </div>
  );
}

function SignField({ f, size, color, value, onChange, onSig, pulse }: {
  f: Field; size: { width: number; height: number }; color: string; value: string; pulse: boolean;
  onChange: (v: string) => void; onSig: () => void;
}) {
  const M = FIELD_META[f.type];
  const style = { left: f.x * size.width, top: f.y * size.height, width: f.w * size.width, height: f.h * size.height };
  const fs = Math.max(9, Math.min(f.h * size.height * 0.6, 15));
  const base = cn("absolute rounded-md transition-shadow", pulse && "ring-4 ring-sky-400/60");
  const empty = !value || (f.type === "checkbox" && value !== "true");

  if (f.type === "signature" || f.type === "initials") {
    return (
      <motion.button data-field={f.id} type="button" onClick={value ? () => onChange("") : onSig} style={{ ...style, borderColor: empty ? color : "transparent" }}
        animate={pulse ? { scale: [1, 1.06, 1] } : {}} title={value ? "Tap to clear" : undefined}
        className={cn(base, "flex items-center justify-center overflow-hidden border-2", empty ? "border-dashed" : "border-transparent bg-transparent hover:border-dashed")}>
        {value ? <motion.img initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} src={value} alt={M.label} className="h-full w-full object-contain" />
          : <span className="flex items-center gap-1 px-1 text-[11px] font-bold" style={{ color, background: `${color}1f`, width: "100%", height: "100%", justifyContent: "center" }}>
              <M.icon className="h-4 w-4 shrink-0" /><span className="truncate">{f.type === "initials" ? "Initial" : "Sign here"}</span>{f.required && "*"}
            </span>}
      </motion.button>
    );
  }
  if (f.type === "checkbox") {
    return (
      <button data-field={f.id} type="button" onClick={() => onChange(value === "true" ? "" : "true")} style={{ ...style, borderColor: color, background: value === "true" ? color : `${color}1f` }}
        className={cn(base, "grid place-items-center border-2 text-white")} aria-label={f.label || "Checkbox"} title={f.label}>
        {value === "true" && <Check className="h-[80%] w-[80%]" strokeWidth={3} />}
      </button>
    );
  }
  return (
    <div data-field={f.id} style={{ ...style, borderColor: empty ? color : "transparent", background: empty ? `${color}1f` : "transparent" }} className={cn(base, "border-2 focus-within:!border-sky-400")}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.label || M.label + (f.required ? "*" : "")}
        className="h-full w-full bg-transparent px-1 text-slate-800 outline-none placeholder:text-slate-400" style={{ fontSize: fs }} />
    </div>
  );
}

function DeclineModal({ open, onClose, reason, setReason, onDecline }: { open: boolean; onClose: () => void; reason: string; setReason: (s: string) => void; onDecline: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Decline to sign"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} onClick={async () => { setBusy(true); await onDecline(); setBusy(false); }}>Decline</Button></>}>
      <p className="mb-3 text-left text-sm text-muted">The sender will be notified and the envelope will stop. Let them know why:</p>
      <textarea className="input min-h-[100px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The start date in clause 4 is wrong" maxLength={500} />
    </Modal>
  );
}
