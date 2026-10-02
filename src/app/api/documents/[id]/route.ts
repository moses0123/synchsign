import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, route } from "@/lib/auth";
import { contentSchema, loadDoc, serializeDoc } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { d } = await loadDoc((await params).id);
  return NextResponse.json({ document: serializeDoc(d) });
});

const schema = z.object({ title: z.string().trim().min(1).max(140).optional(), content: contentSchema.optional() });

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { d, col } = await loadDoc((await params).id);
  const p = schema.safeParse(await req.json());
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Invalid document");
  await col.updateOne({ _id: d._id }, { $set: { ...p.data, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { d, col } = await loadDoc((await params).id);
  await col.deleteOne({ _id: d._id });
  return NextResponse.json({ ok: true });
});
