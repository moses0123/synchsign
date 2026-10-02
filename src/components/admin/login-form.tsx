"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ShieldHalf } from "lucide-react";
import { Button, api } from "../ui";
import { LogoMark } from "../logo";

function Form({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("expired") ? "Your admin session ended. Please sign in again." : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/admin/auth/login", { method: "POST", json: { email, password } });
      const next = params.get("next");
      router.replace(next && next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin");
      router.refresh();
    } catch (err) { setError((err as Error).message); setPassword(""); setBusy(false); }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <div className="leading-tight"><p className="font-display text-base font-bold">SyncSign</p><p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Admin portal</p></div>
        </div>
        <form onSubmit={submit} className="card p-6 sm:p-7">
          <div className="flex items-center gap-2"><ShieldHalf className="h-5 w-5 text-sky-600 dark:text-sky-400" /><h1 className="font-display text-lg font-semibold">Administrator sign in</h1></div>
          <p className="mt-1 text-sm text-muted">Use an account with the admin role. Admin sessions expire after 8 hours.</p>
          {error && <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          <label className="mt-5 block">
            <span className="label">Email</span>
            <span className="relative block"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input pl-10" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!defaultEmail} /></span>
          </label>
          <label className="mt-4 block">
            <span className="label">Password</span>
            <span className="relative block"><Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input px-10" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={Boolean(defaultEmail)} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Show password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
          </label>
          <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>Sign in to admin portal</Button>
          <p className="mt-4 text-center text-xs text-muted">Forgot your password? Another administrator can reset it from Users.</p>
        </form>
        <p className="mt-5 text-center text-sm text-muted"><Link href="/app" className="font-medium text-sky-700 hover:underline dark:text-sky-400">Back to SyncSign</Link></p>
      </motion.div>
    </div>
  );
}

export function AdminLoginForm({ defaultEmail }: { defaultEmail: string }) {
  return <Suspense><Form defaultEmail={defaultEmail} /></Suspense>;
}
