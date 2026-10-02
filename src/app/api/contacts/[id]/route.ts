import { NextResponse } from "next/server";
import { HttpError, requireUser, route } from "@/lib/auth";
import { oid } from "@/lib/db";
import { contacts } from "@/lib/contacts";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const _id = oid((await params).id); if (!_id) throw new HttpError(404, "Not found");
  const body = (await req.json()) as { name?: string; company?: string; phone?: string; notes?: string; favorite?: boolean };
  const $set: Record<string, unknown> = {};
  for (const k of ["name", "company", "phone", "notes"] as const) if (typeof body[k] === "string") $set[k] = body[k]!.slice(0, 500);
  if (typeof body.favorite === "boolean") $set.favorite = body.favorite;
  await (await contacts()).updateOne({ _id, ownerId: me.oid }, { $set });
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const _id = oid((await params).id); if (!_id) throw new HttpError(404, "Not found");
  await (await contacts()).deleteOne({ _id, ownerId: me.oid });
  return NextResponse.json({ ok: true });
});
