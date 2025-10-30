// middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ✅ Initialize Supabase with cookie-aware middleware
  const supabase = createMiddlewareClient({ req, res });

  // Refresh or load existing session
  await supabase.auth.getSession();

  return res;
}

// ✅ This matcher skips Next.js static assets but includes all API and app routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
