"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addItem } from "@/lib/items";

export default function ReportForm() {
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [campus, setCampus] = useState("");
  const [status, setStatus] = useState("found");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 🧠 Auto-fill user info from Supabase
  useEffect(() => {
    async function fetchUserInfo() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (user) {
        setReporterEmail(user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (profile?.full_name) setReporterName(profile.full_name);
      }
    }

    fetchUserInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("⚠️ You must be logged in to submit a report.");
      setLoading(false);
      return;
    }

    // ✅ Capitalize the first letter of the status to match DB constraint
    const properStatus =
      status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

    const success = await addItem({
      name: itemName,
      description,
      category,
      campus,
      status: properStatus,
      userId: user.id,
      imageFile: image,
      reporterName,
      reporterEmail,
    });

    if (success) {
      setMessage("✅ Report submitted successfully!");
      setItemName("");
      setDescription("");
      setCategory("");
      setCampus("");
      setStatus("lost"); // Reset to Lost (default)
      setImage(null);
    } else {
      setMessage("❌ Failed to submit report. Try again.");
    }

    setLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-2xl space-y-5"
    >
      <h2 className="text-2xl font-bold text-center text-blue-700">
        
      </h2>

      {/* Item Name */}
      <input
        type="text"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="Item name"
        className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        required
      />

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="border p-2 w-full rounded-lg h-24 focus:ring-2 focus:ring-blue-400 outline-none"
        required
      />

      {/* Category Dropdown */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
          required
        >
          <option value="">Select a category</option>
          <option value="Books & Documents">📚 Books & Documents</option>
          <option value="Electronics">💻 Electronics</option>
          <option value="Clothing">👕 Clothing</option>
          <option value="Jewelry">💍 Jewelry</option>
          <option value="Sports Equipment">🏀 Sports Equipment</option>
          <option value="Wallets & IDs">💳 Wallets & IDs</option>
          <option value="Bags">🎒 Bags</option>
          <option value="Other">🔖 Other</option>
        </select>
      </div>

      {/* Campus Dropdown */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">Campus</label>
        <select
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
          required
        >
          <option value="">Select a campus</option>
          <option value="Belmopan (Central Campus)">
            Belmopan (Central Campus)
          </option>
          <option value="Belize City Campus">Belize City Campus</option>
          <option value="Central Farm">Central Farm</option>
          <option value="Punta Gorda">Punta Gorda</option>
        </select>
      </div>

      {/* Status Dropdown */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
          required
        >
          <option value="found">Found</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {/* Name + Email Fields */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
          placeholder="Your name"
          className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        />
        <input
          type="email"
          value={reporterEmail}
          onChange={(e) => setReporterEmail(e.target.value)}
          placeholder="Your UB email"
          className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        />
      </div>

      {/* Image Upload */}
      <div>
        <label className="block mb-1 font-medium text-gray-700">
          Image (optional)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
          className="border p-2 w-full rounded-lg"
        />
      </div>

      {/* Submit */}
      <button
        disabled={loading}
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
      >
        {loading ? "Submitting..." : "Submit Report"}
      </button>

      {message && (
        <p
          className={`text-center font-medium ${
            message.includes("✅")
              ? "text-green-600"
              : message.includes("⚠️")
              ? "text-yellow-600"
              : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
