"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addItem } from "@/lib/items";

export default function ReportForm() {
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("Lost");

  const [categoryId, setCategoryId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);

  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");

  const [image, setImage] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Load categories, campuses, profile
  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (user) {
        setReporterEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        setReporterName(profile?.full_name || "");
      }

      const { data: cat } = await supabase.from("categories").select("*");
      setCategories(cat || []);

      const { data: camp } = await supabase.from("campuses").select("*");
      setCampuses(camp || []);
    }

    load();
  }, []);

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { data: auth } = await supabase.auth.getUser();

    if (!auth?.user) {
      setMessage("⚠️ You must be logged in.");
      setLoading(false);
      return;
    }

    const success = await addItem({
      name: itemName,
      description,
      location,       // ✅ FIXED — send location
      status,
      category: categoryId, // category_id
      campus: campusId,     // campus_id
      userId: auth.user.id,

      reporterName,
      reporterEmail,
      imageFile: image,
    });

    if (success) {
      setMessage("✅ Report submitted successfully!");

      setItemName("");
      setDescription("");
      setLocation("");
      setCategoryId("");
      setCampusId("");
      setStatus("Lost");
      setImage(null);
    } else {
      setMessage("❌ Failed to submit report. Try again.");
    }

    setLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-6 rounded-2xl shadow"
    >
      <h2 className="text-2xl font-bold text-center mb-4">
        Submit Lost / Found Report
      </h2>

      <input
        className="input"
        placeholder="Item name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        required
      />

      <textarea
        className="input h-24"
        placeholder="Describe the item"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      {/* Category */}
      <label>Category</label>
      <select
        className="input"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        required
      >
        <option value="">Select Category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Campus */}
      <label>Campus</label>
      <select
        className="input"
        value={campusId}
        onChange={(e) => setCampusId(e.target.value)}
        required
      >
        <option value="">Select Campus</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Location */}
      <input
        className="input"
        placeholder="Location where it was lost/found"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        required
      />

      {/* Status */}
      <select
        className="input"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option>Lost</option>
        <option>Found</option>
      </select>

      {/* Reporter Info */}
      <input
        className="input"
        placeholder="Your Name"
        value={reporterName}
        onChange={(e) => setReporterName(e.target.value)}
      />

      <input
        className="input"
        placeholder="Your UB Email"
        value={reporterEmail}
        onChange={(e) => setReporterEmail(e.target.value)}
      />

      {/* Image */}
      <input
        type="file"
        className="input"
        accept="image/*"
        onChange={(e) => setImage(e.target.files?.[0] ?? null)}
      />

      <button
        className="btn w-full mt-4 bg-blue-600 text-white"
        type="submit"
        disabled={loading}
      >
        {loading ? "Submitting..." : "Submit Report"}
      </button>

      {message && <p className="text-center mt-3">{message}</p>}
    </form>
  );
}
