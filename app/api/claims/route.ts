import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * POST /api/claims
 * Creates a new claim for an item.
 * Requires a valid Supabase session (via cookies).
 */
export async function POST(req: Request) {
  try {
    // 🔐 Create Supabase client that reads session cookies
    const supabase = createRouteHandlerClient({ cookies });

    // 🧠 Optional: Log incoming cookies for debugging
    const cookieHeader = req.headers.get("cookie");
    console.log("🍪 Incoming cookies:", cookieHeader);

    // ✅ Get the logged-in user from Supabase
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("❌ Auth error:", userError);
      return NextResponse.json(
        { success: false, error: "Unauthorized – no valid session" },
        { status: 401 }
      );
    }

    // 📨 Parse request body
    const { item_id, message } = await req.json();

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );
    }

    // 🧾 Insert new claim
    const { error: insertError } = await supabase.from("claims").insert([
      {
        item_id,
        claimed_by: user.id, // store who claimed it
        message: message || "",
        status: "Pending",
      },
    ]);

    if (insertError) {
      console.error("❌ Claim insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 400 }
      );
    }

    // ✅ Success
    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully.",
    });
  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
