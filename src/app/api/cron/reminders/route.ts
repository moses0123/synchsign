import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/auth";
import { runReminders } from "@/lib/jobs";

/** Daily job: send automatic reminders and expire overdue envelopes. */
export const GET = route(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized");
  return NextResponse.json({ ok: true, ...(await runReminders("cron")) });
});
