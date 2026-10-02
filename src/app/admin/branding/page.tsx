"use client";
import { useEffect, useState } from "react";
import { Button, Skeleton } from "@/components/ui";
import { Field, PageHeader, Section, useAdminSettings, type AdminSettings } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

const ACCENTS = ["#0284c7", "#0f172a", "#1d4ed8", "#0f766e", "#7c3aed", "#b91c1c", "#b45309"];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export default function Branding() {
  const { settings, save, saving } = useAdminSettings();
  const [b, setB] = useState<AdminSettings["branding"] | null>(null);
  useEffect(() => { if (settings) setB(settings.branding); }, [settings]);
  if (!b) return <><PageHeader title="Branding" /><Skeleton className="h-96" /></>;
  const accent = /^#[0-9a-f]{6}$/i.test(b.emailAccent) ? b.emailAccent : "#0284c7";

  const preview = `<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif"><div style="padding:20px"><div style="max-width:520px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
  <div style="padding:18px 24px;border-bottom:3px solid ${accent};font-weight:700;font-size:17px;color:#0f172a">${esc(b.orgName || "SyncSign")}</div>
  <div style="padding:24px"><h1 style="margin:0 0 10px;font-size:18px;color:#0f172a">Alex needs your signature</h1>
  <p style="font-size:14px;line-height:1.6;color:#334155;margin:0">Hi Jordan,<br><b>Alex Johnson</b> has sent you <b>Service Agreement</b>.</p>
  <p style="margin:22px 0 4px"><span style="background:${accent};color:#fff;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">Review &amp; sign</span></p></div>
  <div style="padding:14px 24px;background:#f8fafc;font-size:12px;line-height:1.5;color:#64748b">${esc(b.emailFooter)}${b.supportEmail ? `<br>Questions? Contact <span style="color:${accent}">${esc(b.supportEmail)}</span>` : ""}</div>
  </div></div></body>`;

  return (
    <div className="space-y-5">
      <PageHeader title="Branding" body="How your organisation appears in emails sent by SyncSign." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Section title="Email appearance" footer={<Button onClick={() => save({ branding: b }, "Branding saved")} loading={saving}>Save branding</Button>}>
          <Field label="Organisation name" hint="Shown at the top of every email and as the default sender name."><input className="input" value={b.orgName} maxLength={80} onChange={(e) => setB({ ...b, orgName: e.target.value })} /></Field>
          <Field label="Support email (optional)"><input className="input" type="email" value={b.supportEmail} onChange={(e) => setB({ ...b, supportEmail: e.target.value.trim() })} placeholder="support@company.com" /></Field>
          <div>
            <span className="label">Accent colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => <button key={c} onClick={() => setB({ ...b, emailAccent: c })} className={cn("h-7 w-7 rounded-full ring-offset-2 ring-offset-surface", b.emailAccent === c && "ring-2 ring-slate-400")} style={{ background: c }} aria-label={c} />)}
              <input type="color" value={accent} onChange={(e) => setB({ ...b, emailAccent: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" />
            </div>
          </div>
          <Field label="Email footer"><textarea className="input min-h-[80px]" maxLength={400} value={b.emailFooter} onChange={(e) => setB({ ...b, emailFooter: e.target.value })} /></Field>
        </Section>
        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3 text-sm font-semibold">Preview</div>
          <iframe title="Email preview" srcDoc={preview} className="h-[420px] w-full bg-white" />
        </div>
      </div>
    </div>
  );
}
