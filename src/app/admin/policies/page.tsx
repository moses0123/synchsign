"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { Field, PageHeader, Section, Toggle, useAdminSettings, type AdminSettings } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export default function Policies() {
  const { settings, save, saving } = useAdminSettings();
  const [sg, setSg] = useState<AdminSettings["signing"] | null>(null);
  const [ac, setAc] = useState<AdminSettings["access"] | null>(null);
  const [domain, setDomain] = useState("");
  useEffect(() => { if (settings) { setSg(settings.signing); setAc(settings.access); } }, [settings]);
  if (!sg || !ac) return <><PageHeader title="Signing & access" /><Skeleton className="h-96" /></>;

  const addDomain = () => {
    const v = domain.trim().toLowerCase().replace(/^@/, "");
    if (v && !ac.allowedDomains.includes(v)) setAc({ ...ac, allowedDomains: [...ac.allowedDomains, v] });
    setDomain("");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Signing & access" body="Defaults and rules that apply to everyone in this workspace." />

      <Section title="Signing defaults" body="Applied to new envelopes. Senders can still change reminders and expiry per envelope."
        footer={<Button onClick={() => save({ signing: sg }, "Signing settings saved")} loading={saving}>Save signing settings</Button>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Automatic reminders" hint="Every N days until signed">
            <select className="input" value={sg.defaultReminderDays ?? 0} onChange={(e) => setSg({ ...sg, defaultReminderDays: Number(e.target.value) || null })}>
              <option value={0}>Off</option>{[1, 2, 3, 5, 7, 14].map((n) => <option key={n} value={n}>Every {n} day{n > 1 ? "s" : ""}</option>)}
            </select>
          </Field>
          <Field label="Envelopes expire after" hint="Unsigned envelopes close automatically">
            <select className="input" value={sg.defaultExpiryDays ?? 0} onChange={(e) => setSg({ ...sg, defaultExpiryDays: Number(e.target.value) || null })}>
              <option value={0}>Never</option>{[7, 14, 30, 60, 90, 120].map((n) => <option key={n} value={n}>{n} days</option>)}
            </select>
          </Field>
          <Field label="Maximum PDF size" hint="Per upload, 1–50 MB">
            <div className="relative"><input className="input pr-12" type="number" min={1} max={50} value={sg.maxUploadMB} onChange={(e) => setSg({ ...sg, maxUploadMB: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">MB</span></div>
          </Field>
        </div>
        <Toggle checked={sg.allowDecline} onChange={(v) => setSg({ ...sg, allowDecline: v })} label="Allow recipients to decline" description="When off, the “Decline to sign” option is hidden from signers." />
        <Field label="Electronic signature consent" hint="Shown to every signer before they open the document. Check the wording meets the e-signature rules where you operate.">
          <textarea className="input min-h-[90px]" value={sg.consentText} maxLength={1000} onChange={(e) => setSg({ ...sg, consentText: e.target.value })} />
        </Field>
      </Section>

      <Section title="Who can create an account" body="Signers never need an account — this only controls who can send documents."
        footer={<Button onClick={() => save({ access: ac }, "Access settings saved")} loading={saving}>Save access settings</Button>}>
        <div className="grid gap-2 sm:grid-cols-3">
          {([["open", "Anyone", "Public sign-up is open"], ["domains", "Approved domains", "Only emails at your company domains"], ["closed", "Invite only", "Admins create accounts in Users"]] as const).map(([v, t, d]) => (
            <button key={v} type="button" onClick={() => setAc({ ...ac, registration: v })}
              className={cn("rounded-lg border p-3 text-left transition-colors", ac.registration === v ? "border-sky-500 bg-sky-500/5 ring-1 ring-sky-500" : "border-line hover:border-sky-300")}>
              <p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted">{d}</p>
            </button>
          ))}
        </div>
        {ac.registration === "domains" && (
          <div>
            <span className="label">Allowed email domains</span>
            <div className="flex flex-wrap gap-1.5">
              {ac.allowedDomains.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium">@{d}
                  <button onClick={() => setAc({ ...ac, allowedDomains: ac.allowedDomains.filter((x) => x !== d) })} aria-label={`Remove ${d}`}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addDomain(); }}>
              <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company.com" />
              <Button type="submit" variant="outline">Add</Button>
            </form>
          </div>
        )}
      </Section>
    </div>
  );
}
