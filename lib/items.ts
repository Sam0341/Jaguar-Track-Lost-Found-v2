import { supabase } from "./supabaseClient";

export type Item = {
  id: string;
  name: string;
  description: string;
  location?: string;
  status: string;
  image?: string;
  image_url?: string;

  reporter_name?: string;
  reporter_email?: string;
  reported_at?: string;

  campus_id?: string;
  category_id?: string;
};

// -----------------------------------------------------
// 📌 GET ALL ITEMS
// -----------------------------------------------------
export async function getAllItems() {
  console.log("📡 Fetching all items...");

  const { data, error } = await supabase
    .from("items")
    .select(`
      id,
      name,
      description,
      location,
      status,
      image,
      reported_at,
      reporter_name,
      reporter_email,
      campus:campus_id ( id, name ),
      category:category_id ( id, name )
    `)
    .order("reported_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching items:", error.message);
    return [];
  }

  const PUBLIC_BUCKET =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  return (data || []).map((item: any) => ({
    ...item,
    campus: item.campus?.name || "Unknown Campus",
    category: item.category?.name || "Other",
    image_url: item.image
      ? `${PUBLIC_BUCKET}/${item.image}`
      : "https://placehold.co/600x400?text=No+Image",
  }));
}

// -----------------------------------------------------
// 📌 GET ONE ITEM BY ID
// -----------------------------------------------------
export async function getItemById(id: string) {
  console.log("🔍 Fetching item:", id);

  const { data, error } = await supabase
    .from("items")
    .select(`
      id,
      name,
      description,
      location,
      status,
      image,
      reporter_name,
      reporter_email,
      reported_at,
      campus:campus_id ( id, name ),
      category:category_id ( id, name )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("❌ Error getItemById:", error.message);
    return null;
  }

  const PUBLIC_BUCKET =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  return {
    ...data,
    campus: data.campus?.name,
    category: data.category?.name,
    image_url: data.image
      ? `${PUBLIC_BUCKET}/${data.image}`
      : "https://placehold.co/600x400?text=No+Image",
  };
}

// -----------------------------------------------------
// 📌 ADD NEW ITEM
// -----------------------------------------------------
export async function addItem({
  name,
  description,
  location,
  status,
  category,
  campus,
  userId,
  imageFile,
  reporterName,
  reporterEmail,
}: {
  name: string;
  description: string;
  location: string;
  status: string;

  category: string;   // category_id
  campus: string;     // campus_id
  userId: string;

  imageFile?: File | null;
  reporterName?: string;
  reporterEmail?: string;
}) {
  console.log("🆕 Adding Item...");

  try {
    let imagePath = null;

    // Upload image if exists
    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("item-photos")
        .upload(fileName, imageFile);

      if (uploadErr) throw uploadErr;
      imagePath = fileName;
    }

    const { data, error } = await supabase.from("items").insert([
      {
        name,
        description,
        location,
        status,
        category_id: category,
        campus_id: campus,
        image: imagePath,

        reported_by: userId,
        reporter_name: reporterName,
        reporter_email: reporterEmail,
        reported_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    console.log("✅ Added Successfully:", data);
    return true;
  } catch (err: any) {
    console.error("❌ Error adding item:", err.message || err);
    return false;
  }
}
