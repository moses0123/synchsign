"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Eye, EyeOff, Info, Loader2, Send, XCircle } from "lucide-react";
import { Button, Skeleton, api } from "@/components/ui";
import { Field, PageHeader, Section, Toggle, useAdminSettings, type AdminSettings } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

type Sec = "ssl" | "starttls" | "none";
const PROVIDERS: { id: string; name: string; host: string; port: number; security: Sec; user?: string; note: string }[] = [
  { id: "gmail", name: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 465, security: "ssl", note: "Turn on 2-Step Verification, then create an App Password (Google Account → Security → App passwords) and use it as the password. Username is your full Gmail address." },
  { id: "m365", name: "Microsoft 365 / Outlook", host: "smtp.office365.com", port: 587, security: "starttls", note: "Use your full mailbox address as the username. SMTP AUTH must be enabled for the mailbox in the Microsoft 365 admin centre; with MFA, use an app password." },
  { id: "zoho", name: "Zoho Mail", host: "smtp.zoho.com", port: 465, security: "ssl", note: "Use your Zoho address and an application-specific password. EU/IN accounts use smtp.zoho.eu or smtp.zoho.in." },
  { id: "resend", name: "Resend", host: "smtp.resend.com", port: 465, security: "ssl", user: "resend", note: "Username is literally “resend”; the password is your API key. The From address must be on a domain you verified in Resend." },
  { id: "sendgrid", name: "SendGrid", host: "smtp.sendgrid.net", port: 587, security: "starttls", user: "apikey", note: "Username is literally “apikey”; the password is an API key with Mail Send permission. Verify your sender or domain first." },
  { id: "brevo", name: "Brevo", host: "smtp-relay.brevo.com", port: 587, security: "starttls", note: "Use the SMTP login and SMTP key from Brevo → SMTP & API (not your account password)." },
  { id: "mailgun", name: "Mailgun", host: "smtp.mailgun.org", port: 587, security: "starttls", note: "Use the SMTP credentials for your sending domain (Domain settings → SMTP credentials). EU region uses smtp.eu.mailgun.org." },
  { id: "ses", name: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587, security: "starttls", note: "Change the region in the host to match yours. Create SMTP credentials in the SES console — they differ from your AWS access keys." },
  { id: "custom", name: "Other / cPanel / custom server", host: "", port: 587, security: "starttls", note: "Ask your host for the SMTP server, port and encryption. Most use 465 with SSL/TLS or 587 with STARTTLS." },
];

type Draft = AdminSettings["email"] & { password: string };
interface TestResult { ok: boolean; steps: { step: string; ok: boolean; detail?: string }[]; ms: number }

