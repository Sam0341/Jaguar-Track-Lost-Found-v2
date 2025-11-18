import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  // If no user, block protected routes
  if (!user) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  // Fetch profile to check the role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "user";

  // ADMIN ROUTES
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // STAFF ROUTES (admin also allowed)
  if (pathname.startsWith("/staff") && !["staff", "admin"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
