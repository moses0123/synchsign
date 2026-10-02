import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/auth";
import { loadOwned, type Ctx } from "@/lib/owned";
import { getDb } from "@/lib/db";
import type { Template } from "@/lib/types";

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { env, me } = await loadOwned((await params).id);
  const { name, description = "" } = (await req.json()) as { name?: string; description?: string };
  if (!name?.trim()) throw new HttpError(400, "Give your template a name");
  if (!env.recipients.length) throw new HttpError(400, "Add at least one recipient role first");
  const now = new Date();
  const t: Omit<Template, "_id"> = {
    ownerId: me.oid, name: name.trim().slice(0, 100), description: description.slice(0, 300),
    fileId: env.fileId, fileName: env.fileName, pages: env.pages,
    roles: env.recipients.map((r, i) => ({ id: r.id, name: r.name || `Signer ${i + 1}`, role: r.role, order: r.order, color: r.color })),
    fields: env.fields.map((f) => ({ ...f, value: null })),
    signingOrder: env.signingOrder, message: env.message, uses: 0, createdAt: now, updatedAt: now,
  };
  const db = await getDb();
  const { insertedId } = await db.collection("templates").insertOne(t);
  return NextResponse.json({ id: insertedId.toString() });
});
