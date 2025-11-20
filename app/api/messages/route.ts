import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs"; // IMPORTANT: edge breaks file uploads

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: cookieStore });

    // Read form data
    const form = await req.formData();
    const claim_id = form.get("claim_id") as string | null;
    const content = form.get("content") as string | null;
    const file = form.get("image") as File | null;

    if (!claim_id) {
      return NextResponse.json({ error: "Missing claim_id" }, { status: 400 });
    }

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let imageUrl: string | null = null;

    // Handle image upload
    if (file) {
      const ext = file.name.split(".").pop();
      const fileName = `${claim_id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("chat_uploads")
        .upload(fileName, file, {
          upsert: false,
        });

      if (uploadErr) {
        console.error(uploadErr);
        return NextResponse.json(
          { error: "Image upload failed" },
          { status: 500 }
        );
      }

      const { data } = supabase.storage
        .from("chat_uploads")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    const finalMessage = content || (imageUrl ? "[image]" : "");

    // Insert message
    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        claim_id,
        sender_id: user.id,
        content: finalMessage,
        is_admin: false,
        image_url: imageUrl,
      })
      .select("*") // DO NOT join profiles, it causes your error
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: row });
  } catch (err) {
    console.error("SERVER ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
