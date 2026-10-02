import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { HttpError, route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getDb, oid } from "@/lib/db";

/** Reset a user's password to a new temporary one (shown once to the admin). */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const _id = oid((await params).id); if (!_id) throw new HttpError(404, "User not found");
  const temp = randomBytes(9).toString("base64url");
  const res = await (await getDb()).collection("users").updateOne({ _id }, { $set: { passwordHash: await bcrypt.hash(temp, 11), passwordResetAt: new Date() } });
  if (!res.matchedCount) throw new HttpError(404, "User not found");
  return NextResponse.json({ ok: true, tempPassword: temp });
});
