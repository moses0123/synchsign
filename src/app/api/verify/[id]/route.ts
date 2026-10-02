import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/auth";
import { oid } from "@/lib/db";
import { envelopes } from "@/lib/envelope";

const mask = (e: string) => { const [u, d] = e.split("@"); return `${u!.slice(0, 2)}${"•".repeat(Math.max(1, u!.length - 2))}@${d}`; };

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const _id = oid((await params).id);
  if (!_id) throw new HttpError(404, "Not found");
  const env = await (await envelopes()).findOne({ _id });
  if (!env) throw new HttpError(404, "No SyncSign envelope with this ID");
  return NextResponse.json({
    id: env._id.toString(), title: env.title, sender: env.ownerName, status: env.status,
    createdAt: env.createdAt, sentAt: env.sentAt ?? null, completedAt: env.completedAt ?? null, pages: env.pages.length,
    originalHash: env.originalHash, completedHash: env.completedHash ?? null, certificateHash: env.certificateHash ?? null,
    recipients: env.recipients.map((r) => ({ name: r.name, email: mask(r.email), role: r.role, status: r.status, completedAt: r.completedAt ?? null })),
  });
});
