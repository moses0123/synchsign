import { NextResponse } from "next/server";
import { HttpError, clientIp, route } from "@/lib/auth";
import { envelopes } from "@/lib/envelope";
import { logAudit } from "@/lib/audit";
import { mails } from "@/lib/mail";
import { loadSigner, type TokenCtx } from "@/lib/signer";
import { checkCode, issueCode, maskEmail, verifiedCookie } from "@/lib/verification";

export const runtime = "nodejs";

/** POST { action: "send" } emails a one-time code · POST { action: "verify", code } checks it. */
export const POST = route(async (req: Request, { params }: TokenCtx) => {
  const { token } = await params;
  const { env, r, unlocked, needsEmail, emailVerified } = await loadSigner(req, token, { requireAccess: false });
  if (!unlocked) throw new HttpError(403, "Enter your access code first");
  if (!needsEmail || emailVerified) return NextResponse.json({ ok: true, verified: true });
  if (env.status === "voided") throw new HttpError(410, "This envelope was voided by the sender");
  const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string };
  const ip = clientIp(req);

  if (body.action === "send") {
    const issued = await issueCode(token);
    if (!issued.ok) {
      throw new HttpError(429, issued.limited ? "Too many codes requested. Try again in an hour or ask the sender for help." : `Please wait ${issued.wait} seconds before requesting another code.`);
    }
    const sent = await mails.verificationCode(r.email, r.name, issued.code, env.title, env.ownerName, issued.minutes);
    if (!sent) throw new HttpError(503, "We couldn't send the code because email isn't working right now. Please contact the sender.");
    await logAudit(env._id, "otp_sent", { actor: r.name, email: r.email, ip, details: `Verification code sent to ${maskEmail(r.email)}` });
    return NextResponse.json({ ok: true, sentTo: maskEmail(r.email), minutes: issued.minutes });
  }

  if (body.action === "verify") {
    const result = await checkCode(token, String(body.code ?? ""));
    if (!result.ok) {
      await logAudit(env._id, "otp_failed", { actor: r.name, email: r.email, ip, details: "Wrong or expired verification code" });
      throw new HttpError(400, result.reason);
    }
    const now = new Date();
    await (await envelopes()).updateOne({ _id: env._id }, { $set: { "recipients.$[me].emailVerifiedAt": now } }, { arrayFilters: [{ "me.token": token }] });
    await logAudit(env._id, "email_verified", { actor: r.name, email: r.email, ip, ua: req.headers.get("user-agent") ?? undefined, details: `Confirmed access to ${r.email}` });
    const c = await verifiedCookie(token);
    const res = NextResponse.json({ ok: true, verified: true });
    res.cookies.set(c.name, c.value, c.options);
    return res;
  }
  throw new HttpError(400, "Unknown action");
});
