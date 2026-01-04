// src/components/product/ProductMedia.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";


type Props = {
  productImages: File[];
  setProductImages: (f: File[] | ((prev: File[]) => File[])) => void;
  productVideo: File | null;
  setProductVideo: (f: File | null) => void;
};

export default function ProductMedia({ productImages, setProductImages, productVideo, setProductVideo }: Props) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const previews = productImages.map((f) => URL.createObjectURL(f));
  const videoPreview = productVideo ? URL.createObjectURL(productVideo) : null;
  const [lightboxOpen, setLightboxOpen] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState(0);

const slides = previews.map((src) => ({ src }));


  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productImages, productVideo]);

  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files ? Array.from(e.target.files) : [];
    if (incoming.length === 0) return;
    const remaining = 5 - productImages.length;
    const allowed = incoming.slice(0, remaining);
    const validated: File[] = [];
    for (const f of allowed) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 32 * 1024 * 1024) continue;
      validated.push(f);
    }
    if (validated.length === 0) {
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    setProductImages((p) => [...p, ...validated]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeProductImageAt = (index: number) => setProductImages((p) => p.filter((_, i) => i !== index));

  const handleProductVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (!f) return;
    if (!f.type.startsWith("video/")) return;
    setProductVideo(f);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  return (
    <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
      <label className="block text-sm font-medium">Images (max 5)</label>
      <div className="grid grid-cols-4 gap-2">
        {previews.map((src, i) => (
          <div
            key={i}
            className="relative rounded-sm overflow-hidden bg-slate-50 aspect-[4/3]"
            >
            <img
            src={src}
            alt={`img-${i}`}
            onClick={() => {
                setLightboxIndex(i);
                setLightboxOpen(true);
            }}
            className="w-full h-full object-contain object-top cursor-zoom-in transition hover:scale-[1.02]"
            />


  <button
    onClick={() => removeProductImageAt(i)}
    className="absolute top-1 right-1 text-red-500 bg-white rounded-full shadow px-1 text-xs"
  >
    ✕
  </button>
</div>

        ))}
        {previews.length < 5 && (
          <label className="flex items-center justify-center rounded-lg border-dashed border p-2 text-center cursor-pointer aspect-[4/3]">
            <input ref={imageInputRef} onChange={handleProductImageChange} type="file" accept="image/*" multiple className="hidden" />
            <div className="text-sm">Add images</div>
          </label>
        )}
      </div>

      <label className="block text-sm font-medium">Video (max 1)</label>
      <div className="space-y-2">
        {videoPreview ? (
         <div className="relative bg-slate-50 rounded-lg overflow-hidden max-w-full">
            <video
                src={videoPreview}
                controls
                className="w-full h-auto max-h-[220px] object-contain"
            />

        <button
            onClick={() => setProductVideo(null)}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-red-50 text-red-500"
        >
            ✕
        </button>
        </div>

        ) : (
          <label className="flex items-center justify-center rounded-lg border-dashed border p-4 cursor-pointer">
            <input ref={videoInputRef} onChange={handleProductVideoChange} type="file" accept="video/*" className="hidden" />
            <div className="text-sm">Add a short video (optional)</div>
          </label>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => { setProductImages([]); setProductVideo(null); }} className="px-3 py-2 rounded-lg bg-slate-50 text-sm w-full sm:w-auto">
          Clear media
        </button>
        <div className="text-xs text-slate-400 self-center">{productImages.length} images • {productVideo ? "1 video" : "0 videos"}</div>
      </div>

      <Lightbox
  open={lightboxOpen}
  close={() => setLightboxOpen(false)}
  index={lightboxIndex}
  slides={slides}
  styles={{
    container: { backgroundColor: "rgba(0,0,0,0.95)" },
  }}
/>

    </div>
  );
}
