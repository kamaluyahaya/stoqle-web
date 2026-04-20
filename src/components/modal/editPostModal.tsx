// src/components/modal/editPostModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockOpenIcon,
  LockClosedIcon,
  UsersIcon,
  CheckIcon,
  EyeIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import { FaHeart } from "react-icons/fa";
import DefaultInput from "@/src/components/input/default-input-post";
import { toast } from "sonner";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import PostModal from "./postModal";
import ProductSelectorModal from "@/src/components/product/ProductSelectorModal";
import type { Post, User } from "@/src/lib/types";

type Props = {
  open: boolean;
  post: Post | null;
  onClose: () => void;
  onUpdated: (post: any) => void;
};

export default function EditPostModal({ open, post, onClose, onUpdated }: Props) {
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "friends">("public");
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const [localMedia, setLocalMedia] = useState<{ url: string; id: any }[]>([]);
  const { token, user: activeUser, isBusiness } = useAuth() as any;

  useEffect(() => {
    if (post) {
      setText(post.caption || "");
      setSubtitle(post.subtitle || "");
      setPrivacy((post.privacy as any) || "public");
      setCoverId(null);
      setIndex(0);
      // Restore existing linked product (if any)
      setSelectedProduct(post.linked_product ? { ...post.linked_product } : null);

      let initialMedia = post.allMedia && post.allMedia.length > 0 ? [...post.allMedia] : (post.src ? [{ url: post.src, id: null }] : []);
      // If we have a source URL (current cover), move it to the first position so it's shown first
      if (post.src && initialMedia.length > 1) {
        const coverIdx = initialMedia.findIndex(m => m.url === post.src);
        if (coverIdx > 0) {
          const cover = initialMedia[coverIdx];
          initialMedia.splice(coverIdx, 1);
          initialMedia.unshift(cover);
        }
      }
      setLocalMedia(initialMedia);
    }
  }, [post, open]);

  const [coverId, setCoverId] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  if (!open || !post) return null;

  const handleUpdate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/${post.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text,
          subtitle,
          privacy,
          cover_id: coverId || undefined,
          linked_product_id: selectedProduct?.product_id ?? null
        })
      });

      if (!res.ok) throw new Error("Failed to update post");

      const json = await res.json();
      toast.success("Post updated!");

      onUpdated({
        ...post,
        caption: text,
        subtitle,
        privacy,
        src: localMedia[0]?.url || post.src,
        allMedia: localMedia,
        is_product_linked: !!selectedProduct,
        linked_product: selectedProduct
          ? {
            product_id: selectedProduct.product_id,
            title: selectedProduct.title,
            price: selectedProduct.min_variant_price || selectedProduct.min_sku_price || selectedProduct.price,
            image_url: selectedProduct.image_url || selectedProduct.first_image,
            first_image: selectedProduct.first_image,
            total_sold: selectedProduct.total_sold,
            total_quantity: selectedProduct.total_quantity
          }
          : null
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update post");
    } finally {
      setLoading(false);
    }
  };

  const getNoteStyles = (config: any) => {
    if (!config) return {};
    const cfg = typeof config === "string" ? JSON.parse(config) : config;
    return {
      backgroundColor: cfg.startColor || "#ffffff",
      backgroundImage: cfg.template === "gradient" ? `linear-gradient(135deg, ${cfg.startColor}, ${cfg.endColor})` : "none",
      color: cfg.textStyle?.color || "#000000",
      fontSize: "24px",
      fontWeight: "800",
      fontFamily: cfg.seed ? ("'Courier New', Courier, monospace") : "inherit"
    };
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0) {
        setProgress((current / duration) * 100);
      }
    }
  };

  const mediaList = localMedia;

  return (
    <div className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center p-0" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-lg bg-white h-[100dvh] sm:h-auto sm:max-h-[95vh] rounded-none sm:rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between relative border-b border-slate-100">
          <div className="w-10"></div>
          <h2 className="text-sm font-bold text-slate-900 absolute left-1/2 -translate-x-1/2  tracking-wide">Edit Post</h2>
          <div className="w-10 flex justify-end">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="flex flex-col h-full p-6 space-y-8">
            {/* Media View (Sliding if multiple images) */}
            <div className="w-full relative group">
              <div className="bg-slate-100 rounded-2xl border border-slate-100 shadow-inner flex items-center justify-center overflow-hidden h-[400px]">
                {post.coverType === "note" ? (
                  <div
                    className="w-full h-full flex items-center justify-center p-8 text-center"
                    style={getNoteStyles(post.noteConfig)}
                  >
                    <p className="line-clamp-6">{post.noteConfig?.text || post.caption || "Note contents"}</p>
                  </div>
                ) : post.isVideo ? (
                  <div className="flex justify-center w-full h-full bg-slate-50 py-4">
                    <div className="relative w-[180px] h-[360px] bg-slate-900 rounded-[2.5rem] border-[6px] border-slate-900 shadow-xl overflow-hidden group/phone">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-900 rounded-b-xl z-20" />

                      {/* Video Content */}
                      <div
                        className="w-full h-full cursor-pointer relative"
                        onClick={togglePlay}
                      >
                        <video
                          ref={videoRef}
                          src={post.src}
                          className={`w-full h-full ${videoAspectRatio && videoAspectRatio < 0.8 ? "object-cover" : "object-contain"}`}
                          loop
                          playsInline
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onTimeUpdate={handleTimeUpdate}
                          onLoadedMetadata={(e) => {
                            const v = e.currentTarget;
                            setVideoAspectRatio(v.videoWidth / v.videoHeight);
                          }}
                        />

                        {/* Progress Bar */}
                        <div className="absolute bottom-[1px] left-0 w-full h-[1.2px] bg-white/20 z-30">
                          <div
                            className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        {/* Play Overlay */}
                        <AnimatePresence>
                          {!isPlaying && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              className="absolute inset-0 flex items-center justify-center bg-black/10"
                            >
                              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/90">
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Social Overlays */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-3 pb-6 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                          {/* Right side icons mockup */}
                          <div className="absolute right-1.5 bottom-8 flex flex-col items-center gap-3 text-white/90">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="w-6 h-6 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center scale-90">
                                <FaHeart className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[7px] font-bold">0</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="w-6 h-6 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center scale-90">
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" /></svg>
                              </div>
                              <span className="text-[7px] font-bold">0</span>
                            </div>
                          </div>

                          {/* Bottom info mockup */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full border border-white/40 overflow-hidden bg-slate-200 shadow-sm">
                                <img src={post.user?.avatar || "/assets/images/favio.png"} className="w-full h-full object-cover" alt="user" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-white text-[8px] font-black shadow-sm truncate max-w-[60px] tracking-tight">{post.user?.name || "user"}</span>
                              </div>
                              <button className="px-1.5 py-0.5 bg-rose-500 rounded-full text-[6px] font-black text-white ml-0.5 shadow-sm">Follow</button>
                            </div>
                            <p className="text-white text-[7px] font-medium line-clamp-2 max-w-[85%] drop-shadow-md leading-tight">
                              {text || post.caption || "Thinking of a catchy title..."}
                            </p>
                          </div>
                        </div>

                        {/* iOS Style Bottom Bar */}
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-16 h-[2px] bg-white/40 rounded-full" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={index}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        src={mediaList[index]?.url || "/assets/images/favio.png"}
                        className="w-full h-full object-contain"
                        alt={`slide-${index}`}
                      />
                    </AnimatePresence>
                    <div className="absolute top-4 right-4 flex gap-2">
                      {mediaList.length > 1 && mediaList[index]?.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const selected = mediaList[index];
                            if (!selected) return;
                            const others = mediaList.filter((_, i) => i !== index);
                            const newList = [selected, ...others];

                            setLocalMedia(newList);
                            setCoverId(selected.id);
                            setIndex(0);
                            toast.success("Selected as cover!");
                          }}
                          className={`px-2 py-1 backdrop-blur-md rounded text-[10px] items-center gap-1 font-black  flex border transition-all ${coverId === mediaList[index]?.id || (!coverId && index === 0) ? "bg-rose-500 text-white border-rose-500" : "bg-black/40 text-white border-white/20 hover:bg-black/60"}`}
                        >
                          <CheckIcon className="w-3 h-3" />
                          {coverId === mediaList[index]?.id || (!coverId && index === 0) ? "Cover" : "Set as cover"}
                        </button>
                      )}
                      <div className="px-2 py-1 bg-black/40 backdrop-blur-md rounded text-[10px] text-white font-black ">Image</div>
                    </div>

                    {mediaList.length > 1 && (
                      <>
                        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setIndex(i => Math.max(0, i - 1))}
                            className="w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-slate-900 pointer-events-auto active:scale-90 transition-all font-bold"
                          >
                            <ChevronLeftIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setIndex(i => Math.min(mediaList.length - 1, i + 1))}
                            className="w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-slate-900 pointer-events-auto active:scale-90 transition-all font-bold"
                          >
                            <ChevronRightIcon className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white shadow-lg">
                          {index + 1} / {mediaList.length}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-2 text-[10px] font-bold text-rose-500  text-center px-4">
                Media changes are restricted. You can only update details.
              </div>
            </div>

            {/* Editing Fields */}
            <div className="space-y-6">
              <div className="space-y-2">
                <DefaultInput
                  type="textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter title..."
                />
              </div>

              <div className="space-y-2">
                <DefaultInput
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Add more details..."
                />
              </div>

              <div className="pt-2">
                <label className="text-xs font-black text-slate-400  ml-1 block mb-2">Visibility</label>
                <button
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group"
                >
                  {privacy === "public" && <LockOpenIcon className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />}
                  {privacy === "private" && <LockClosedIcon className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />}
                  {privacy === "friends" && <UsersIcon className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />}
                  <span className="text-[10px] font-black   text-slate-500 group-hover:text-rose-500 ">
                    {privacy === "public" ? "Public" : privacy === "private" ? "Private" : "Friends Only"}
                  </span>
                </button>
              </div>

              {/* ── Linked Product ── */}
              {(Boolean(isBusiness) || Boolean((activeUser as any)?.business_id)) && (
                <div className="pt-2 space-y-3">
                  <label className="text-xs font-black text-slate-400 ml-1 block">Linked Product</label>

                  {/* Existing / selected product chip */}
                  <AnimatePresence>
                    {selectedProduct && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group/chip"
                      >
                        {/* Thumbnail */}
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-slate-200 flex-shrink-0">
                          <img
                            src={selectedProduct.image_url || selectedProduct.first_image || "/assets/images/favio.png"}
                            className="w-full h-full object-cover"
                            alt="linked product"
                            onError={(e) => { (e.target as HTMLImageElement).src = "/assets/images/favio.png"; }}
                          />
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-slate-400 tracking-widest leading-tight">Linked Product</p>
                          <p className="text-xs font-bold text-slate-900 truncate leading-tight mb-0.5">{selectedProduct.title}</p>
                          <p className="text-[10px] font-black text-rose-500 leading-none">
                            ₦{Number(selectedProduct.min_variant_price || selectedProduct.min_sku_price || selectedProduct.price || 0).toLocaleString()}
                          </p>
                        </div>
                        {/* Remove */}
                        <button
                          onClick={() => setSelectedProduct(null)}
                          className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"
                          title="Remove link"
                        >
                          <XMarkIcon className="w-4 h-4 text-slate-400" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Link / Change button */}
                  <button
                    onClick={() => setIsProductModalOpen(true)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all active:scale-95 text-xs font-bold ${selectedProduct
                      ? "bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100"
                      : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      }`}
                  >
                    <PlusIcon className={`w-3.5 h-3.5 ${selectedProduct ? "text-rose-500" : "text-slate-400"}`} />
                    {selectedProduct ? "Change Product" : "Link a Product"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white flex gap-3 pb-10 sm:pb-8">
          <button
            onClick={() => {
              setPreviewPost({
                ...post,
                caption: text,
                subtitle: subtitle,
                privacy: privacy,
                user: {
                  name: activeUser?.business_name || activeUser?.full_name || post.user?.name || "User",
                  avatar: activeUser?.profile_pic || post.user?.avatar || "",
                  id: activeUser?.user_id || post.user?.id
                },
                src: localMedia[0]?.url || post.src,
                allMedia: localMedia
              });
            }}
            className="p-3.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center shadow-sm"
            title="Preview Final Post"
          >
            <EyeIcon className="w-6 h-6" />
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="flex-1 py-3.5 rounded-full bg-rose-500 text-white font-black text-sm hover:bg-rose-500 shadow-xl shadow-rose-100 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
          >
            {loading ? "Updating..." : "Save Changes"}
          </button>
        </div>

        {/* Privacy Select Modal (Nested) */}
        <AnimatePresence>
          {isPrivacyModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPrivacyModalOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[50] rounded-[inherit]"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[60] p-6 space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black text-slate-400 ">Visibility</h3>
                  <button onClick={() => setIsPrivacyModalOpen(false)}>
                    <XMarkIcon className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {[
                  { id: "public", label: "Public", icon: LockOpenIcon },
                  { id: "private", label: "Private", icon: LockClosedIcon },
                  { id: "friends", label: "Visible to Friends only", icon: UsersIcon },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setPrivacy(opt.id as any);
                      setIsPrivacyModalOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${privacy === opt.id ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <opt.icon className="w-5 h-5" />
                      <span className="text-sm font-bold">{opt.label}</span>
                    </div>
                    {privacy === opt.id && <CheckIcon className="w-4 h-4" />}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Product Selector Modal */}
        <AnimatePresence>
          {isProductModalOpen && (
            <ProductSelectorModal
              onClose={() => setIsProductModalOpen(false)}
              onSelect={setSelectedProduct}
              selectedId={selectedProduct?.product_id || null}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {previewPost && (
            <PostModal
              open={!!previewPost}
              post={previewPost}
              onClose={() => setPreviewPost(null)}
              onToggleLike={() => { }}
              isPreview={true}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
