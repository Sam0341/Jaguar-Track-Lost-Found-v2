import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized – no valid session" },
        { status: 401 }
      );
    }

    const { item_id, message } = await req.json();

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("claims").insert([
      {
        item_id,
        claimed_by: user.id,
        message: message || "",
        status: "Pending",
      },
    ]);

    if (insertError) {
      console.error("Claim insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully.",
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
