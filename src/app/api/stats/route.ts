import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/auth";
import { envelopes } from "@/lib/envelope";

/** Dashboard analytics: completion rate, turnaround time and weekly volume (last 8 weeks). */
export const GET = route(async () => {
  const me = await requireUser();
  const col = await envelopes();
  const list = await col.find({ ownerId: me.oid, status: { $ne: "draft" } }, { projection: { status: 1, sentAt: 1, completedAt: 1, createdAt: 1 } }).toArray();
  const completed = list.filter((e) => e.status === "completed" && e.sentAt && e.completedAt);
  const closed = list.filter((e) => ["completed", "declined", "voided", "expired"].includes(e.status));
  const hours = completed.map((e) => (new Date(e.completedAt!).getTime() - new Date(e.sentAt!).getTime()) / 3_600_000);
  const median = hours.length ? hours.sort((a, b) => a - b)[Math.floor(hours.length / 2)]! : null;

  const weekStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const start = weekStart(new Date()); start.setDate(start.getDate() - 7 * 7);
  const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * 7); return { week: d.toISOString().slice(0, 10), sent: 0, completed: 0 }; });
  const idx = (d?: Date | null) => { if (!d) return -1; const i = Math.floor((weekStart(new Date(d)).getTime() - start.getTime()) / (7 * 86400_000)); return i >= 0 && i < 8 ? i : -1; };
  for (const e of list) {
    const i = idx(e.sentAt); if (i >= 0) weeks[i]!.sent++;
    const j = idx(e.completedAt); if (j >= 0) weeks[j]!.completed++;
  }
  return NextResponse.json({
    sent: list.length,
    completionRate: closed.length ? completed.length / closed.length : null,
    medianHours: median,
    weeks,
  });
});
