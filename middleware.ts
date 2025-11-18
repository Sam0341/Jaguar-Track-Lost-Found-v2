import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res });

  // Always refresh session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // Not logged in → protect routes
  if (!session) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  const user = session.user;

  // Safe profile fetch
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle(); // <-- prevents 500 errors

  // Default role if profile missing
  const role = profile?.role ?? "user";

  // ADMIN protection
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // STAFF protection
  if (pathname.startsWith("/staff") && !["staff", "admin"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
