"use client";

import React, { useState } from "react";
import { CloudArrowUpIcon, TrashIcon, PhotoIcon, XMarkIcon, EyeIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import PostModal from "@/src/components/modal/postModal";
import { useAuth } from "@/src/context/authContext";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const { user } = useAuth();

  // Helper to reorder images and previews together
  const handleReorder = (newItems: string[]) => {
    // Find the new order of images based on previews
    const newImages = newItems.map(preview => {
      const idx = imagePreviews.indexOf(preview);
      return images[idx];
    });
    setImages(newImages);
    toast.success("Set", {
      description: "Image position updated",
      duration: 1500,
    });
  };

  const slides = imagePreviews.map(src => ({ src }));
  return (
    <div className="space-y-6">
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageChange}
        className="sr-only"
        id="images-upload"
      />

      {imagePreviews.length === 0 && (
        <div
          className="relative group p-10 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-red-400 hover:bg-red-50/20 transition-all duration-500 ease-out cursor-pointer overflow-hidden"
        >
          <label htmlFor="images-upload" className="cursor-pointer flex flex-col items-center justify-center text-center w-full relative z-10">
            <div className="mb-4 relative">
              <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full scale-150 group-hover:bg-red-500/30 transition-all" />
              <div className="relative inline-flex items-center justify-center rounded-2xl h-16 w-16 bg-white shadow-xl shadow-slate-200/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <CloudArrowUpIcon className="w-8 h-8 text-red-500" />
              </div>
            </div>

            <h3 className="text-base text-slate-900 mb-1">Choose from gallery</h3>

            <div className="mt-4 flex gap-3">
              <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-[10px] font-black text-slate-400  ">Max 5 Photos</span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-[10px] font-black text-slate-400 ">High Quality</span>
            </div>
          </label>
        </div>
      )}

      {imagePreviews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-500 ">Selected Images</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black">{images.length}</span>
            </div>
            <button
              onClick={clearImages}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
            >
              Remove All
            </button>
          </div>

          <Reorder.Group
            axis="x"
            values={imagePreviews}
            onReorder={handleReorder}
            className="grid grid-cols-4 sm:grid-cols-5 gap-3"
          >
            {imagePreviews.map((src, i) => (
              <Reorder.Item
                key={src}
                value={src}
                className="relative group/thumb rounded-2xl overflow-hidden bg-slate-100 aspect-square ring-1 ring-slate-100 shadow-sm cursor-grab active:cursor-grabbing"
              >
                <img
                  src={src}
                  className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500 pointer-events-none"
                  alt={`preview-${i}`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImageAt(i);
                  }}
                  className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-xl transition-all hover:bg-red-500 hover:text-white flex z-20 text-white"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>

                <div
                  onClick={() => {
                    setLightboxIndex(i);
                    setLightboxOpen(true);
                  }}
                  className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center"
                />
              </Reorder.Item>
            ))}

            {/* Add More Placeholder */}
            {imagePreviews.length > 0 && imagePreviews.length < 5 && (
              <label
                htmlFor="images-upload"
                className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-red-400 hover:bg-red-50/20 transition-all duration-300 cursor-pointer aspect-square group/add"
              >
                <div className="flex flex-col items-center gap-1.5 p-2 text-center">
                  <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100 group-hover/add:scale-110 group-hover/add:rotate-3 transition-all duration-300">
                    <PhotoIcon className="w-5 h-5 text-red-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 group-hover/add:text-red-500 uppercase tracking-tight">Add More</span>
                </div>
              </label>
            )}
          </Reorder.Group>
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        styles={{
          container: { backgroundColor: "rgba(0,0,0,0.95)" },
        }}
      />

      {previewPost && (
        <PostModal
          post={previewPost}
          onClose={() => setPreviewPost(null)}
          onToggleLike={() => { }}
          isPreview={true}
        />
      )}

      <div className="pt-4">
        <button
          onClick={submitImages}
          disabled={images.length === 0}
          className={`w-full py-3 rounded-3xl text-sm font-black  tracking-[0.1em] shadow-xl transition-all duration-300 flex items-center justify-center gap-3
            ${images.length === 0
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              : "bg-red-500 text-white hover:bg-red-600 shadow-red-200 hover:scale-[1.02] active:scale-95"
            }
          `}
        >
          {images.length === 0 ? "Select Images to Post" : "Next Step"}
        </button>
      </div>


    </div>
  );
}
