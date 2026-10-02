import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/session";

function clear(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST() {
  return clear(NextResponse.json({ ok: true }));
}

/** Used for redirects when an admin session is no longer valid. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  return clear(NextResponse.redirect(new URL(next && next.startsWith("/admin") ? next : "/admin/login", url.origin)));
}
