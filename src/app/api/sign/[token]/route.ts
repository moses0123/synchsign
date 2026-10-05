import { NextResponse } from "next/server";
import { clientIp, route, getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { envelopes, isDone } from "@/lib/envelope";
import { logAudit } from "@/lib/audit";
import { notifyOwner } from "@/lib/notify";
import { loadSigner, type TokenCtx } from "@/lib/signer";
import type { User } from "@/lib/types";
import { getSettings } from "@/lib/settings";
import { maskEmail } from "@/lib/verification";

export const GET = route(async (req: Request, { params }: TokenCtx) => {
  const { token } = await params;
  const { env, r, unlocked, code, needsEmail, emailVerified } = await loadSigner(req, token, { requireAccess: false });
  const base = {
    title: env.title, ownerName: env.ownerName, ownerEmail: env.ownerEmail, status: env.status,
    recipient: { id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, color: r.color },
  };
  if (!unlocked) {
    if (code) await logAudit(env._id, "code_failed", { actor: r.name, email: r.email, ip: clientIp(req) });
    return NextResponse.json({ ...base, locked: true, lockReason: "code", wrongCode: Boolean(code) });
  }
  if (!emailVerified) {
    return NextResponse.json({ ...base, recipient: { ...base.recipient, email: maskEmail(r.email) }, locked: true, lockReason: "email", maskedEmail: maskEmail(r.email) });
  }
  const canAct = env.status === "sent" && (r.status === "sent" || r.status === "viewed");
  if (canAct && r.status === "sent") {
    const now = new Date();
    const col = await envelopes();
    await col.updateOne({ _id: env._id }, { $set: { "recipients.$[me].status": "viewed", "recipients.$[me].viewedAt": now } }, { arrayFilters: [{ "me.token": token }] });
    await logAudit(env._id, "viewed", { actor: r.name, email: r.email, ip: clientIp(req), ua: req.headers.get("user-agent") ?? undefined });
    if (r.email !== env.ownerEmail) await notifyOwner(env, "viewed", r.name);
    if (r.accessCode) await logAudit(env._id, "code_verified", { actor: r.name, email: r.email, ip: clientIp(req) });
    r.status = "viewed";
  }
  let saved: { signature?: string | null; initials?: string | null; company?: string; title?: string } | null = null;
  const session = await getSession();
  if (session && session.email === r.email) {
    const db = await getDb();
    const u = await db.collection<User>("users").findOne({ email: r.email }, { projection: { signature: 1, initials: 1, company: 1, title: 1 } });
    if (u) saved = { signature: u.signature, initials: u.initials, company: u.company, title: u.title };
  }
  const doneIds = new Set(env.recipients.filter(isDone).map((x) => x.id));
  return NextResponse.json({
    ...base,
    locked: false,
    message: env.message,
    pages: env.pages,
    canAct,
    waitingOnOthers: env.status === "sent" && r.status === "pending",
    completedAvailable: env.status === "completed" && Boolean(env.completedFileId),
    certificateAvailable: env.status === "completed" && Boolean(env.certificateFileId),
    expiresAt: env.expiresAt ?? null,
    recipients: env.recipients.map((x) => ({ id: x.id, name: x.name, role: x.role, status: x.status, color: x.color, order: x.order })),
    myFields: env.fields.filter((f) => f.recipientId === r.id),
    otherFields: env.fields.filter((f) => f.recipientId !== r.id && doneIds.has(f.recipientId) && f.value),
    saved,
    identity: { accessCode: Boolean(r.accessCode), emailVerified: needsEmail },
    allowDecline: (await getSettings()).signing.allowDecline,
    consentText: (await getSettings()).signing.consentText,
  });
});
