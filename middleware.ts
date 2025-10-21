// middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Get session (used internally if needed)
  await supabase.auth.getSession();

  return res;
}

// Apply to all routes (optional)
export const config = {
  matcher: ["/:path*"],
};
