import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/auth";
import { loadOwned, type Ctx } from "@/lib/owned";
import { logAudit } from "@/lib/audit";
import { mails } from "@/lib/mail";
import { signLink } from "@/lib/envelope";

export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { env, col, me } = await loadOwned((await params).id);
  if (env.status !== "sent") throw new HttpError(409, "Only in-progress envelopes can be reminded");
  const waiting = env.recipients.filter((r) => r.status === "sent" || r.status === "viewed");
  const now = new Date();
  for (const r of waiting) {
    await mails.reminder(r.email, r.name, env.ownerName, env.title, signLink(r));
    r.lastReminderAt = now;
    await logAudit(env._id, "reminded", { actor: me.name, email: r.email, details: `Reminder sent to ${r.name}` });
  }
  await col.updateOne({ _id: env._id }, { $set: { recipients: env.recipients, updatedAt: now } });
  return NextResponse.json({ ok: true, count: waiting.length });
});
