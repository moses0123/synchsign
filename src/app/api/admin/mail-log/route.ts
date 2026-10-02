import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = route(async (req: Request) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status");
  const filter = status && status !== "all" ? { status } : {};
  const items = await (await getDb()).collection("mail_log").find(filter).sort({ at: -1 }).limit(200).toArray();
  return NextResponse.json({ items: items.map((m) => ({ ...m, _id: m._id.toString() })) });
});
