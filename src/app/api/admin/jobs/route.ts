import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { runReminders } from "@/lib/jobs";

export const maxDuration = 60;

export const POST = route(async () => {
  await requireAdmin();
  return NextResponse.json({ ok: true, ...(await runReminders("admin")) });
});
