import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // Full access client

// ✅ Update (Edit) Item
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from("items")
      .update({
        name: body.name,
        description: body.description,
        status: body.status,
        campus: body.campus,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Update failed:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// ✅ Delete Item
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin.from("items").delete().eq("id", params.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete failed:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
