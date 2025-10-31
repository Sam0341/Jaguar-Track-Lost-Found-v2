import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // 👇 Refresh and attach the Supabase session to every request
  await supabase.auth.getSession();

  return res;
}

// ✅ Apply this middleware to all routes (including /api)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
