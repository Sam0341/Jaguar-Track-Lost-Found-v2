// middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // 🔐 Create Supabase client tied to the request
  const supabase = createMiddlewareClient({ req, res });

  // 🧠 Refresh or validate the user's session
  await supabase.auth.getSession();

  return res;
}

// ✅ Runs on everything except static assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
