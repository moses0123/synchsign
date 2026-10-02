import { NextResponse } from "next/server";
import { HttpError, clientIp, route } from "@/lib/auth";
import { loadOwned, type Ctx } from "@/lib/owned";
import { logAudit } from "@/lib/audit";
import { mails } from "@/lib/mail";

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { env, col, me } = await loadOwned((await params).id);
  if (env.status !== "sent") throw new HttpError(409, "Only in-progress envelopes can be voided");
  const { reason = "" } = (await req.json().catch(() => ({}))) as { reason?: string };
  await col.updateOne({ _id: env._id }, { $set: { status: "voided", voidReason: reason.slice(0, 500), updatedAt: new Date() } });
  await logAudit(env._id, "voided", { actor: me.name, email: me.email, ip: clientIp(req), details: reason });
  for (const r of env.recipients) if (r.status !== "pending") await mails.voided(r.email, r.name, env.title, reason);
  return NextResponse.json({ ok: true });
});
