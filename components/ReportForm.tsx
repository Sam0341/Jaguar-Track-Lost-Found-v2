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

  // Load profile + categories + campuses
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
      if (cat) setCategories(cat);

      const { data: camp } = await supabase.from("campuses").select("*");
      if (camp) setCampuses(camp);
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
      location,
      status,
      category: categoryId,
      campus: campusId,
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
      className="max-w-3xl mx-auto p-8 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 fade-in"
    >
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">
        Submit Lost / Found Report
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Item Name */}
        <input
          className="input rounded-2xl"
          placeholder="Item Name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />

        {/* Status */}
        <select
          className="input rounded-2xl"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option>Lost</option>
          <option>Found</option>
        </select>

        {/* Category */}
        <select
          className="input rounded-2xl"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          <option value="">Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Campus */}
        <select
          className="input rounded-2xl"
          value={campusId}
          onChange={(e) => setCampusId(e.target.value)}
          required
        >
          <option value="">Campus</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Description (full width) */}
        <textarea
          className="input rounded-2xl col-span-1 md:col-span-2 h-28"
          placeholder="Description (include when/where it was lost or found)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        {/* Location (full width) */}
        <input
          className="input rounded-2xl col-span-1 md:col-span-2"
          placeholder="Location (Library, Cafe, Lab, Bus Stop...)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />

        {/* Name */}
        <input
          className="input rounded-2xl"
          placeholder="Your Name"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
        />

        {/* Email */}
        <input
          className="input rounded-2xl"
          placeholder="Your UB Email"
          value={reporterEmail}
          onChange={(e) => setReporterEmail(e.target.value)}
        />

        {/* Hidden file input */}
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        />

        {/* Drag & Drop Upload */}
        <label
          htmlFor="file-upload"
          className="col-span-1 md:col-span-2 border-2 border-dashed border-gray-300 dark:border-gray-700 
          rounded-2xl p-6 flex flex-col items-center justify-center text-gray-600 dark:text-gray-300 
          cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <span className="text-sm">
            Drag & drop an image here or click to upload
          </span>

          {image && (
            <span className="mt-2 text-xs opacity-70">
              Selected: <strong>{image.name}</strong>
            </span>
          )}
        </label>

        {/* Submit Button */}
        <div className="col-span-1 md:col-span-2 mt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl font-semibold shadow-lg 
              text-white bg-gradient-to-r from-blue-700 to-blue-500 
              dark:from-ubGold dark:to-yellow-500 hover:opacity-90 transition"
          >
            {loading ? "Submitting..." : "Submit Report"}
          </button>
        </div>

      </div>

      {message && (
        <p className="text-center mt-4 text-sm">{message}</p>
      )}
    </form>
  );
}
