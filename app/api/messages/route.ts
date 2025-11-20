import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "edge"; // or node depending on your setup

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // ---------------------------
    // GET REQUEST DATA
    // ---------------------------
    const form = await req.formData();

    const claim_id = form.get("claim_id") as string | null;
    const content = form.get("content") as string | null;
    const file = form.get("image") as File | null;

    if (!claim_id) {
      return NextResponse.json(
        { error: "Missing claim_id" },
        { status: 400 }
      );
    }

    // ---------------------------
    // GET USER SESSION
    // ---------------------------
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    let imageUrl: string | null = null;

    // ---------------------------
    // HANDLE IMAGE UPLOAD
    // ---------------------------
    if (file) {
      const ext = file.name.split(".").pop();
      const fileName = `${claim_id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("chat_uploads")
        .upload(fileName, file);

      if (uploadErr) {
        console.error(uploadErr);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }

      const { data: publicUrl } = supabase.storage
        .from("chat_uploads")
        .getPublicUrl(fileName);

      imageUrl = publicUrl?.publicUrl || null;
    }

    // ---------------------------
    // INSERT MESSAGE INTO DB
    // ---------------------------
    const finalMessage = content || (imageUrl ? "[image]" : "");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        claim_id,
        sender_id: user.id,
        content: finalMessage,
        is_admin: user.user_metadata?.role === "admin",
        image_url: imageUrl, // ADD THIS TO YOUR DB IF YOU WANT IMAGE MESSAGES
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // RETURN NEW MESSAGE
    return NextResponse.json({ success: true, message: data });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
