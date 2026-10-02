import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { envelopes } from "@/lib/envelope";

/** Read-only list of envelopes across all users (metadata only — no document contents). */
export const GET = route(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = status;
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ title: rx }, { ownerEmail: rx }, { ownerName: rx }, { "recipients.email": rx }];
  }
  const list = await (await envelopes()).find(filter, { projection: { title: 1, ownerName: 1, ownerEmail: 1, status: 1, createdAt: 1, sentAt: 1, completedAt: 1, "recipients.name": 1, "recipients.status": 1, "recipients.role": 1, pages: 1 } })
    .sort({ updatedAt: -1 }).limit(300).toArray();
  return NextResponse.json({
    envelopes: list.map((e) => ({
      _id: e._id.toString(), title: e.title, ownerName: e.ownerName, ownerEmail: e.ownerEmail, status: e.status,
      createdAt: e.createdAt, sentAt: e.sentAt ?? null, completedAt: e.completedAt ?? null, pages: e.pages?.length ?? 0,
      recipients: e.recipients.length, done: e.recipients.filter((r) => r.status === "signed" || r.status === "approved").length,
    })),
  });
});
