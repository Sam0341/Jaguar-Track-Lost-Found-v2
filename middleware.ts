import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ✅ Create a Supabase client tied to cookies
  const supabase = createMiddlewareClient({ req, res });

  // ✅ Ensure session refreshes properly in production (Vercel)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.warn("⚠️ No active Supabase session found.");
  }

  return res;
}

// ✅ Apply middleware to all app routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
