import { supabase } from "./supabaseClient";

export type Item = {
  id: string;
  name: string;
  description: string;
  location: string;
  status: string;
  image?: string;
  image_url?: string;

  campus?: string;
  category?: string;

  reporter_name?: string;
  reporter_email?: string;
  reported_at?: string;
};

// ----------------------------
// FETCH ALL ITEMS
// ----------------------------
export async function getAllItems() {
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
    campus: item.campus?.[0]?.name || "Unknown Campus",
    category: item.category?.[0]?.name || "Other",
    image_url: item.image
      ? `${PUBLIC_BUCKET}/${item.image}`
      : "https://placehold.co/600x400?text=No+Image",
  }));
}

// ----------------------------
// FETCH ONE ITEM BY ID
// ----------------------------
export async function getItemById(id: string) {
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
    .eq("id", id)
    .single(); // <== IMPORTANT!

  if (error) {
    console.error("❌ Error fetching item:", error.message);
    return null;
  }

  const PUBLIC_BUCKET =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  return {
    ...data,
    campus: data.campus?.[0]?.name || "Unknown Campus",
    category: data.category?.[0]?.name || "Other",
    image_url: data.image
      ? `${PUBLIC_BUCKET}/${data.image}`
      : "https://placehold.co/600x400?text=No+Image",
  };
}

// ----------------------------
// ADD A NEW ITEM
// ----------------------------
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
  category: string; // category_id
  campus: string;   // campus_id
  userId: string;
  imageFile?: File | null;
  reporterName?: string;
  reporterEmail?: string;
}) {
  try {
    let imagePath: string | null = null;

    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("item-photos")
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;
      imagePath = fileName;
    }

    const { error } = await supabase.from("items").insert([
      {
        name,
        description,
        location,
        status,
        image: imagePath,
        reported_by: userId,
        reporter_name: reporterName,
        reporter_email: reporterEmail,

        // FK VALUES
        category_id: category,
        campus_id: campus,
      },
    ]);

    if (error) throw error;

    console.log("✅ Item added successfully");
    return true;
  } catch (err: any) {
    console.error("❌ Error adding item:", err.message || err);
    return false;
  }
}
