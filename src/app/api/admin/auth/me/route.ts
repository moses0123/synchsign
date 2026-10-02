import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";

export const GET = route(async () => {
  const me = await requireAdmin();
  return NextResponse.json({ user: { _id: me.uid, name: me.name, email: me.email, expiresAt: me.exp * 1000 } });
});
