"use client";

import React, { useEffect, useState } from "react";

export default function ImagePreviewModal({
  imageFiles,
  imagePreviews,
  onClose,
  onSuccess,
}: {
  imageFiles: File[];
  imagePreviews: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (step === 0) {
        if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, imagePreviews.length - 1));
        if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, imagePreviews.length, onClose]);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("text", text);
      fd.append("subtitle", subtitle);
      fd.append("privacy", privacy);

      imageFiles.forEach((f, i) => {
        // key is "images" (server should accept images[])
        fd.append("images", f, f.name);
      });

      const res = await fetch("/api/social/", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Upload failed (${res.status})`);
      }

      // success
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl max-w-3xl w-full shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="text-sm font-semibold">Create post</div>
          <button onClick={onClose} className="text-lg px-2 py-1 rounded-md hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="p-6">
          {step === 0 ? (
            <>
              {/* slider preview */}
              <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                {imagePreviews.length > 0 ? (
                  <img src={imagePreviews[index]} className="w-full h-full object-cover" alt={`slide-${index}`} />
                ) : (
                  <div className="text-slate-400">No images</div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={index === 0}
                    className="rounded-full px-3 py-1 bg-slate-50"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setIndex((i) => Math.min(imagePreviews.length - 1, i + 1))}
                    disabled={index === imagePreviews.length - 1}
                    className="rounded-full px-3 py-1 bg-slate-50"
                  >
                    →
                  </button>
                  <div className="text-xs text-slate-500 ml-3">
                    {index + 1} / {imagePreviews.length}
                  </div>
                </div>

                <div className="text-xs text-slate-500">Click Next to add title & visibility</div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button onClick={onClose} className="rounded-full px-3 py-1 bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              {/* form step */}
              <div className="grid grid-cols-1 gap-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write something..."
                  rows={3}
                  className="w-full p-3 rounded-lg border resize-none"
                />
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Subtitle (optional)"
                  className="w-full p-3 rounded-lg border"
                />

                <div className="flex items-center gap-3">
                  <label className="text-sm">Visibility</label>
                  <div className="flex gap-2">
                    <label className={`px-3 py-1 rounded-full border ${privacy === "public" ? "bg-slate-100" : ""}`}>
                      <input
                        type="radio"
                        name="privacy"
                        value="public"
                        checked={privacy === "public"}
                        onChange={() => setPrivacy("public")}
                        className="mr-1"
                      />
                      Public
                    </label>
                    <label className={`px-3 py-1 rounded-full border ${privacy === "private" ? "bg-slate-100" : ""}`}>
                      <input
                        type="radio"
                        name="privacy"
                        value="private"
                        checked={privacy === "private"}
                        onChange={() => setPrivacy("private")}
                        className="mr-1"
                      />
                      Private
                    </label>
                  </div>
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}
              </div>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-xs text-slate-500">{imageFiles.length} image(s) attached</div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(0)} className="rounded-full px-3 py-1 bg-slate-50">
                    Back
                  </button>
                  <button
                    onClick={submit}
                    disabled={loading}
                    className={`rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm ${
                      loading ? "bg-gray-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    {loading ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
