import jsPDF from "jspdf";

export async function generateItemPDF(item: any) {
  const doc = new jsPDF();
  let y = 20;

  // ---- HEADER ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Jaguar Track Lost & Found", 105, y, { align: "center" });
  y += 10;

  doc.setFontSize(14);
  doc.text(`Item Report`, 105, y, { align: "center" });
  y += 12;

  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;

  // ---- TRY TO LOAD IMAGE ----
  if (item.image) {
    try {
      const imageUrl =
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${item.image}`;

      const img = await fetch(imageUrl)
        .then((r) => r.blob())
        .then((blob) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        });

      // Auto fit width
      const imgWidth = 160;
      const imgHeight = 90;

      doc.addImage(img, "JPEG", 25, y, imgWidth, imgHeight);
      y += imgHeight + 12;
    } catch (err) {
      console.error("PDF image error:", err);
      doc.text("Image could not be loaded.", 20, y);
      y += 10;
    }
  }

  // ---- GENERAL FONT ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  // ---- ITEM INFO ----
  doc.text(`Name: ${item.name}`, 20, y); y += 8;
  doc.text(`Category: ${item.category_name}`, 20, y); y += 8;
  doc.text(`Campus: ${item.campus_name}`, 20, y); y += 8;
  doc.text(`Status: ${item.status}`, 20, y); y += 10;

  // ---- REPORTER ----
  doc.text("Reporter Information:", 20, y); y += 7;
  doc.text(`Name: ${item.reporter_name || "Unknown"}`, 20, y); y += 7;
  doc.text(`Email: ${item.reporter_email || "Unknown"}`, 20, y); y += 10;

  // ---- STORAGE ----
  doc.text("Storage Information:", 20, y); y += 7;
  doc.text(`Drop-Off: ${item.dropoff_location || "N/A"}`, 20, y); y += 7;
  doc.text(`Storage: ${item.location || "N/A"}`, 20, y); y += 10;

  // ---- REPORT DETAILS ----
  const formattedDate = new Date(item.reported_at).toLocaleDateString("en-BZ", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = new Date(item.reported_at).toLocaleTimeString("en-BZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.text("Report Details:", 20, y); y += 7;
  doc.text(`Reported Date: ${formattedDate}`, 20, y); y += 7;
  doc.text(`Reported Time: ${formattedTime}`, 20, y); y += 7;

  doc.text(
    `Expiration Date: ${item.report?.expiration_date ? item.report.expiration_date : "N/A"}`,
    20,
    y
  );
  y += 10;

  doc.text(
    `Handled By: ${item.report?.handled_by_name || "System"}`,
    20,
    y
  );

  // ---- SAVE ----
  doc.save(`${item.name}_report.pdf`);
}
