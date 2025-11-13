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
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [successPopup, setSuccessPopup] = useState(false);

  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  /* LOAD DATA */
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

      setCategories((await supabase.from("categories").select("*")).data || []);
      setCampuses((await supabase.from("campuses").select("*")).data || []);
    }
    load();
  }, []);

  /* DRAG & DROP HANDLERS */
  function handleDrag(e: any) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: any) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e: any) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  /* SUBMIT FORM */
  async function handleSubmit(e: React.FormEvent) {
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
      setSuccessPopup(true);
      setTimeout(() => setSuccessPopup(false), 3000);

      setItemName("");
      setDescription("");
      setLocation("");
      setCategoryId("");
      setCampusId("");
      setStatus("Lost");
      setImage(null);
      setImagePreview(null);
    } else {
      setMessage("❌ Failed to submit report.");
    }

    setLoading(false);
  }

  return (
    <div className="py-10 px-4">
      <h2 className="text-3xl font-bold text-center mb-6">
        Submit Lost or Found Report
      </h2>

      <form onSubmit={handleSubmit} className="form-card">
        {/* TWO COLUMN GRID */}
        <div className="form-section">

          <div className="form-input-wrapper">
            <input
              className={`form-input ${itemName ? "not-empty" : ""}`}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
            <label className="form-label">Item Name</label>
          </div>

          <div className="form-input-wrapper">
            <select
              className={`form-input ${status ? "not-empty" : ""}`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>Lost</option>
              <option>Found</option>
            </select>
            <label className="form-label">Status</label>
          </div>

          <div className="form-input-wrapper">
            <select
              className={`form-input ${categoryId ? "not-empty" : ""}`}
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
            <label className="form-label">Category</label>
          </div>

          <div className="form-input-wrapper">
            <select
              className={`form-input ${campusId ? "not-empty" : ""}`}
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
            <label className="form-label">Campus</label>
          </div>

        </div>

        {/* Description */}
        <div className="form-input-wrapper mt-4">
          <textarea
            className={`form-input h-28 resize-none ${
              description ? "not-empty" : ""
            }`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <label className="form-label">
            Description (include when/where it was lost or found)
          </label>
        </div>

        {/* Location */}
        <div className="form-input-wrapper">
          <input
            className={`form-input ${location ? "not-empty" : ""}`}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <label className="form-label">Location</label>
        </div>

        {/* Reporter Info */}
        <div className="form-section">
          <div className="form-input-wrapper">
            <input
              className={`form-input ${reporterName ? "not-empty" : ""}`}
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
            />
            <label className="form-label">Your Name</label>
          </div>

          <div className="form-input-wrapper">
            <input
              className={`form-input ${reporterEmail ? "not-empty" : ""}`}
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
            />
            <label className="form-label">Your UB Email</label>
          </div>
        </div>

        {/* DRAG & DROP UPLOAD */}
        <div
          className={`dropzone ${dragActive ? "dragover" : ""}`}
          onDragOver={handleDrag}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <p className="text-center text-gray-500 dark:text-gray-300">
            Drag & drop an image here or click to upload
          </p>
        </div>

        <input
          type="file"
          id="file-input"
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setImage(file);
            if (file) setImagePreview(URL.createObjectURL(file));
          }}
        />

        {imagePreview && <img src={imagePreview} className="image-preview" />}

        <button className="submit-btn" disabled={loading}>
          {loading ? "Submitting..." : "Submit Report"}
        </button>

        {message && (
          <p className="text-center mt-4 text-red-500 dark:text-red-400">
            {message}
          </p>
        )}
      </form>

      {successPopup && (
        <div className="popup-success">
          ✅ Report Submitted!
        </div>
      )}
    </div>
  );
}
