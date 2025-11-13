// /lib/items.ts
import { supabase } from "@/lib/supabaseClient";

export async function addItem(item: any) {
  try {
    // 1️⃣ Get category_id from category NAME
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .eq("name", item.category)
      .maybeSingle();

    if (!categoryRow) {
      throw new Error(`Category not found: ${item.category}`);
    }

    // 2️⃣ Get campus_id from campus NAME
    const { data: campusRow } = await supabase
      .from("campuses")
      .select("id")
      .eq("name", item.campus)
      .maybeSingle();

    if (!campusRow) {
      throw new Error(`Campus not found: ${item.campus}`);
    }

    // 3️⃣ Upload image if exists
    let imagePath = null;
    if (item.imageFile) {
      const fileExt = item.imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("item-photos")
        .upload(fileName, item.imageFile, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      imagePath = fileName;
    }

    // 4️⃣ Insert item
    const { error: insertError } = await supabase.from("items").insert({
      name: item.name,
      description: item.description,
      location: item.location,
      status: item.status,
      reporter_name: item.reporterName,
      reporter_email: item.reporterEmail,
      reported_by: item.userId,
      reported_at: new Date().toISOString(),
      image: imagePath,
      category_id: categoryRow.id,
      campus_id: campusRow.id,
    });

    if (insertError) throw insertError;

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Error adding item:", message);
    return false;
  }
}
