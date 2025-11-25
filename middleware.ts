// middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // ✔ Initialize Supabase session correctly
  const supabase = createMiddlewareClient({ req, res });

  // ✔ Ensure session cookies are refreshed
  await supabase.auth.getSession();

  return res;
}

// ✔ Correct matcher (don’t break static files or images)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)",
  ],
};
