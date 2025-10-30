import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Handles claim submissions for Jaguar Track Lost & Found
 * Users must be authenticated (session stored via cookies)
 */
export async function POST(req: Request) {
  try {
    // 🔐 Create Supabase client with cookie-based auth
    const supabase = createRouteHandlerClient({ cookies });

    // 🧠 Get current user from session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("❌ Auth error:", userError);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
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

    // 🧾 Insert new claim record
    const { error } = await supabase.from("claims").insert([
      {
        item_id,
        claimed_by: user.id, // ✅ use the logged-in user's ID
        message,
        status: "Pending",
      },
    ]);

    if (error) {
      console.error("❌ Claim insert error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    // ✅ Success
    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully",
    });
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
