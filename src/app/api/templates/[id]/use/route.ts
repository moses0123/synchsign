import { NextResponse } from "next/server";
import { clientIp, route } from "@/lib/auth";
import { readFile } from "@/lib/db";
import { envelopeFromTemplate, loadTemplate } from "@/lib/templates";
import { envelopes, dispatch } from "@/lib/envelope";
import { sha256 } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";
import { saveContacts } from "@/lib/contacts";
import { envelopeDefaults } from "@/lib/settings";
import { verificationPolicyFor } from "@/lib/verification";
import type { Envelope } from "@/lib/types";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { t, col, me } = await loadTemplate((await params).id);
  const body = (await req.json()) as { people: Record<string, { name: string; email: string }>; title?: string; send?: boolean };
  const hash = sha256(await readFile(t.fileId));
  const doc = envelopeFromTemplate(t, me, body.people ?? {}, hash, body.title, { ...(await envelopeDefaults()), verifyEmail: (await verificationPolicyFor(me.oid)).defaultOn && (await verificationPolicyFor(me.oid)).mode !== "off" });
  const envCol = await envelopes();
  const { insertedId } = await envCol.insertOne(doc as Envelope);
  await col.updateOne({ _id: t._id }, { $inc: { uses: 1 }, $set: { updatedAt: new Date() } });
  await logAudit(insertedId, "created", { actor: me.name, email: me.email, details: `From template “${t.name}”` });
  if (body.send) {
    const env = { ...doc, _id: insertedId, status: "sent", sentAt: new Date() } as Envelope;
    await envCol.updateOne({ _id: insertedId }, { $set: { status: "sent", sentAt: env.sentAt } });
    await logAudit(insertedId, "sent", { actor: me.name, email: me.email, ip: clientIp(req) });
    await dispatch(env);
  }
  await saveContacts(me.oid, doc.recipients);
  return NextResponse.json({ id: insertedId.toString() });
});
