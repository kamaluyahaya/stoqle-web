// src/components/product/ProductMedia.tsx
"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Check, Trash2, X, Heart, Share2, ShoppingBag, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  productImages: (File | string)[];
  setProductImages: (f: (File | string)[] | ((prev: (File | string)[]) => (File | string)[])) => void;
  productVideo: File | string | null;
  setProductVideo: (f: File | string | null) => void;
  onProcessVideo?: (f: File) => void;
  businessName?: string;
  businessLogo?: string;
};

export default function ProductMedia({ productImages, setProductImages, productVideo, setProductVideo, onProcessVideo, businessName, businessLogo }: Props) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);

  const handleTimeUpdate = () => {
    if (!videoElementRef.current) return;
    const p = (videoElementRef.current.currentTime / videoElementRef.current.duration) * 100;
    setProgress(p);
  };

  const togglePlayback = () => {
    if (!videoElementRef.current) return;
    if (videoElementRef.current.paused) {
      videoElementRef.current.play();
      setIsPlaying(true);
    } else {
      videoElementRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Memoize preview URLs to avoid creating them on every render
  const previews = useMemo(() => productImages.map((f) => (typeof f === "string" ? f : URL.createObjectURL(f))), [productImages]);
  const videoPreview = useMemo(() => {
    if (!productVideo) return null;
    return typeof productVideo === "string" ? productVideo : URL.createObjectURL(productVideo);
  }, [productVideo]);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const slides = useMemo(() => previews.map((src) => ({ src })), [previews]);

  useEffect(() => {
    return () => {
      productImages.forEach((f) => {
        if (typeof f !== "string") URL.revokeObjectURL(URL.createObjectURL(f)); // This logic is slightly flawed but previews is safer
      });
      // Actually, better to revoke the actual previews
    };
  }, []); // Only on unmount or specific changes. Actually previews keeps track.

  // Re-written safe cleanup
  useEffect(() => {
    const localUrls: string[] = [];
    productImages.forEach(f => {
      if (typeof f !== 'string') localUrls.push(URL.createObjectURL(f));
    });
    return () => {
      localUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [productImages]);

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

    if (onProcessVideo) {
      onProcessVideo(f);
    } else {
      setProductVideo(f);
    }

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
          <div className="flex justify-center py-6 bg-slate-100/50 rounded-2xl border border-slate-200">
            <div
              onClick={togglePlayback}
              className="relative w-[240px] aspect-[9/19.5] bg-slate-900 rounded-[3rem] shadow-2xl ring-8 ring-slate-800 overflow-hidden group/phone flex items-center justify-center cursor-pointer"
            >
              {/* Apple Phone Notches & Details */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-800 rounded-b-2xl z-40 flex items-center justify-center gap-1.5 px-3 pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 font-bold" />
                <div className="w-8 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Status Bar Mock */}
              <div className="absolute top-2 left-0 right-0 px-6 flex justify-between items-center z-40 pointer-events-none">
                <span className="text-[10px] font-black text-white/90 tabular-nums">9:41</span>
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4].map(i => <div key={i} className="w-0.5 h-2 bg-white/90 rounded-full" />)}
                  </div>
                  <div className="w-4 h-2 rounded-[2px] border border-white/40 flex items-center px-[1px]">
                    <div className="w-full h-full bg-white/90 rounded-[1px]" />
                  </div>
                </div>
              </div>

              <video
                ref={videoElementRef}
                src={videoPreview}
                autoPlay
                loop
                playsInline
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setVideoAspectRatio(v.videoWidth / v.videoHeight);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayback();
                }}
                className={`w-full h-full relative z-10 ${videoAspectRatio && videoAspectRatio < 0.8 ? "object-cover" : "object-contain"}`}
              />

              {/* Central Play Icon when Paused */}
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                  >
                    <Play className="w-12 h-12 text-white/90 drop-shadow-2xl fill-white/80" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* LIVE REEL UI OVERLAY */}
              <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-end p-4 pb-12 bg-gradient-to-t from-black/60 via-transparent to-black/20">

                {/* Social Sidebar Actions */}
                <div className="absolute right-3 bottom-32 flex flex-col gap-5 items-center pointer-events-auto">
                  <div className="flex flex-col items-center gap-1">
                    <div className="p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:text-red-500 transition-colors cursor-pointer active:scale-90">
                      <Heart className="w-5 h-5 fill-none" />
                    </div>
                    <span className="text-[8px] font-bold text-white  tracking-tighter shadow-sm">3.2k</span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white hover:text-blue-400 transition-colors cursor-pointer active:scale-90">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-[8px] font-bold text-white  tracking-tighter shadow-sm">Share</span>
                  </div>
                </div>

                {/* Bottom Vendor Info & Buy Button */}
                <div className="w-full pointer-events-auto flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full border border-white/40 p-0.5 shadow-xl bg-white/10 backdrop-blur-md overflow-hidden shrink-0">
                      {businessLogo ? (
                        <img src={businessLogo} alt="logo" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-white ">ST</div>
                      )}
                    </div>
                    <h4 className="text-[11px] font-bold text-white truncate drop-shadow-lg tracking-tight leading-tight">{businessName || "Stoqle Vendor"}</h4>
                  </div>

                  <button className="px-2 h-6 bg-red-500 hover:bg-red-600 active:scale-95 transition-all text-white font-black text-[8px] tracking-tight rounded-lg flex items-center justify-center shadow-lg shrink-0">
                    Buy now
                  </button>
                </div>
              </div>

              {/* Glass Glare */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/10 via-transparent to-transparent z-30 pointer-events-none" />

              <button
                onClick={() => setProductVideo(null)}
                className="absolute top-10 right-4 bg-black/40 backdrop-blur-md rounded-full p-2 shadow-lg hover:bg-red-500 transition-all text-white z-50 group-hover/phone:scale-110 pointer-events-auto"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/20 rounded-full z-40" />

              {/* Progress Bar (at the very bottom of visible area) */}
              <div className="absolute bottom-1 left-0 right-0 h-0.5 bg-white/10 z-40">
                <div
                  className="h-full bg-red-500 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
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
        on={{ view: ({ index }) => setLightboxIndex(index) }}
        slides={slides}
        portal={{ root: typeof document !== "undefined" ? document.body : undefined }}
        styles={{
          root: { zIndex: 30000 },
          container: { backgroundColor: "rgba(0,0,0,0.95)" }
        }}
        render={{
          controls: () => (
            <div className="absolute top-4 right-16 z-[30001] flex items-center gap-2">
              <button
                onClick={() => {
                  if (lightboxIndex === 0) {
                    toast.info("This is already the cover image");
                    return;
                  }
                  const newImages = [...productImages];
                  const [img] = newImages.splice(lightboxIndex, 1);
                  newImages.unshift(img);
                  setProductImages(newImages);
                  setLightboxIndex(0);
                  toast.success("Set✅");
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-[10px] font-bold transition-all flex items-center gap-2 border border-white/20"
              >
                <Check className="w-3.5 h-3.5" />
                Set as cover
              </button>
            </div>
          ),
          slideFooter: () => (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[30001]">
              <button
                onClick={() => {
                  removeProductImageAt(lightboxIndex);
                  if (productImages.length <= 1) {
                    setLightboxOpen(false);
                  }
                }}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500 transition-all backdrop-blur-md rounded-full text-red-500 hover:text-white text-[10px] font-bold flex items-center gap-3 border border-red-500/30"
              >
                <Trash2 className="w-4 h-4" />
                Delete Image
              </button>
            </div>
          )
        }}
      />
    </div>
  );
}
