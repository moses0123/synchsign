import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, clientIp, route } from "@/lib/auth";
import { loadOwned, type Ctx } from "@/lib/owned";
import { logAudit } from "@/lib/audit";
import { dispatch, isDone } from "@/lib/envelope";
import { token } from "@/lib/utils";

/** Correct a sent envelope: fix a recipient's name/email (re-issues their link) or extend expiry. */
const schema = z.object({
  recipientId: z.string().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { env, col, me } = await loadOwned((await params).id);
  if (env.status !== "sent" && env.status !== "expired") throw new HttpError(409, "Only in-progress envelopes can be corrected");
  const p = schema.safeParse(await req.json());
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Invalid input");
  const d = p.data;
  const changes: string[] = [];
  if (d.recipientId) {
    const r = env.recipients.find((x) => x.id === d.recipientId);
    if (!r) throw new HttpError(404, "Recipient not found");
    if (isDone(r)) throw new HttpError(409, `${r.name} has already completed`);
    if (d.name && d.name !== r.name) { changes.push(`name ${r.name} → ${d.name}`); r.name = d.name; }
    if (d.email && d.email !== r.email) {
      changes.push(`email ${r.email} → ${d.email}`);
      r.email = d.email; r.token = token(); r.emailVerifiedAt = null;
      if (r.status !== "pending") { r.status = "pending"; r.viewedAt = null; }
    }
  }
  if (d.expiresAt !== undefined) {
    env.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
    if (env.status === "expired") env.status = "sent";
    changes.push(`expiry → ${d.expiresAt ?? "none"}`);
  }
  await col.updateOne({ _id: env._id }, { $set: { recipients: env.recipients, expiresAt: env.expiresAt, status: env.status, updatedAt: new Date() } });
  await logAudit(env._id, "corrected", { actor: me.name, email: me.email, ip: clientIp(req), details: changes.join("; ") });
  await dispatch(env);
  return NextResponse.json({ ok: true });
});
