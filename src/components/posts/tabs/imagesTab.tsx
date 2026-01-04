"use client";

import React from "react";

export default function ImagesTab({
  images,
  setImages,
  imagePreviews,
  handleImageChange,
  removeImageAt,
  submitImages,
  clearImages,
}: {
  images: File[];
  setImages: (f: File[]) => void;
  imagePreviews: string[];
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImageAt: (index: number) => void;
  submitImages: () => void;
  clearImages: () => void;
}) {
  return (
    <>
      <div
        className="p-8 rounded-2xl border border-dashed border-slate-300 bg-white 
        flex flex-col items-center justify-center gap-4
        hover:border-blue-300 transition-all duration-200 cursor-pointer"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="sr-only"
          id="images-upload"
        />

        <label htmlFor="images-upload" className="cursor-pointer block text-center py-6 w-full">
          <div className="mx-auto inline-flex items-center justify-center rounded-full h-12 w-12 bg-slate-50 shadow-sm">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 21H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-sm font-medium text-slate-700 mt-2">Click to select images (or drag & drop)</div>
          <div className="text-xs text-slate-400 mt-1">
            You can upload up to <strong>5 images</strong>. Supported: png, jpg, jpeg, webp. Max 32MB each.
          </div>
        </label>

        {/* previews */}
        {imagePreviews.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3 w-full">
            {imagePreviews.map((src, i) => (
              <div key={src} className="relative rounded-lg overflow-hidden bg-slate-100 aspect-[4/3]">
                <img src={src} className="w-full h-full object-cover" alt={`preview-${i}`} />
                <button
                  onClick={() => removeImageAt(i)}
                  className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow"
                  aria-label={`Remove image ${i + 1}`}
                >
                  ×
                </button>
                <div className="absolute left-2 bottom-2 px-2 py-0.5 rounded-full bg-black/50 text-xs text-white">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex w-full justify-between items-center">
          <div className="text-xs text-slate-500">{images.length}/5 selected</div>
          <div className="flex gap-2">
            <button onClick={clearImages} className="rounded-full px-3 py-1 text-sm bg-slate-50">
              Clear
            </button>
            <button
              onClick={submitImages}
              disabled={images.length === 0}
              className={`rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm ${
                images.length === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 active:scale-95"
              }`}
            >
              Post images
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md text-sm grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        <div className="p-4">
          <h4 className="text-sm font-semibold mb-1">Image size</h4>
          <p className="text-xs text-slate-600">Supported image files up to 32MB</p>
        </div>

        <div className="p-4">
          <h4 className="text-sm font-semibold mb-1">Image format</h4>
          <p className="text-xs text-slate-600">
            Use png, jpg, jpeg, webp. GIF/live photos are not supported.
          </p>
        </div>

        <div className="p-4">
          <h4 className="text-sm font-semibold mb-1">Image resolution</h4>
          <p className="text-xs text-slate-600">
            Recommended 720×960+. No strict aspect ratio required.
          </p>
        </div>
      </div>
    </>
  );
}
