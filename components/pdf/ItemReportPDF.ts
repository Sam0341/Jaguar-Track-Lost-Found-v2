import jsPDF from "jspdf";

export function generateItemPDF(item: any) {
  const doc = new jsPDF();
  let y = 20;

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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  // Item Info
  doc.text(`Name: ${item.name}`, 20, y); y += 8;
  doc.text(`Category: ${item.category_name}`, 20, y); y += 8;
  doc.text(`Campus: ${item.campus_name}`, 20, y); y += 8;
  doc.text(`Status: ${item.status}`, 20, y); y += 10;

  // Reporter
  doc.text("Reporter Information:", 20, y);
  y += 7;
  doc.text(`Name: ${item.reporter_name || "Unknown"}`, 20, y); y += 7;
  doc.text(`Email: ${item.reporter_email || "Unknown"}`, 20, y); y += 10;

  // Storage
  doc.text("Storage Information:", 20, y);
  y += 7;
  doc.text(`Drop-Off: ${item.dropoff_location || "N/A"}`, 20, y); y += 7;
  doc.text(`Storage: ${item.location || "N/A"}`, 20, y); y += 10;

  // Report details
  doc.text("Report Details:", 20, y);
  y += 7;
  doc.text(`Reported Date: ${item.reported_at}`, 20, y); y += 7;
  doc.text(
    `Reported Time: ${
      new Date(item.reported_at).toLocaleTimeString("en-BZ", { hour: "2-digit", minute: "2-digit" })
    }`,
    20,
    y
  );
  y += 7;

  doc.text(
    `Expiration Date: ${item.report?.expiration_date || "N/A"}`,
    20,
    y
  ); 
  y += 10;

  doc.text(
    `Handled By: ${item.report?.handled_by_name || "System"}`,
    20,
    y
  );

  doc.save(`${item.name}_report.pdf`);
}
