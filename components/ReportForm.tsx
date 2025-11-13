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
    <div className="flex justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="
          w-full max-w-2xl 
          bg-white dark:bg-gray-900 
          rounded-2xl shadow-xl 
          p-8 space-y-6 mt-10
        "
      >
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100">
          Submit Lost / Found Report
        </h2>

        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="input"
            placeholder="Item Name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />

          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>Lost</option>
            <option>Found</option>
          </select>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            required
          >
            <option value="">Campus</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <textarea
          className="input h-28"
          placeholder="Description (include when/where it was lost or found)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        {/* Location */}
        <input
          className="input"
          placeholder="Location (Library, Cafe, Lab, Bus Stop...)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />

        {/* Row Reporter Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        {/* Image upload */}
        <label
          className="
            border-2 border-dashed 
            border-gray-300 dark:border-gray-600 
            p-4 rounded-xl text-center cursor-pointer
            hover:bg-gray-100 dark:hover:bg-gray-800 transition
          "
        >
          <span className="block text-gray-600 dark:text-gray-300">
            Drag & drop an image here or click to upload
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </label>

        {/* Submit button */}
        <button
          className="
            w-full py-3 rounded-xl 
            bg-gradient-to-r from-blue-700 to-blue-500
            dark:from-ubGold dark:to-yellow-400
            text-white font-semibold shadow-lg
            hover:opacity-90 transition
          "
          type="submit"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>

        {message && (
          <p className="text-center mt-2 text-sm">{message}</p>
        )}
      </form>
    </div>
  );
}
