import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/auth";
import { loadDoc } from "@/lib/documents";
import { renderDocument } from "@/lib/doc-render";
import { saveFile } from "@/lib/db";
import { envelopes } from "@/lib/envelope";
import { sha256 } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";
import { saveContacts } from "@/lib/contacts";
import { envelopeDefaults } from "@/lib/settings";
import type { Envelope, Field, Recipient } from "@/lib/types";
import { token, uid } from "@/lib/utils";

export const runtime = "nodejs";

/** Generate the final PDF from a built document and open it as a draft envelope with fields pre-placed. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { d, col, me } = await loadDoc((await params).id);
  const { values = {}, people = {}, title, message = "" } = (await req.json()) as {
    values?: Record<string, string>; people?: Record<string, { name: string; email: string }>; title?: string; message?: string;
  };
  const envTitle = (title || d.title).slice(0, 140);
  const { buffer, pages, fields: placed } = await renderDocument(d.content, values, { title: envTitle });

  const idMap = new Map<string, string>();
  const recipients: Recipient[] = d.content.roles.map((r) => {
    const p = people[r.id];
    if (!p?.name?.trim() || !/\S+@\S+\.\S+/.test(p.email ?? "")) throw new HttpError(400, `Add a name and email for “${r.name}”`);
    const rid = uid(); idMap.set(r.id, rid);
    return { id: rid, name: p.name.trim(), email: p.email.trim().toLowerCase(), role: r.role, order: r.order, color: r.color, status: "pending", token: token(), accessCode: null };
  });
  const fields: Field[] = placed.filter((f) => idMap.has(f.roleId) && d.content.roles.find((r) => r.id === f.roleId)?.role !== "cc")
    .map((f) => ({ id: uid(), recipientId: idMap.get(f.roleId)!, type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, required: true }));

  const fileName = `${envTitle}.pdf`;
  const fileId = await saveFile(buffer, fileName, { ownerId: me.oid, kind: "original", documentId: d._id });
  const now = new Date();
  const env: Omit<Envelope, "_id"> = {
    ownerId: me.oid, ownerName: me.name, ownerEmail: me.email, title: envTitle, message, status: "draft", signingOrder: "sequential",
    fileId, fileName, completedFileId: null, pages, recipients, fields, originalHash: sha256(buffer), completedHash: null,
    ...(await envelopeDefaults()), tags: ["built"], createdAt: now, updatedAt: now,
  };
  const ecol = await envelopes();
  const { insertedId } = await ecol.insertOne(env as Envelope);
  await col.updateOne({ _id: d._id }, { $inc: { uses: 1 }, $set: { updatedAt: now } });
  await logAudit(insertedId, "created", { actor: me.name, email: me.email, details: `Generated from document “${d.title}”` });
  await saveContacts(me.oid, recipients);
  return NextResponse.json({ id: insertedId.toString() });
});
