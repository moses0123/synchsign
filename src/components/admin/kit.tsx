"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../ui";
import { cn } from "@/lib/utils";

export function PageHeader({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {body && <p className="mt-1 max-w-2xl text-sm text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, body, children, footer }: { title: string; body?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {body && <p className="mt-0.5 text-sm text-muted">{body}</p>}
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3 sm:px-6">{footer}</div>}
    </section>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed opacity-60")}>
      <span><span className="block text-sm font-medium">{label}</span>{description && <span className="block text-xs text-muted">{description}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-600")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export interface AdminSettings {
  email: { enabled: boolean; host: string; port: number; security: "ssl" | "starttls" | "none"; user: string; hasPassword: boolean; passwordUnreadable?: boolean; fromName: string; fromEmail: string; replyTo: string; provider: string };
  notifications: { invite: boolean; reminder: boolean; signerDone: boolean; completed: boolean; declined: boolean; voided: boolean };
  signing: { defaultReminderDays: number | null; defaultExpiryDays: number | null; maxUploadMB: number; allowDecline: boolean; consentText: string };
  access: { registration: "open" | "domains" | "closed"; allowedDomains: string[] };
  branding: { orgName: string; supportEmail: string; emailFooter: string; emailAccent: string };
  updatedAt?: string; updatedBy?: string;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [envSmtp, setEnvSmtp] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api<{ settings: AdminSettings; envSmtp: boolean }>("/api/admin/settings").then((d) => { setSettings(d.settings); setEnvSmtp(d.envSmtp); }).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const save = useCallback(async (patch: Record<string, unknown>, msg = "Settings saved") => {
    setSaving(true);
    try {
      const d = await api<{ settings: AdminSettings }>("/api/admin/settings", { method: "PATCH", json: patch });
      setSettings(d.settings); toast.success(msg); return true;
    } catch (e) { toast.error((e as Error).message); return false; }
    finally { setSaving(false); }
  }, []);
  return { settings, setSettings, save, saving, envSmtp, reload: load };
}
