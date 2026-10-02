"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { Button, api } from "@/components/ui";
import { Logo } from "@/components/logo";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: params.get("email") ?? "", password: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: form });
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/app");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  const [policy, setPolicy] = useState<{ registration: string; allowedDomains: string[] } | null>(null);
  useEffect(() => { if (mode === "register") fetch("/api/config").then((r) => r.json()).then(setPolicy).catch(() => {}); }, [mode]);

  const strength = Math.min(4, [/.{8,}/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(form.password)).length);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between"><Logo /></div>
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="font-display text-3xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-muted">{mode === "login" ? "Sign in to send and track your documents." : "Free forever for personal use. No card required."}</p>
          {mode === "register" && policy?.registration === "closed" && <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">New sign-ups are by invitation. Ask your administrator to create an account for you.</p>}
          {mode === "register" && policy?.registration === "domains" && policy.allowedDomains.length > 0 && <p className="mt-6 rounded-lg bg-surface-2 p-3 text-sm text-muted">Use your work email ({policy.allowedDomains.map((d) => "@" + d).join(", ")}).</p>}
          <div className="mt-8 space-y-4">
            {mode === "register" && (
              <Field icon={User} label="Full name">
                <input className="input pl-10" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Johnson" />
              </Field>
            )}
            <Field icon={Mail} label="Email">
              <input className="input pl-10" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
            </Field>
            <Field icon={Lock} label="Password">
              <input className="input px-10" type={show ? "text" : "password"} required minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Toggle password visibility">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>
            {mode === "register" && form.password && (
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <motion.span key={i} className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: i < strength ? ["#f43f5e", "#f59e0b", "#38bdf8", "#10b981"][strength - 1] : "rgb(var(--line))" }} />
                ))}
              </div>
            )}
          </div>
          <Button type="submit" size="lg" className="mt-7 w-full" loading={loading}>{mode === "login" ? "Sign in" : "Create account"}</Button>
          <p className="mt-6 text-center text-sm text-muted">
            {mode === "login" ? <>New to SyncSign? <Link href="/register" className="font-semibold text-sky-600">Create an account</Link></> : <>Already have an account? <Link href="/login" className="font-semibold text-sky-600">Sign in</Link></>}
          </p>
        </motion.form>
      </div>
      <div className="relative hidden overflow-hidden bg-sky-700 lg:block">
        <div className="grid-bg absolute inset-0 opacity-20" />
        <div className="absolute inset-0 flex flex-col justify-end p-14 text-white">
          <svg viewBox="0 0 400 120" className="mb-10 w-80">
            <motion.path d="M10 80 C 40 10, 70 10, 66 64 S 100 110, 130 60 S 170 10, 180 70 C 190 110, 220 40, 240 60 S 290 90, 310 44 S 360 60, 390 52"
              fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: "easeInOut", delay: 0.3 }} />
          </svg>
          <p className="max-w-md font-display text-3xl font-semibold leading-snug">Close multi-party agreements across borders — before lunch.</p>
          <p className="mt-4 text-sky-100">Fast, verifiable agreements on any device.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        {children}
      </span>
    </label>
  );
}
