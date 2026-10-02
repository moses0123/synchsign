import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { getAudit } from "@/lib/audit";
import { loadOwned, type Ctx } from "@/lib/owned";

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { env } = await loadOwned((await params).id);
  const events = await getAudit(env._id);
  return NextResponse.json({ events: events.map((e) => ({ ...e, _id: e._id.toString(), envelopeId: undefined })) });
});
