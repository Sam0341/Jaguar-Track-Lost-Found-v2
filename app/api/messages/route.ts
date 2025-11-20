import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    // Create Supabase client (IMPORTANT: pass cookies function)
    const supabase = createRouteHandlerClient({ cookies });

    // Read form-data
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

    // Auth check
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

    /* ----------------------------------------------------
     * IMAGE UPLOAD (Supabase Storage)
     * ---------------------------------------------------- */
    if (file) {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${claim_id}/${Date.now()}.${ext}`;

      // Convert File → Uint8Array buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const { error: uploadErr } = await supabase.storage
        .from("chat_uploads")
        .upload(fileName, buffer, {
          contentType: file.type || "image/png",
          upsert: false,
        });

      if (uploadErr) {
        console.error("UPLOAD ERROR:", uploadErr);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("chat_uploads")
        .getPublicUrl(fileName);

      imageUrl = publicUrl?.publicUrl || null;
    }

    /* ----------------------------------------------------
     * STORE MESSAGE IN DATABASE
     * ---------------------------------------------------- */
    const finalMessage = content || (imageUrl ? "[image]" : "");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        claim_id,
        sender_id: user.id,
        content: finalMessage,
        image_url: imageUrl,
        is_admin: user.user_metadata?.role === "admin",
      })
      .select()
      .single();

    if (error) {
      console.error("INSERT ERROR:", error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: data });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
