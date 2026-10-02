"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";

export default function Verify() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { match: boolean; hash: string; id?: string; kind?: string }>(null);
  const [id, setId] = useState("");

  async function check(f?: File) {
    if (!f) return;
    setBusy(true); setResult(null);
    const fd = new FormData(); fd.append("file", f);
    const res = await fetch("/api/verify", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (res?.match) router.push(`/verify/${res.id}?hash=${res.hash}&kind=${res.kind}`); else if (res) setResult(res);
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5"><Logo /><Link href="/app" className="text-sm font-semibold text-muted hover:text-ink">Open SyncSign</Link></header>
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-6 text-center">
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-sky-600 text-white shadow-sm"><ShieldCheck className="h-8 w-8" /></motion.span>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">Verify a SyncSign document</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">Drop a PDF to check its fingerprint against our records. Your file is hashed and discarded — it is never stored.</p>

        <label className="mt-8 flex h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface transition hover:border-sky-400"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); check(e.dataTransfer.files[0]); }}>
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-sky-500" /> : <FileSearch className="h-8 w-8 text-sky-500" />}
          <span className="font-semibold">{busy ? "Checking fingerprint…" : "Drop a PDF or tap to choose"}</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => check(e.target.files?.[0])} />
        </label>

        <AnimatePresence>
          {result && !result.match && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mt-6 flex items-start gap-3 p-5 text-left">
              <ShieldAlert className="h-6 w-6 shrink-0 text-amber-500" />
              <div><p className="font-semibold">No matching SyncSign record</p><p className="mt-1 text-sm text-muted">This file was not produced by SyncSign, or it has been modified since signing.</p>
                <p className="mt-2 break-all font-mono text-xs text-muted">{result.hash}</p></div>
            </motion.div>
          )}
        </AnimatePresence>

        <form className="mt-8 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (id.trim()) router.push(`/verify/${id.trim()}`); }}>
          <input className="input font-mono" placeholder="…or enter an Envelope ID" value={id} onChange={(e) => setId(e.target.value)} />
          <Button type="submit" variant="outline">Look up</Button>
        </form>
        <p className="mt-10 text-sm text-muted">Want tamper-evident signing for your own documents? <Link href="/register" className="font-semibold text-sky-600">Start free</Link></p>
      </main>
    </div>
  );
}
