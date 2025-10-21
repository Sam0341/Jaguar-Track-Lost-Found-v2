import { supabase } from "./supabaseClient";

export type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  campus: string;
  status: string;
  image?: string;
  reported_by?: string;
  reporter_name?: string;
  reporter_email?: string;
  reported_at?: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
};

// 🧩 Fetch all items
export async function getAllItems() {
  console.log("📡 Fetching all items...");

  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      description,
      category,
      campus,
      status,
      image,
      reporter_name,
      reporter_email,
      reported_at
    `
    )
    .order("reported_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching items:", error.message);
    return [];
  }

  // 🖼️ Build public image URLs
  const SUPABASE_URL =
    "https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos";

  const itemsWithImages = (data || []).map((item) => ({
    ...item,
    image_url: item.image
      ? item.image.startsWith("http")
        ? item.image
        : `${SUPABASE_URL}/${item.image}`
      : "https://placehold.co/600x400?text=No+Image+Available",
  }));

  console.log("📦 Items fetched:", itemsWithImages);
  return itemsWithImages;
}

// 🧩 Fetch one item by ID
export async function getItemById(id: string) {
  console.log("🔍 Fetching item by ID:", id);

  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      description,
      category,
      campus,
      status,
      image,
      reporter_name,
      reporter_email,
      reported_at,
      profiles (
        full_name,
        email
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("❌ Error fetching item by ID:", error.message);
    return null;
  }

  const SUPABASE_URL =
    "https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos";

  const finalData = {
    ...data,
    image_url: data.image
      ? data.image.startsWith("http")
        ? data.image
        : `${SUPABASE_URL}/${data.image}`
      : "https://placehold.co/600x400?text=No+Image+Available",
    reporter_name: data.profiles?.full_name || data.reporter_name,
    reporter_email: data.profiles?.email || data.reporter_email,
  };

  console.log("🧩 getItemById() result:", finalData);
  return finalData;
}

// 🧩 Add a new item
export async function addItem({
  name,
  description,
  category,
  campus,
  status,
  userId,
  imageFile,
  reporterName,
  reporterEmail,
}: {
  name: string;
  description: string;
  category: string;
  campus: string;
  status: string;
  userId: string;
  imageFile?: File | null;
  reporterName?: string;
  reporterEmail?: string;
}) {
  console.log("🆕 Adding new item...");

  try {
    let imagePath: string | null = null;

    // ✅ Upload image to Supabase storage
    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("item-photos")
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;
      imagePath = fileName;
    }

    // ✅ Insert record into the database
    const { data, error } = await supabase.from("items").insert([
      {
        name,
        description,
        category,
        campus,
        status,
        image: imagePath,
        reported_by: userId,
        reporter_name: reporterName,
        reporter_email: reporterEmail,
      },
    ]);

    if (error) throw error;

    console.log("✅ Item added successfully:", data);
    return true;
  } catch (err: any) {
    console.error("❌ Error adding item:", err.message || err);
    return false;
  }
}
