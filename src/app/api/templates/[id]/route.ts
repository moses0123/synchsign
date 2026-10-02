import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { deleteFile } from "@/lib/db";
import { loadTemplate } from "@/lib/templates";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { t } = await loadTemplate((await params).id);
  return NextResponse.json({ template: { ...t, _id: t._id.toString(), ownerId: undefined, fileId: t.fileId.toString() } });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { t, col, db } = await loadTemplate((await params).id);
  await col.deleteOne({ _id: t._id });
  const inUse = await db.collection("envelopes").findOne({ fileId: t.fileId }) || await col.findOne({ fileId: t.fileId });
  if (!inUse) await deleteFile(t.fileId);
  return NextResponse.json({ ok: true });
});
