import { NextResponse } from "next/server";
import { HttpError, requireUser, route } from "@/lib/auth";
import { docs, serializeDoc, type DocRecord } from "@/lib/documents";
import { starterByKey } from "@/lib/doc-library";
import { getDb, oid } from "@/lib/db";
import type { User } from "@/lib/types";

export const GET = route(async () => {
  const me = await requireUser();
  const list = await (await docs()).find({ ownerId: me.oid }, { projection: { "content.branding.logo": 0 } }).sort({ updatedAt: -1 }).limit(200).toArray();
  return NextResponse.json({
    documents: list.map((d) => ({ _id: d._id.toString(), title: d.title, starter: d.starter, updatedAt: d.updatedAt, uses: d.uses ?? 0, blocks: d.content.blocks.length, roles: d.content.roles })),
  });
});

export const POST = route(async (req: Request) => {
  const me = await requireUser();
  const { starter = "blank", from } = (await req.json().catch(() => ({}))) as { starter?: string; from?: string };
  const col = await docs();
  let title: string, content;
  if (from) {
    const fromId = oid(from);
    const src = fromId ? await col.findOne({ _id: fromId, ownerId: me.oid }) : null;
    if (!src) throw new HttpError(404, "Document not found");
    title = `${src.title} (copy)`; content = src.content;
  } else {
    const s = starterByKey(starter);
    if (!s) throw new HttpError(400, "Unknown template");
    content = s.build();
    title = s.key === "blank" ? "Untitled document" : s.name;
    // Pre-fill branding from the user's profile
    const u = await (await getDb()).collection<User>("users").findOne({ _id: me.oid }, { projection: { company: 1 } });
    if (u?.company) content.branding.companyName = u.company;
    const last = await col.find({ ownerId: me.oid }).sort({ updatedAt: -1 }).limit(1).next();
    if (last) content.branding = { ...last.content.branding };
  }
  const now = new Date();
  const doc: Omit<DocRecord, "_id"> = { ownerId: me.oid, title, starter, content, createdAt: now, updatedAt: now, uses: 0 };
  const { insertedId } = await col.insertOne(doc as DocRecord);
  return NextResponse.json({ id: insertedId.toString(), document: serializeDoc({ ...doc, _id: insertedId } as DocRecord) });
});
