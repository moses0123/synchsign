import { NextResponse } from "next/server";
import { HttpError, clientIp, route } from "@/lib/auth";
import { envelopes } from "@/lib/envelope";
import { logAudit } from "@/lib/audit";
import { mails, APP_URL } from "@/lib/mail";
import { notifyOwner } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { loadSigner, type TokenCtx } from "@/lib/signer";

export const POST = route(async (req: Request, { params }: TokenCtx) => {
  const { token } = await params;
  const { env, r } = await loadSigner(req, token);
  if (env.status !== "sent" || (r.status !== "sent" && r.status !== "viewed")) throw new HttpError(409, "This document can no longer be declined");
  if (!(await getSettings()).signing.allowDecline) throw new HttpError(403, "Declining is turned off for this organisation. Contact the sender.");
  const { reason = "" } = (await req.json().catch(() => ({}))) as { reason?: string };
  const now = new Date();
  const col = await envelopes();
  await col.updateOne({ _id: env._id }, {
    $set: { status: "declined", updatedAt: now, "recipients.$[me].status": "declined", "recipients.$[me].declineReason": reason.slice(0, 500), "recipients.$[me].completedAt": now },
  }, { arrayFilters: [{ "me.token": token }] });
  await logAudit(env._id, "declined", { actor: r.name, email: r.email, ip: clientIp(req), details: reason });
  await notifyOwner(env, "declined", r.name);
  await mails.declined(env.ownerEmail, env.title, r.name, reason, `${APP_URL()}/app/envelopes/${env._id}`);
  return NextResponse.json({ ok: true });
});
