import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { Template } from "@/lib/types";

export const GET = route(async () => {
  const me = await requireUser();
  const db = await getDb();
  const list = await db.collection<Template>("templates").find({ ownerId: me.oid }).sort({ updatedAt: -1 }).toArray();
  return NextResponse.json({
    templates: list.map((t) => ({ ...t, _id: t._id.toString(), ownerId: undefined, fileId: t.fileId.toString(), fieldCount: t.fields.length, fields: undefined })),
  });
});
