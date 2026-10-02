import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE, verifyAdminSession, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Admin portal has its own login and session
  if (pathname.startsWith("/admin")) {
    const admin = await verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
    const headers = new Headers(req.headers);
    headers.set("x-pathname", pathname);
    if (pathname === "/admin/login") {
      if (admin) { const url = req.nextUrl.clone(); url.pathname = "/admin"; url.search = ""; return NextResponse.redirect(url); }
      return NextResponse.next({ request: { headers } });
    }
    if (!admin) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: { headers } });
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname.startsWith("/app") && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/register") && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/app"; url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin", "/admin/:path*", "/login", "/register"] };
