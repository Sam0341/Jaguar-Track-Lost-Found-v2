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
  dropoff_location?: string;
  reported_at?: string;
};

// -------------------------------------------------------
// FETCH ALL ITEMS
// -------------------------------------------------------
export async function getAllItems() {
  const { data, error } = await supabase
    .from("items")
    .select(`
      id,
      name,
      description,
      location,
      dropoff_location,
      status,
      image,
      reported_at,
      reporter_name,
      reporter_email,
      campus:campus_id ( name ),
      category:category_id ( name )
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

// -------------------------------------------------------
// FETCH ONE ITEM BY ID
// -------------------------------------------------------
export async function getItemById(id: string) {
  const { data, error } = await supabase
    .from("items")
    .select(`
      id,
      name,
      description,
      location,
      dropoff_location,
      status,
      image,
      reported_at,
      reporter_name,
      reporter_email,
      campus:campus_id ( name ),
      category:category_id ( name )
    `)
    .eq("id", id)
    .single();

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

// -------------------------------------------------------
// ADD A NEW ITEM + AUTO REPORT + AUTO EXPIRATION
// -------------------------------------------------------
export async function addItem({
  name,
  description,
  location,
  status,
  category,
  campus,
  dropoffLocation,
  userId,
  imageFile,
  reporterName,
  reporterEmail,
}: {
  name: string;
  description: string;
  location: string;
  status: string;
  category: string;
  campus: string;
  dropoffLocation?: string;
  userId: string;
  imageFile?: File | null;
  reporterName?: string;
  reporterEmail?: string;
}) {
  try {
    let imagePath: string | null = null;

    // Upload image
    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("item-photos")
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      imagePath = fileName;
    }

    // Insert item
    const { data: inserted, error } = await supabase
      .from("items")
      .insert([
        {
          name,
          description,
          location,
          dropoff_location: dropoffLocation || null,
          status,
          image: imagePath,

          reported_by: userId,
          reporter_name: reporterName,
          reporter_email: reporterEmail,

          category_id: category,
          campus_id: campus,

          reported_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // -------------------------------------------------------
    // AUTO CREATE REPORT WITH EXPIRATION
    // -------------------------------------------------------

    // Lost = 30 days, Found = 14 days
    const expirationDate =
      status === "Lost"
        ? new Date(Date.now() + 30 * 86400000)
        : new Date(Date.now() + 14 * 86400000);

    await supabase.from("reports").insert({
      item_id: inserted.id,
      report_type: status,
      storage_location: dropoffLocation || null,
      expiration_date: expirationDate.toISOString(),
      created_at: new Date().toISOString(),
      handled_by: null,
    });

    console.log("✅ Item + Auto Report + Auto Expiration created");
    return true;
  } catch (err: any) {
    console.error("❌ Error adding item:", err.message || err);
    return false;
  }
}