export default function EmailSettings() {
  const { settings, save, saving, envSmtp } = useAdminSettings();
  const [d, setD] = useState<Draft | null>(null);
  const [n, setN] = useState<AdminSettings["notifications"] | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [to, setTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => { if (settings) { setD({ ...settings.email, password: "" }); setN(settings.notifications); } }, [settings]);
  useEffect(() => { api<{ user: { email: string } }>("/api/admin/auth/me").then((r) => setTo(r.user.email)).catch(() => {}); }, []);

  if (!settings || !d || !n) return <><PageHeader title="Email (SMTP)" /><Skeleton className="h-96" /></>;
  const provider = PROVIDERS.find((p) => p.id === d.provider) ?? PROVIDERS[PROVIDERS.length - 1]!;
  const set = (p: Partial<Draft>) => { setD({ ...d, ...p }); setResult(null); };
  const KEYS = ["enabled", "host", "port", "security", "user", "fromName", "fromEmail", "replyTo", "provider"] as const;
  const dirty = KEYS.some((k) => d[k] !== settings.email[k]) || Boolean(d.password);

  async function saveEmail(extra: Partial<{ clearPassword: boolean; enabled: boolean }> = {}) {
    const { hasPassword: _h, password, ...rest } = d!; void _h;
    const ok = await save({ email: { ...rest, ...(password ? { password } : {}), ...extra } }, extra.clearPassword ? "Saved password removed" : "Email settings saved");
    if (ok) setD((x) => (x ? { ...x, password: "" } : x));
  }
  async function test() {
    setTesting(true); setResult(null);
    try {
      const { hasPassword: _h, ...draft } = d!; void _h;
      setResult(await api<TestResult>("/api/admin/email/test", { method: "POST", json: { to, draft } }));
    } catch (e) { setResult({ ok: false, steps: [{ step: "Test", ok: false, detail: (e as Error).message }], ms: 0 }); }
    setTesting(false);
  }

  const status = settings.email.enabled && settings.email.host
    ? { tone: "ok", text: `Sending through ${settings.email.host}:${settings.email.port}`, sub: `From ${settings.email.fromName || "SyncSign"} <${settings.email.fromEmail || settings.email.user}>` }
    : envSmtp ? { tone: "info", text: "Using SMTP settings from the server's .env file", sub: "Settings saved here take priority once you turn them on." }
    : { tone: "warn", text: "Email is not set up", sub: "Invitations aren't emailed — senders share signing links manually. Configure SMTP below." };

  return (
    <div className="space-y-5">
      <PageHeader title="Email (SMTP)" body="Connect a mail server so SyncSign can send signing invitations, reminders and completion notices from your own address." />

      <div className={cn("flex items-start gap-3 rounded-xl border p-4",
        status.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : status.tone === "info" ? "border-sky-500/30 bg-sky-500/5" : "border-amber-500/30 bg-amber-500/5")}>
        {status.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : status.tone === "info" ? <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
        <div><p className="text-sm font-semibold">{status.text}</p><p className="text-xs text-muted">{status.sub}</p></div>
      </div>

      <Section title="Mail server" body="Pick your provider to fill in the server details, then enter your credentials."
        footer={<>
          {dirty && <span className="mr-auto text-xs text-muted">Unsaved changes</span>}
          <Button variant="ghost" onClick={() => setD({ ...settings.email, password: "" })} disabled={!dirty}>Discard</Button>
          <Button onClick={() => saveEmail()} loading={saving}>Save settings</Button>
        </>}>
        <Toggle checked={d.enabled} onChange={(v) => set({ enabled: v })} label="Send email through this server" description="When off, SyncSign falls back to .env settings (if any) or shows links to share manually." />

        <Field label="Provider">
          <select className="input" value={d.provider} onChange={(e) => {
            const p = PROVIDERS.find((x) => x.id === e.target.value)!;
            set({ provider: p.id, ...(p.id !== "custom" ? { host: p.host, port: p.port, security: p.security, ...(p.user ? { user: p.user } : {}) } : {}) });
          }}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{provider.note}</p>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px_170px]">
          <Field label="SMTP server"><input className="input font-mono" value={d.host} onChange={(e) => set({ host: e.target.value.trim() })} placeholder="smtp.example.com" /></Field>
          <Field label="Port"><input className="input font-mono" type="number" min={1} max={65535} value={d.port} onChange={(e) => set({ port: Number(e.target.value) || 587 })} /></Field>
          <Field label="Encryption">
            <select className="input" value={d.security} onChange={(e) => set({ security: e.target.value as Sec })}>
              <option value="ssl">SSL/TLS (465)</option><option value="starttls">STARTTLS (587)</option><option value="none">None (not recommended)</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username"><input className="input" autoComplete="off" value={d.user} onChange={(e) => set({ user: e.target.value.trim() })} placeholder="you@company.com" /></Field>
          <Field label="Password / API key" hint={settings.email.hasPassword ? <>A password is saved (encrypted). Leave blank to keep it. <button type="button" className="font-medium text-rose-600" onClick={() => saveEmail({ clearPassword: true })}>Remove it</button></> : "Stored encrypted. Never shown again after saving."}>
            <span className="relative block">
              <input className="input pr-10 font-mono" type={showPw ? "text" : "password"} autoComplete="new-password" value={d.password}
                onChange={(e) => set({ password: e.target.value })} placeholder={settings.email.hasPassword ? "•••••••• (saved)" : "Enter password or API key"} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Show password">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </span>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="From name"><input className="input" value={d.fromName} onChange={(e) => set({ fromName: e.target.value })} placeholder="SyncSign" /></Field>
          <Field label="From address" hint="Must be allowed by your provider."><input className="input" type="email" value={d.fromEmail} onChange={(e) => set({ fromEmail: e.target.value.trim() })} placeholder="no-reply@company.com" /></Field>
          <Field label="Reply-to (optional)"><input className="input" type="email" value={d.replyTo} onChange={(e) => set({ replyTo: e.target.value.trim() })} placeholder="support@company.com" /></Field>
        </div>
      </Section>

      <Section title="Send a test email" body="Checks the connection and login, then sends a real message. Uses the values in the form above, even if they're not saved yet.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Send the test to…" />
          <Button onClick={test} loading={testing} disabled={!d.host} className="shrink-0"><Send className="h-4 w-4" />Send test</Button>
        </div>
        <AnimatePresence>
          {testing && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Connecting to {d.host}…</motion.p>}
          {result && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-lg border p-4", result.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")}>
              <p className="text-sm font-semibold">{result.ok ? "It works — check the inbox (and spam folder)." : "The test didn't go through"}</p>
              <ul className="mt-2 space-y-1.5">
                {result.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    {s.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                    <span><span className="font-medium">{s.step}</span>{s.detail && <span className="block break-words text-xs text-muted">{s.detail}</span>}</span>
                  </li>
                ))}
              </ul>
              {result.ok && dirty && <p className="mt-3 text-xs text-muted">Remember to <button className="font-semibold text-sky-700 dark:text-sky-400" onClick={() => saveEmail({ enabled: true })}>save and turn on</button> these settings.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Section title="Which emails are sent" body="Turn individual notifications on or off for everyone."
        footer={<Button onClick={() => save({ notifications: n }, "Notification settings saved")} loading={saving}>Save notifications</Button>}>
        <Toggle checked={n.invite} onChange={(v) => setN({ ...n, invite: v })} label="Signing invitations" description="Sent to each recipient when it's their turn. Also used for new-account emails." />
        <Toggle checked={n.reminder} onChange={(v) => setN({ ...n, reminder: v })} label="Reminders" description="Manual reminders and the automatic daily reminders." />
        <Toggle checked={n.signerDone} onChange={(v) => setN({ ...n, signerDone: v })} label="“Someone signed” updates to the sender" />
        <Toggle checked={n.completed} onChange={(v) => setN({ ...n, completed: v })} label="Completed — documents ready" description="Sent to everyone when the last person signs." />
        <Toggle checked={n.declined} onChange={(v) => setN({ ...n, declined: v })} label="Declined notices to the sender" />
        <Toggle checked={n.voided} onChange={(v) => setN({ ...n, voided: v })} label="Voided notices to recipients" />
      </Section>
    </div>
  );
}
