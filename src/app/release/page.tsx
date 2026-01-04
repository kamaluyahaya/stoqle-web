"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import CreateNoteModal from "@/src/components/notes/createNoteModal";
import { SubmitPayload } from "@/src/components/posts/types";
import NoteTab from "@/src/components/posts/tabs/noteTab";
import ImagesTab from "@/src/components/posts/tabs/imagesTab";
import VideoTab from "@/src/components/posts/tabs/videoTab";

export default function PostComposerTabs({
  onSubmit,
  initialTab = 0,
}: {
  onSubmit?: (payload: SubmitPayload) => void;
  initialTab?: number;
}) {
  const tabs = ["Write note", "Upload image", "Upload video"] as const;
  const [active, setActive] = useState<number>(initialTab);

  // note
  const [noteText, setNoteText] = useState("");

  // images
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // modal for image preview + metadata
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // video
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // create note modal
  const [createNoteOpen, setCreateNoteOpen] = useState(false);

  // keyboard navigation (tabs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActive((s) => Math.min(s + 1, tabs.length - 1));
      if (e.key === "ArrowLeft") setActive((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs.length]);

  // image previews (createObjectURL + revoke on cleanup)
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  // video preview
  useEffect(() => {
    if (!video) {
      setVideoPreview(null);
      return;
    }
    const u = URL.createObjectURL(video);
    setVideoPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [video]);

  // image input handler with validations and 5-image limit
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files ? Array.from(e.target.files) : [];
    if (incoming.length === 0) return;

    // enforce max 5 images total
    const remaining = 5 - images.length;
    const allowed = incoming.slice(0, remaining);
    if (allowed.length < incoming.length) {
      // simple feedback — replace with a toast in your app
      alert("Maximum 5 images allowed — extra files were ignored.");
    }

    const validated: File[] = [];
    for (const f of allowed) {
      if (!f.type.startsWith("image/")) {
        alert(`${f.name} is not an image and was skipped.`);
        continue;
      }
      if (f.size > 32 * 1024 * 1024) {
        alert(`${f.name} is larger than 32MB and was skipped.`);
        continue;
      }
      validated.push(f);
    }

    if (validated.length === 0) {
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    setImages((prev) => [...prev, ...validated]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImageAt = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (!f) return;
    // optional: validate video size/type here
    setVideo(f);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const clearAll = () => {
    setNoteText("");
    setImages([]);
    setVideo(null);
  };

  // Submit handlers for note and video (images are handled via modal)
  const submitNote = () => {
    const payload: SubmitPayload = { type: "note", text: noteText };
    onSubmit?.(payload);
    setNoteText("");
  };

  const submitVideo = () => {
    const payload: SubmitPayload = { type: "video", video };
    onSubmit?.(payload);
    setVideo(null);
  };

  // When user clicks "Post images" inside ImagesTab we open modal instead of posting directly
  const openImageModal = () => {
    if (images.length === 0) {
      alert("Please select at least one image.");
      return;
    }
    setIsImageModalOpen(true);
  };

  // swipe handling for mobile
  const startX = useRef<number | null>(null);
  const endX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (startX.current = e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => (endX.current = e.touches[0].clientX);
  const onTouchEnd = () => {
    if (startX.current == null || endX.current == null) return;
    const d = startX.current - endX.current;
    const threshold = 40;
    if (d > threshold) setActive((s) => Math.min(s + 1, tabs.length - 1));
    else if (d < -threshold) setActive((s) => Math.max(0, s - 1));
    startX.current = null;
    endX.current = null;
  };

  return (
    <div className="mx-auto bg-white rounded-xl p-4 mt-5 border border-slate-200 shadow">
      {/* Tabs */}
      <div className="relative border-b border-slate-200">
        <div className="flex gap-2 bg-white rounded-lg p-1 ">
          {tabs.map((t, i) => {
            const isActive = i === active;
            return (
              <button
                key={t}
                onClick={() => setActive(i)}
                className={`relative px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap focus:outline-none
                  ${isActive ? "text-red-500" : "text-slate-700 hover:text-slate-900"}
                `}
                aria-pressed={isActive}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeTabUnderline"
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-1 w-20 bg-red-500 rounded-full"
                  />
                )}
                <span>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panes */}
      <div
        className="mt-4 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform ease-in-out"
          style={{ width: `${tabs.length * 100}%`, transform: `translateX(-${active * (100 / tabs.length)}%)` }}
        >
          <div style={{ width: `${100 / tabs.length}%` }} className="p-4">
            <NoteTab
              noteText={noteText}
              setNoteText={setNoteText}
              openCreateModal={() => setCreateNoteOpen(true)}
              submitNote={submitNote}
            />
          </div>

          <div style={{ width: `${100 / tabs.length}%` }} className="p-3">
            <ImagesTab
              images={images}
              setImages={setImages}
              imagePreviews={imagePreviews}
              handleImageChange={handleImageChange}
              removeImageAt={removeImageAt}
              // open modal instead of immediate submit
              submitImages={openImageModal}
              clearImages={() => setImages([])}
            />
            {/* hidden ref input pointer in case a child needs it */}
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" />
          </div>

          <div style={{ width: `${100 / tabs.length}%` }} className="p-3">
            <VideoTab
              video={video}
              setVideo={setVideo}
              videoPreview={videoPreview}
              handleVideoChange={handleVideoChange}
              submitVideo={submitVideo}
              clearVideo={() => setVideo(null)}
            />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" />
          </div>
        </div>
      </div>

      <CreateNoteModal
        open={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
        onCreated={(newPost) => {
          setCreateNoteOpen(false);
          // optional optimistic update could go here
        }}
      />

      {/* Image preview + metadata modal (inlined so you can drop this file in) */}
      {isImageModalOpen && (
        <ImagePreviewModal
          imageFiles={images}
          imagePreviews={imagePreviews}
          onClose={() => setIsImageModalOpen(false)}
          onPosted={() => {
            setIsImageModalOpen(false);
            setImages([]);
          }}
          onSubmitPayload={(payload) => {
            // pass full payload to parent. cast to keep types flexible
            onSubmit?.((payload as unknown) as SubmitPayload);
          }}
        />
      )}
    </div>
  );
}

/* ----------------------
   ImagePreviewModal
   - Step 0: slide through images
   - Step 1: add text / subtitle / privacy and POST (calls onSubmitPayload)
   ---------------------- */

function ImagePreviewModal({
  imageFiles,
  imagePreviews,
  onClose,
  onPosted,
  onSubmitPayload,
}: {
  imageFiles: File[];
  imagePreviews: string[];
  onClose: () => void;
  onPosted: () => void;
  onSubmitPayload: (payload: {
    type: "images";
    images: File[];
    text?: string;
    subtitle?: string;
    privacy?: "public" | "private";
  }) => void;
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
      // Build payload for parent handler. Parent can choose to upload with FormData or process differently.
      const payload = {
        type: "images" as const,
        images: imageFiles,
        text: text || undefined,
        subtitle: subtitle || undefined,
        privacy,
      };

      // Call parent onSubmit handler (which receives SubmitPayload)
      onSubmitPayload(payload);

      // call posted callback so composer can clear images
      onPosted();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 ">
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
