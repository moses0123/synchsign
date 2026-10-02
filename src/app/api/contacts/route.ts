import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireUser, route } from "@/lib/auth";
import { contacts } from "@/lib/contacts";

export const GET = route(async (req: Request) => {
  const me = await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const filter: Record<string, unknown> = { ownerId: me.oid };
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
  }
  const list = await (await contacts()).find(filter).sort({ favorite: -1, lastUsedAt: -1 }).limit(500).toArray();
  return NextResponse.json({ contacts: list.map((c) => ({ ...c, _id: c._id.toString(), ownerId: undefined })) });
});

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
  favorite: z.boolean().optional(),
});

export const POST = route(async (req: Request) => {
  const me = await requireUser();
  const p = schema.safeParse(await req.json());
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Invalid contact");
  const now = new Date();
  const col = await contacts();
  await col.updateOne({ ownerId: me.oid, email: p.data.email }, { $set: { ...p.data }, $setOnInsert: { createdAt: now, lastUsedAt: now, uses: 0 } }, { upsert: true });
  return NextResponse.json({ ok: true });
});
