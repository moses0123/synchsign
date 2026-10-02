import { NextResponse } from "next/server";
import { HttpError, clientIp, route } from "@/lib/auth";
import { actionable, dispatch, envelopes, finalize, isDone } from "@/lib/envelope";
import { logAudit } from "@/lib/audit";
import { mails, APP_URL } from "@/lib/mail";
import { loadSigner, type TokenCtx } from "@/lib/signer";
import { getDb } from "@/lib/db";
import { notifyOwner } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route(async (req: Request, { params }: TokenCtx) => {
  const { token } = await params;
  const { env, r } = await loadSigner(req, token);
  if (env.status !== "sent") throw new HttpError(409, `This envelope is ${env.status}`);
  if (r.status !== "sent" && r.status !== "viewed") throw new HttpError(409, r.status === "pending" ? "It isn't your turn to sign yet" : "You've already completed this document");

  const { values = {}, adopt } = (await req.json()) as { values: Record<string, string>; adopt?: { signature?: string; initials?: string } };
  const mine = env.fields.filter((f) => f.recipientId === r.id);
  const set: Record<string, unknown> = {};
  const arrayFilters: Record<string, unknown>[] = [{ "me.token": token }];
  mine.forEach((f, i) => {
    let v = (values[f.id] ?? "").toString();
    if ((f.type === "signature" || f.type === "initials") && v && !/^data:image\/(png|jpeg);base64,/.test(v)) throw new HttpError(400, "Invalid signature image");
    if (v.length > 600_000) throw new HttpError(413, "Signature image is too large");
    if (f.type === "checkbox") v = v === "true" ? "true" : "";
    if (f.required && !v) throw new HttpError(400, `Please complete all required fields (${f.label || f.type})`);
    set[`fields.$[f${i}].value`] = v || null;
    arrayFilters.push({ [`f${i}.id`]: f.id });
  });

  const now = new Date();
  const newStatus = r.role === "approver" ? "approved" : "signed";
  const ip = clientIp(req);
  set["recipients.$[me].status"] = newStatus;
  set["recipients.$[me].completedAt"] = now;
  set["recipients.$[me].ip"] = ip;
  set.updatedAt = now;

  const col = await envelopes();
  const res = await col.updateOne(
    { _id: env._id, status: "sent", recipients: { $elemMatch: { token, status: { $in: ["sent", "viewed"] } } } },
    { $set: set }, { arrayFilters },
  );
  if (!res.modifiedCount) throw new HttpError(409, "This document was already completed or changed. Refresh and try again.");

  await logAudit(env._id, newStatus, { actor: r.name, email: r.email, ip, ua: req.headers.get("user-agent") ?? undefined, details: `${mine.length} field(s) completed` });

  if (r.email !== env.ownerEmail) await notifyOwner(env, newStatus, r.name);

  // Let signed-in users keep the signature they just adopted
  if (adopt && (adopt.signature || adopt.initials)) {
    const db = await getDb();
    const $s: Record<string, string> = {};
    if (adopt.signature?.startsWith("data:image/")) $s.signature = adopt.signature;
    if (adopt.initials?.startsWith("data:image/")) $s.initials = adopt.initials;
    if (Object.keys($s).length) await db.collection("users").updateOne({ email: r.email, signature: { $in: [null, undefined] } }, { $set: $s });
  }

  const fresh = (await col.findOne({ _id: env._id }))!;
  const allDone = fresh.recipients.filter(actionable).every(isDone);
  if (allDone) {
    const lock = await col.updateOne({ _id: env._id, status: "sent", finalizing: { $ne: true } } as never, { $set: { finalizing: true } } as never);
    if (lock.modifiedCount) await finalize(fresh);
  } else {
    if (r.email !== env.ownerEmail) await mails.signerDone(env.ownerEmail, env.title, r.name, `${APP_URL()}/app/envelopes/${env._id}`);
    await dispatch(fresh);
  }
  return NextResponse.json({ ok: true, completed: allDone });
});
