import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // 🧠 Get the current authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 📦 Parse request body
    const { item_id, message } = await req.json();

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );
    }

    // 🧾 Insert the claim
    const { error } = await supabase.from("claims").insert([
      {
        item_id,
        claimed_by: user.id, // ✅ this is the fix
        message,
        status: "Pending",
      },
    ]);

    if (error) {
      console.error("Claim insert error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
