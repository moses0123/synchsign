import { NextResponse } from "next/server";
import { HttpError, clientIp, route } from "@/lib/auth";
import { actionable, dispatch, serialize } from "@/lib/envelope";
import { loadOwned, type Ctx } from "@/lib/owned";
import { logAudit } from "@/lib/audit";
import { mailEnabled } from "@/lib/mail";
import { saveContacts } from "@/lib/contacts";

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { env, col, me } = await loadOwned((await params).id);
  if (env.status !== "draft") throw new HttpError(409, "This envelope was already sent");
  const signers = env.recipients.filter(actionable);
  if (!signers.length) throw new HttpError(400, "Add at least one signer or approver");
  for (const r of env.recipients.filter((x) => x.role === "signer")) {
    if (!env.fields.some((f) => f.recipientId === r.id)) throw new HttpError(400, `Add at least one field for ${r.name}`);
  }
  const now = new Date();
  env.status = "sent";
  env.sentAt = now;
  await col.updateOne({ _id: env._id }, { $set: { status: "sent", sentAt: now, updatedAt: now } });
  await logAudit(env._id, "sent", { actor: me.name, email: me.email, ip: clientIp(req), details: `${signers.length} recipient(s), ${env.signingOrder} order` });
  await dispatch(env);
  await saveContacts(me.oid, env.recipients.filter((r) => r.email !== me.email));
  const self = env.recipients.find((r) => r.email === me.email && actionable(r) && r.status === "sent");
  return NextResponse.json({ ok: true, mail: await mailEnabled(), selfLink: self ? `/sign/${self.token}` : null, envelope: serialize(env) });
});
