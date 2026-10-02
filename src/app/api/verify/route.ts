import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/auth";
import { envelopes } from "@/lib/envelope";
import { sha256 } from "@/lib/pdf";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a PDF to verify");
  if (file.size > 30 * 1024 * 1024) throw new HttpError(413, "File too large");
  const hash = sha256(Buffer.from(await file.arrayBuffer()));
  const col = await envelopes();
  const env = await col.findOne({ $or: [{ completedHash: hash }, { certificateHash: hash }, { originalHash: hash }, { legacyCompletedHash: hash }] }, { projection: { _id: 1, completedHash: 1, certificateHash: 1, legacyCompletedHash: 1 } });
  if (!env) return NextResponse.json({ match: false, hash });
  return NextResponse.json({ match: true, hash, id: env._id.toString(), kind: env.completedHash === hash || (env as { legacyCompletedHash?: string }).legacyCompletedHash === hash ? "signed" : env.certificateHash === hash ? "certificate" : "original" });
});
