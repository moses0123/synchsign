import nodemailer, { type Transporter } from "nodemailer";
import { getDb } from "./db";
import { getSettings, smtpConfig, type NotificationSettings } from "./settings";

export const APP_URL = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

type Smtp = NonNullable<Awaited<ReturnType<typeof smtpConfig>>>;

export async function mailEnabled() {
  return Boolean(await smtpConfig());
}

export function createTransport(c: Pick<Smtp, "host" | "port" | "security" | "user" | "pass">): Transporter {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.security === "ssl",
    requireTLS: c.security === "starttls",
    ignoreTLS: c.security === "none",
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

let cached: { key: string; tx: Transporter } | null = null;
function transporterFor(c: Smtp) {
  const key = JSON.stringify([c.host, c.port, c.security, c.user, c.pass]);
  if (!cached || cached.key !== key) { cached?.tx.close(); cached = { key, tx: createTransport(c) }; }
  return cached.tx;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function renderEmail(title: string, body: string, cta?: { href: string; label: string }) {
  const { branding } = await getSettings();
  const accent = /^#[0-9a-f]{6}$/i.test(branding.emailAccent) ? branding.emailAccent : "#0284c7";
  const org = esc(branding.orgName || "SyncSign");
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <tr><td style="padding:20px 28px;border-bottom:3px solid ${accent};font-size:18px;font-weight:700;color:#0f172a">${org}</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:19px;color:#0f172a">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#334155">${body}</div>
      ${cta ? `<p style="margin:26px 0 8px"><a href="${cta.href}" style="background:${accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${cta.label}</a></p>
      <p style="font-size:12px;color:#64748b;word-break:break-all">Or paste this link into your browser: ${cta.href}</p>` : ""}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8fafc;font-size:12px;line-height:1.5;color:#64748b">${esc(branding.emailFooter)}${branding.supportEmail ? `<br>Questions? Contact <a href="mailto:${esc(branding.supportEmail)}" style="color:${accent}">${esc(branding.supportEmail)}</a>` : ""}</td></tr>
  </table></td></tr></table></body></html>`;
}

async function log(entry: { to: string; subject: string; kind: string; status: "sent" | "failed" | "skipped"; error?: string; messageId?: string }) {
  try { (await getDb()).collection("mail_log").insertOne({ ...entry, at: new Date() }); } catch { /* best effort */ }
}

export type MailKind = keyof NotificationSettings | "test";

export async function sendMail(kind: MailKind, to: string, subject: string, title: string, bodyHtml: string, cta?: { href: string; label: string }) {
  const settings = await getSettings();
  if (kind !== "test" && settings.notifications[kind] === false) {
    await log({ to, subject, kind, status: "skipped", error: "Turned off in admin settings" });
    return false;
  }
  const cfg = await smtpConfig();
  if (!cfg) {
    console.log(`[mail not configured] → ${to}: ${subject}${cta ? ` — ${cta.href}` : ""}`);
    await log({ to, subject, kind, status: "skipped", error: "Email is not configured" });
    return false;
  }
  try {
    const info = await transporterFor(cfg).sendMail({
      from: cfg.from || `"${settings.branding.orgName || "SyncSign"}" <${cfg.user || "no-reply@localhost"}>`,
      replyTo: cfg.replyTo, to, subject, html: await renderEmail(title, bodyHtml, cta),
    });
    await log({ to, subject, kind, status: "sent", messageId: info.messageId });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Mail send failed", msg);
    await log({ to, subject, kind, status: "failed", error: msg });
    if (kind === "test") throw e;
    return false;
  }
}

export const mails = {
  invite: (to: string, name: string, from: string, title: string, message: string, link: string, role: string) =>
    sendMail("invite", to, `${from} sent you "${title}" to ${role === "approver" ? "approve" : "sign"}`,
      `${esc(from)} needs your ${role === "approver" ? "approval" : "signature"}`,
      `<p>Hi ${esc(name)},</p><p><strong>${esc(from)}</strong> has sent you <strong>${esc(title)}</strong>.</p>${message ? `<blockquote style="border-left:3px solid #cbd5e1;margin:16px 0;padding:8px 14px;color:#475569">${esc(message)}</blockquote>` : ""}`,
      { href: link, label: role === "approver" ? "Review & approve" : "Review & sign" }),
  reminder: (to: string, name: string, from: string, title: string, link: string) =>
    sendMail("reminder", to, `Reminder: "${title}" is waiting for you`, "Friendly reminder",
      `<p>Hi ${esc(name)},</p><p><strong>${esc(from)}</strong> is still waiting on you for <strong>${esc(title)}</strong>.</p>`,
      { href: link, label: "Open document" }),
  completed: (to: string, name: string, title: string, link: string) =>
    sendMail("completed", to, `Completed: "${title}"`, "All parties have signed",
      `<p>Hi ${esc(name)},</p><p><strong>${esc(title)}</strong> is complete. Open the link below to download the signed document and, separately, its Certificate of Completion.</p>`,
      { href: link, label: "Get your documents" }),
  declined: (to: string, title: string, who: string, reason: string, link: string) =>
    sendMail("declined", to, `Declined: "${title}"`, `${esc(who)} declined to sign`,
      `<p><strong>${esc(who)}</strong> declined <strong>${esc(title)}</strong>.</p>${reason ? `<p>Reason: <em>${esc(reason)}</em></p>` : ""}`,
      { href: link, label: "View envelope" }),
  voided: (to: string, name: string, title: string, reason: string) =>
    sendMail("voided", to, `Voided: "${title}"`, "This envelope was voided",
      `<p>Hi ${esc(name)},</p><p>The sender voided <strong>${esc(title)}</strong>. No further action is needed.</p>${reason ? `<p>Reason: <em>${esc(reason)}</em></p>` : ""}`),
  signerDone: (to: string, title: string, who: string, link: string) =>
    sendMail("signerDone", to, `${who} signed "${title}"`, `${esc(who)} just signed`,
      `<p><strong>${esc(who)}</strong> completed their part of <strong>${esc(title)}</strong>.</p>`,
      { href: link, label: "Track progress" }),
  test: (to: string, by: string) =>
    sendMail("test", to, "SyncSign test email", "Your email settings work",
      `<p>This test was sent by <strong>${esc(by)}</strong> from the SyncSign admin portal at ${new Date().toUTCString()}.</p><p>Signing invitations, reminders and completion notices will now be delivered from this address.</p>`,
      { href: `${APP_URL()}/admin/email`, label: "Back to email settings" }),
};
