import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { createTransport, renderEmail } from "@/lib/mail";
import { decryptSecret, getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Test SMTP settings — either the saved ones, or the unsaved values currently in the form.
 * Step 1 verifies the connection & login, step 2 sends a real message.
 */
export const POST = route(async (req: Request) => {
  const me = await requireAdmin();
  const body = (await req.json()) as {
    to?: string;
    draft?: { host: string; port: number; security: "ssl" | "starttls" | "none"; user: string; password?: string; fromName: string; fromEmail: string; replyTo: string };
  };
  const to = (body.to || me.email).trim();
  if (!/\S+@\S+\.\S+/.test(to)) throw new HttpError(400, "Enter a valid recipient address");
  const s = await getSettings(true);
  const d = body.draft ?? { ...s.email, password: undefined };
  if (!d.host) throw new HttpError(400, "Enter the SMTP server host");
  const pass = d.password || decryptSecret(s.email.passEnc);
  const tx = createTransport({ host: d.host, port: Number(d.port), security: d.security, user: d.user, pass });
  const started = Date.now();
  const steps: { step: string; ok: boolean; detail?: string }[] = [];
  try {
    await tx.verify();
    steps.push({ step: "Connected and signed in", ok: true, detail: `${d.host}:${d.port} (${d.security.toUpperCase()})` });
  } catch (e) {
    const err = e as { message?: string; code?: string; responseCode?: number };
    steps.push({ step: "Connect and sign in", ok: false, detail: friendly(err) });
    tx.close();
    return NextResponse.json({ ok: false, steps, ms: Date.now() - started });
  }
  try {
    const from = d.fromEmail ? `"${(d.fromName || s.branding.orgName).replace(/"/g, "")}" <${d.fromEmail}>` : d.user;
    const info = await tx.sendMail({
      from, to, replyTo: d.replyTo || undefined, subject: `${s.branding.orgName || "SyncSign"} test email`,
      html: await renderEmail("Your email settings work", `<p>This test was sent by <strong>${me.name}</strong> from the admin portal.</p><p>Signing invitations, reminders and completion notices will be delivered from this address.</p>`),
    });
    steps.push({ step: `Test email accepted for ${to}`, ok: true, detail: info.response });
    await (await getDb()).collection("mail_log").insertOne({ to, subject: "Test email", kind: "test", status: "sent", messageId: info.messageId, at: new Date() });
    return NextResponse.json({ ok: true, steps, ms: Date.now() - started });
  } catch (e) {
    steps.push({ step: "Send test email", ok: false, detail: friendly(e as { message?: string; code?: string; responseCode?: number }) });
    await (await getDb()).collection("mail_log").insertOne({ to, subject: "Test email", kind: "test", status: "failed", error: (e as Error).message, at: new Date() });
    return NextResponse.json({ ok: false, steps, ms: Date.now() - started });
  } finally {
    tx.close();
  }
});

function friendly(e: { message?: string; code?: string; responseCode?: number }) {
  const m = e.message ?? "Unknown error";
  if (e.code === "EAUTH" || e.responseCode === 535) return `Login rejected — check the username and password. Gmail and Microsoft 365 need an app password. (${m})`;
  if (e.code === "ETLS") return `The server doesn't support STARTTLS on this port — try “SSL/TLS” (usually port 465). (${m})`;
  if (e.code === "ESOCKET" && /wrong version number|ssl3_get_record/i.test(m)) return `TLS mismatch — try “STARTTLS” for port 587 or “SSL/TLS” for port 465. (${m})`;
  if (e.code === "ETIMEDOUT" || e.code === "ECONNECTION" || /timeout/i.test(m)) return `Could not reach the server — check the host and port, and that your network or host allows outbound SMTP. (${m})`;
  if (e.code === "EDNS" || /ENOTFOUND/.test(m)) return `Host not found — check the SMTP server name. (${m})`;
  if (e.responseCode === 550 || e.responseCode === 553) return `The server refused the From address — use an address or domain your provider has verified. (${m})`;
  return m;
}
