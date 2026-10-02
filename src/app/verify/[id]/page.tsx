"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

interface Info {
  id: string; title: string; sender: string; status: string; createdAt: string; sentAt: string | null; completedAt: string | null; pages: number;
  originalHash: string; completedHash: string | null; certificateHash: string | null; recipients: { name: string; email: string; role: string; status: string; completedAt: string | null }[];
}

export default function VerifyId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useSearchParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetch(`/api/verify/${id}`).then(async (r) => { const d = await r.json(); if (r.ok) setInfo(d); else setErr(d.error); }).catch(() => setErr("Could not load")); }, [id]);
  const matched = q.get("hash");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5"><Logo /><Link href="/app" className="text-sm font-semibold text-muted hover:text-ink">Open SyncSign</Link></header>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        <Link href="/verify" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Verify another</Link>
        {!info && !err && <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>}
        {err && <div className="card mt-6 flex items-center gap-3 p-6"><XCircle className="h-6 w-6 text-rose-500" /><p className="font-semibold">{err}</p></div>}
        {info && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            <div className={`card overflow-hidden`}>
              <div className={`flex items-center gap-4 p-6 ${info.status === "completed" ? "bg-gradient-to-br from-emerald-500/15 to-transparent" : "bg-gradient-to-br from-sky-500/10 to-transparent"}`}>
                <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10, delay: 0.2 }}
                  className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl text-white ${info.status === "completed" ? "bg-emerald-500" : "bg-sky-500"}`}>
                  {info.status === "completed" ? <CheckCircle2 className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
                </motion.span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-muted">{matched ? (q.get("kind") === "signed" ? "Authentic signed document" : q.get("kind") === "certificate" ? "Authentic certificate of completion" : "Matches the original upload") : "SyncSign envelope record"}</p>
                  <h1 className="truncate font-display text-xl font-bold">{info.title}</h1>
                  <p className="text-sm text-muted">Sent by {info.sender}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-t border-line p-6 text-sm">
                <div><dt className="text-xs text-muted">Status</dt><dd className="mt-1"><StatusBadge status={info.status} /></dd></div>
                <div><dt className="text-xs text-muted">Pages</dt><dd className="mt-1 font-semibold">{info.pages}</dd></div>
                <div><dt className="text-xs text-muted">Sent</dt><dd className="mt-1 font-semibold">{fmtDate(info.sentAt, true)}</dd></div>
                <div><dt className="text-xs text-muted">Completed</dt><dd className="mt-1 font-semibold">{fmtDate(info.completedAt, true)}</dd></div>
              </dl>
            </div>
            <div className="card divide-y divide-line">
              {info.recipients.map((r) => (
                <div key={r.email + r.name} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><p className="truncate text-xs text-muted">{r.email} · {r.role}</p></div>
                  <div className="text-right"><StatusBadge status={r.status} recipient />{r.completedAt && <p className="mt-1 text-[11px] text-muted">{fmtDate(r.completedAt, true)}</p>}</div>
                </div>
              ))}
            </div>
            <div className="card space-y-3 p-5 text-xs">
              <div><p className="text-muted">Envelope ID</p><p className="break-all font-mono">{info.id}</p></div>
              <div><p className="text-muted">Original SHA-256</p><p className={`break-all font-mono ${matched === info.originalHash ? "text-emerald-600" : ""}`}>{info.originalHash}</p></div>
              {info.completedHash && <div><p className="text-muted">Signed document SHA-256</p><p className={`break-all font-mono ${matched === info.completedHash ? "text-emerald-600" : ""}`}>{info.completedHash}</p></div>}
              {info.certificateHash && <div><p className="text-muted">Certificate SHA-256</p><p className={`break-all font-mono ${matched === info.certificateHash ? "text-emerald-600" : ""}`}>{info.certificateHash}</p></div>}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
