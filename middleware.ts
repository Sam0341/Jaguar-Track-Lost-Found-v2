// middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createMiddlewareClient({ req, res });

  // Refresh session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Public pages → allowed
  const publicRoutes = [
    "/login",
    "/auth/callback",
  ];
  if (publicRoutes.includes(pathname)) return res;

  // If no session → redirect to login
  if (!session) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, superadmin")
    .eq("id", session.user.id)
    .maybeSingle();

  // If profile is missing (should never happen)
  if (!profile) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const role = profile.role;
  const isSuperAdmin = profile.superadmin === true;

  // SUPERADMIN-ONLY ROUTES
  const superAdminRoutes = ["/admin/create-user"];
  if (superAdminRoutes.some((route) => pathname.startsWith(route))) {
    if (!isSuperAdmin) {
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  // ADMIN/STAFF ROUTES
  const adminRoutes = ["/admin", "/admin/claims", "/admin/storage", "/admin/logs"];
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!(role === "admin" || role === "staff" || isSuperAdmin)) {
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  // Students get access to everything else normally
  return res;
}

// Don’t filter out static files
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)",
  ],
};
