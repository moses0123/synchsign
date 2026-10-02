"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, KeyRound, LogOut, PenLine, Save, ShieldHalf, Smartphone } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar, Button, Skeleton, api } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignatureModal } from "@/components/signature-pad";

interface Me { name: string; email: string; company?: string; title?: string; signature?: string | null; initials?: string | null; isAdmin?: boolean }

export default function Settings() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);
  const [pad, setPad] = useState<"signature" | "initials" | null>(null);
  useEffect(() => { api<{ user: Me }>("/api/me").then((d) => setMe(d.user)); }, []);

  async function save(patch: Partial<Me> = {}) {
    if (!me) return;
    const next = { ...me, ...patch };
    setMe(next); setSaving(true);
    try {
      await api("/api/me", { method: "PATCH", json: { name: next.name, company: next.company ?? "", title: next.title ?? "", signature: next.signature ?? null, initials: next.initials ?? null } });
      toast.success("Saved"); router.refresh();
    } catch (e) { toast.error((e as Error).message); }
    setSaving(false);
  }

  if (!me) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 sm:p-6">
        <div className="flex items-center gap-4"><Avatar name={me.name} size={56} /><div><p className="font-display text-lg font-semibold">{me.name}</p><p className="text-sm text-muted">{me.email}</p></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="label">Full name</span><input className="input" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} /></label>
          <label className="block"><span className="label">Company</span><input className="input" value={me.company ?? ""} onChange={(e) => setMe({ ...me, company: e.target.value })} placeholder="Auto-fills company fields" /></label>
          <label className="block"><span className="label">Job title</span><input className="input" value={me.title ?? ""} onChange={(e) => setMe({ ...me, title: e.target.value })} placeholder="Auto-fills title fields" /></label>
        </div>
        <Button className="mt-5" onClick={() => save()} loading={saving}><Save className="h-4 w-4" />Save profile</Button>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5 sm:p-6">
        <h2 className="font-display font-semibold">Saved signature</h2>
        <p className="mt-1 text-sm text-muted">Used with one tap whenever you sign while logged in.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
          {(["signature", "initials"] as const).map((k) => (
            <button key={k} onClick={() => setPad(k)} className="group flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-line bg-white p-3 transition hover:border-sky-300">
              {me[k] ? <img src={me[k]!} alt={k} className="max-h-full max-w-full object-contain" /> : <span className="flex items-center gap-2 text-sm font-semibold text-slate-400 group-hover:text-sky-500"><PenLine className="h-4 w-4" />Add {k}</span>}
            </button>
          ))}
        </div>
        {(me.signature || me.initials) && <button onClick={() => save({ signature: null, initials: null })} className="mt-3 text-sm font-semibold text-rose-500">Remove saved marks</button>}
      </motion.section>

      <PasswordSection />

      {me.isAdmin && (
        <Link href="/admin" className="card flex items-center gap-4 p-5 transition-colors hover:border-sky-300 sm:p-6">
          <ShieldHalf className="h-6 w-6 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="flex-1"><h2 className="font-display font-semibold">Admin portal</h2><p className="text-sm text-muted">Email (SMTP), users, signing policies and branding for everyone.</p></div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5 sm:p-6">
        <h2 className="font-display font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted">“Device” follows your phone or computer&apos;s light/dark setting.</p>
        <ThemeToggle labels className="mt-4 w-full sm:w-80" />
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card flex items-center gap-4 p-5 sm:p-6">
        <Smartphone className="h-8 w-8 shrink-0 text-sky-500" />
        <div className="flex-1"><h2 className="font-display font-semibold">Install the app</h2><p className="text-sm text-muted">In your browser menu choose “Install app” or “Add to Home Screen”.</p></div>
      </motion.section>

      <Button variant="outline" className="w-full !text-rose-500 lg:hidden" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}><LogOut className="h-4 w-4" />Sign out</Button>

      <SignatureModal open={Boolean(pad)} onClose={() => setPad(null)} kind={pad ?? "signature"} name={me.name} onAdopt={(url) => save({ [pad!]: url })} />
    </div>
  );
}

function PasswordSection() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.confirm) { toast.error("The new passwords don't match"); return; }
    setBusy(true);
    try { await api("/api/me/password", { method: "POST", json: { current: f.current, next: f.next } }); toast.success("Password changed"); setF({ current: "", next: "", confirm: "" }); }
    catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-display font-semibold"><KeyRound className="h-4 w-4 text-muted" />Password</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input className="input" type="password" autoComplete="current-password" placeholder="Current password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
        <input className="input" type="password" autoComplete="new-password" placeholder="New password" minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
        <input className="input" type="password" autoComplete="new-password" placeholder="Confirm new password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
      </div>
      <Button className="mt-4" type="submit" variant="outline" loading={busy}>Change password</Button>
    </form>
  );
}
