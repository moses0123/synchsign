import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const GET = route(async () => {
  const me = await requireUser();
  const db = await getDb();
  const col = db.collection("notifications");
  const [items, unread] = await Promise.all([
    col.find({ ownerId: me.oid }).sort({ at: -1 }).limit(30).toArray(),
    col.countDocuments({ ownerId: me.oid, read: false }),
  ]);
  return NextResponse.json({ unread, items: items.map((n) => ({ id: n._id.toString(), envelopeId: n.envelopeId.toString(), title: n.title, kind: n.kind, actor: n.actor, at: n.at, read: n.read })) });
});

/** Mark all as read */
export const POST = route(async () => {
  const me = await requireUser();
  const db = await getDb();
  await db.collection("notifications").updateMany({ ownerId: me.oid, read: false }, { $set: { read: true } });
  return NextResponse.json({ ok: true });
});
