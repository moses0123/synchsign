import { NextResponse } from "next/server";
import { HttpError, clientIp, route } from "@/lib/auth";
import { readFile } from "@/lib/db";
import { envelopeFromTemplate, loadTemplate } from "@/lib/templates";
import { envelopes, dispatch } from "@/lib/envelope";
import { sha256 } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";
import { saveContacts } from "@/lib/contacts";
import { envelopeDefaults } from "@/lib/settings";
import { verificationPolicyFor } from "@/lib/verification";
import type { Envelope } from "@/lib/types";

/**
 * Bulk send: one envelope per row. The row fills the template's first role;
 * any other roles are filled from `fixed` (e.g. your own countersignature).
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { t, col, me } = await loadTemplate((await params).id);
  const { rows = [], fixed = {} } = (await req.json()) as { rows: { name: string; email: string }[]; fixed?: Record<string, { name: string; email: string }> };
  if (!rows.length) throw new HttpError(400, "Add at least one recipient");
  if (rows.length > 200) throw new HttpError(400, "Bulk send is limited to 200 recipients at a time");
  const first = t.roles.slice().sort((a, b) => a.order - b.order)[0]!;
  const hash = sha256(await readFile(t.fileId));
  const envCol = await envelopes();
  const vp = await verificationPolicyFor(me.oid);
  const defaults = { ...(await envelopeDefaults()), verifyEmail: vp.mode !== "off" && vp.defaultOn };
  const ids: string[] = [];
  for (const row of rows) {
    const doc = envelopeFromTemplate(t, me, { ...fixed, [first.id]: row }, hash, `${t.name} – ${row.name}`, defaults);
    doc.status = "sent"; doc.sentAt = new Date(); doc.tags = ["bulk"];
    const { insertedId } = await envCol.insertOne(doc as Envelope);
    await logAudit(insertedId, "sent", { actor: me.name, email: me.email, ip: clientIp(req), details: `Bulk send from “${t.name}”` });
    await dispatch({ ...doc, _id: insertedId } as Envelope);
    ids.push(insertedId.toString());
  }
  await col.updateOne({ _id: t._id }, { $inc: { uses: rows.length }, $set: { updatedAt: new Date() } });
  await saveContacts(me.oid, rows);
  return NextResponse.json({ ok: true, count: ids.length });
});
