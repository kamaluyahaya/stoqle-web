"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import CreateNoteModal from "@/src/components/notes/createNoteModal";
import { SubmitPayload } from "@/src/components/posts/types";
import NoteTab from "@/src/components/posts/tabs/noteTab";
import ImagesTab from "@/src/components/posts/tabs/imagesTab";
import VideoTab from "@/src/components/posts/tabs/videoTab";
import { useAuth } from "@/src/context/authContext";
import { createSocialPost } from "@/src/lib/api/social";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, GlobeAmericasIcon, LockClosedIcon, PhotoIcon, VideoCameraIcon, PencilSquareIcon, TrashIcon, CheckIcon, EyeIcon, LockOpenIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import PostModal from "@/src/components/modal/postModal";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import DefaultInput from "@/src/components/input/default-input-post";
import { getCurrentLocationName, getCachedLocationName } from "@/src/lib/location";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export default function PostComposerTabs({
  onSubmit,
  initialTab = 0,
}: {
  onSubmit?: (payload: SubmitPayload) => void;
  initialTab?: number;
}) {
  const tabs = ["Text", "Choose image", "Video"] as const;
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
  const [videoThumbnail, setVideoThumbnail] = useState<Blob | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const auth = useAuth();
  const { token, user } = auth;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmingProgress, setTrimmingProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  
  const ffmpegRef = useRef<any>(null);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

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

    // We'll accept all videos, but we'll inform the user if it's longer than 3 minutes
    // and the preview/published post will only play/show the first 3 minutes.
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    const objectUrl = URL.createObjectURL(f);

    tempVideo.onloadedmetadata = () => {
      // Step 1: Seek to 2 seconds for a good frame (thumbnail)
      tempVideo.currentTime = 2;
    };

    let thumbnailCaptured = false;
    tempVideo.onseeked = () => {
      if (thumbnailCaptured) return;
      thumbnailCaptured = true;

      // Extract frame
      const canvas = document.createElement("canvas");
      canvas.width = tempVideo.videoWidth;
      canvas.height = tempVideo.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) setVideoThumbnail(blob);
        }, "image/jpeg", 0.82);
      }

      const duration = tempVideo.duration;
      if (duration > 60) { // 1 minute = 60 seconds
        setIsTrimming(true);
        setTrimmingProgress(10); // Start progress
        
        const processVideo = async () => {
          try {
            const ffmpeg = await loadFFmpeg();
            setTrimmingProgress(30);
            
            const inputName = 'input.mp4';
            const outputName = 'output.mp4';
            
            await ffmpeg.writeFile(inputName, await fetchFile(f));
            setTrimmingProgress(50);
            
            // Perform lossless cut: first 60 seconds
            await ffmpeg.exec(['-i', inputName, '-t', '60', '-c', 'copy', outputName]);
            setTrimmingProgress(80);
            
            const data = await ffmpeg.readFile(outputName);
            const trimmedBlob = new Blob([(data as any).buffer], { type: 'video/mp4' });
            const trimmedFile = new File([trimmedBlob], "trimmed_reel.mp4", { type: 'video/mp4' });
            
            setVideo(trimmedFile);
            setTrimmingProgress(100);
            toast.success("Reel optimized and cut to 1 min!");
            
            // Cleanup
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
          } catch (err) {
            console.error("FFmpeg error:", err);
            toast.error("Failed to slice video instantly. Falling back...");
            // Non-destructive fallback (keep original or use old recorder)
            setVideo(f);
          } finally {
            setIsTrimming(false);
            URL.revokeObjectURL(objectUrl);
          }
        };

        processVideo();
      } else {
        setVideo(f);
        URL.revokeObjectURL(objectUrl);
      }
      
      if (videoInputRef.current) videoInputRef.current.value = "";
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Failed to process video file.");
    };

    tempVideo.src = objectUrl;
  };

  const clearAll = () => {
    setNoteText("");
    setImages([]);
    setVideo(null);
    setVideoThumbnail(null);
  };

  // Submit handlers
  const handlePostSubmit = async (payload: SubmitPayload) => {
    const ok = await auth.ensureAccountVerified();
    if (!ok) return;

    setLoading(true);
    try {
      // Capture current location for the post
      const freshLocation = await getCurrentLocationName();
      const location = freshLocation || getCachedLocationName();

      const formData = new FormData();
      if (location) formData.append('location', location);
      if (payload.type === 'note') {
        formData.append('text', payload.text || '');
        formData.append('cover_type', 'note');
      } else if (payload.type === 'images') {
        formData.append('text', payload.text || '');
        formData.append('subtitle', (payload as any).subtitle || '');
        formData.append('privacy', (payload as any).privacy || 'public');
        if (payload.images) {
          payload.images.forEach((file) => {
            formData.append('images', file);
          });
        }
      } else if (payload.type === 'video') {
        if (payload.video) formData.append('images', payload.video);
        if (videoThumbnail) formData.append('images', videoThumbnail, 'thumbnail.jpg');
        
        formData.append('text', payload.text || '');
        formData.append('subtitle', (payload as any).subtitle || '');
        formData.append('privacy', (payload as any).privacy || 'public');
        formData.append('cover_type', 'video');
      }

      await createSocialPost(formData, token!, (progress) => {
        setUploadProgress(progress);
      });
      toast.success("Post created successfully!");
      clearAll();
      router.push("/discover");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create post");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const submitNote = () => handlePostSubmit({ type: "note", text: noteText });
  const openVideoModal = () => {
    if (!video) {
      alert("Please select a video.");
      return;
    }
    setIsVideoModalOpen(true);
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
    <div className="min-h-screen px-4 py-4 bg-slate-200">
      <div className="bg-white  border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Share your experience</h1>
        </div>

        {/* Custom Tabs */}
        <div className="px-6">
          <div className="flex bg-slate-100/80  gap-1">
            {tabs.map((t, i) => {
              const isActive = i === active;
              const Icon = i === 1 ? PhotoIcon : i === 2 ? VideoCameraIcon : PencilSquareIcon;
              return (
                <button
                  key={t}
                  onClick={() => setActive(i)}
                  className={`flex-1 relative flex items-center justify-center gap-2 py-3  text-sm font-bold transition-all duration-300
                    ${isActive ? "text-red-500 bg-white ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"}
                  `}
                >
                  {/* <Icon className={`w-4 h-4 ${isActive ? "text-red-500" : "text-slate-400"}`} /> */}
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pane Content with Animation */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {active === 0 && (
                <NoteTab
                  noteText={noteText}
                  setNoteText={setNoteText}
                  openCreateModal={() => setCreateNoteOpen(true)}
                  submitNote={submitNote}
                />
              )}
              {active === 1 && (
                <ImagesTab
                  images={images}
                  setImages={setImages}
                  imagePreviews={imagePreviews}
                  handleImageChange={handleImageChange}
                  removeImageAt={removeImageAt}
                  submitImages={openImageModal}
                  clearImages={() => setImages([])}
                />
              )}
              {active === 2 && (
                <VideoTab
                  video={video}
                  setVideo={setVideo}
                  videoPreview={videoPreview}
                  handleVideoChange={handleVideoChange}
                  submitVideo={openVideoModal}
                  clearVideo={() => setVideo(null)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <CreateNoteModal
        open={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
        onCreated={(newPost) => {
          setCreateNoteOpen(false);
          toast.success("Note created!");
          router.push("/profile?tab=Notes");
        }}
      />

      {isImageModalOpen && (
        <ImagePreviewModal
          imageFiles={images}
          imagePreviews={imagePreviews}
          onClose={() => setIsImageModalOpen(false)}
          onPosted={() => {
            setIsImageModalOpen(false);
            setImages([]);
          }}
          removeImageAt={removeImageAt}
          setImages={setImages}
          isLoading={loading}
          uploadProgress={uploadProgress}
          onSubmitPayload={(payload) => {
            handlePostSubmit(payload as any);
          }}
        />
      )}

      {isVideoModalOpen && videoPreview && (
        <VideoPreviewModal
          video={video!}
          videoPreview={videoPreview}
          onClose={() => setIsVideoModalOpen(false)}
          onPosted={() => {
            setIsVideoModalOpen(false);
            setVideo(null);
          }}
          isLoading={loading}
          uploadProgress={uploadProgress}
          onSubmitPayload={(payload) => {
            handlePostSubmit(payload as any);
          }}
        />
      )}

      {/* Trimming Overlay */}
      {isTrimming && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center overscroll-none">
          <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-t-red-500"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-white">
              {Math.min(99, Math.round(trimmingProgress))}%
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-3">Optimizing Your Reel</h2>
          <p className="text-slate-400 max-w-sm leading-relaxed text-sm">
            We're trimming your video to the first 1 minute to keep your followers engaged. 
            Please stay on this page.
          </p>

          <div className="mt-10 w-full max-w-xs h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" 
              initial={{ width: 0 }}
              animate={{ width: `${trimmingProgress}%` }}
              transition={{ type: "spring", damping: 25, stiffness: 50 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------
   VideoPreviewModal
   ---------------------- */

function VideoPreviewModal({
  video,
  videoPreview,
  onClose,
  onPosted,
  onSubmitPayload,
  isLoading = false,
  uploadProgress = 0,
}: {
  video: File;
  videoPreview: string;
  onClose: () => void;
  onPosted: () => void;
  isLoading?: boolean;
  uploadProgress?: number;
  onSubmitPayload: (payload: {
    type: "video";
    video: File;
    text?: string;
    subtitle?: string;
    privacy?: "public" | "private" | "friends";
  }) => void;
}) {
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "friends">("public");
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

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
      const maxD = 180;
      const current = videoRef.current.currentTime;

      if (current >= maxD) {
        videoRef.current.currentTime = 0;
        setProgress(0);
      } else {
        const duration = Math.min(videoRef.current.duration, maxD);
        if (duration > 0) {
          setProgress((current / duration) * 100);
        }
      }
    }
  };

  const submit = async () => {
    onSubmitPayload({
      type: "video",
      video,
      text: text || undefined,
      subtitle: subtitle || undefined,
      privacy,
    });
  };

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
          <h2 className="text-sm font-bold text-slate-900 absolute left-1/2 -translate-x-1/2  ">Video Post</h2>
          <div className="w-10 flex justify-end">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 p-4">
          {/* Video Preview with Phone Decoration */}
          <div className="flex justify-center py-4 bg-slate-50 rounded-2xl">
            <div className="relative w-[240px] h-[480px] bg-slate-900 rounded-[3rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden group">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-2xl z-20" />

              {/* Video Content */}
              <div
                className="w-full h-full cursor-pointer relative"
                onClick={togglePlay}
              >
                <video
                  ref={videoRef}
                  src={videoPreview}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                />

                {/* Progress Bar */}
                <div className="absolute bottom-[2px] left-0 w-full h-[1.5px] bg-white/20 z-30">
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
                      className="absolute inset-0 flex items-center justify-center bg-black/20"
                    >
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                        <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Social Overlays */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4 pb-8 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                  {/* Right side icons */}
                  <div className="absolute right-2 bottom-12 flex flex-col items-center gap-4 text-white">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                      </div>
                      <span className="text-[8px] font-bold">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" /></svg>
                      </div>
                      <span className="text-[8px] font-bold">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" /></svg>
                      </div>
                      <span className="text-[8px] font-bold">0</span>
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-white overflow-hidden bg-slate-200">
                        {user?.profile_pic ? (
                          <img src={user.profile_pic} className="w-full h-full object-cover" alt="user" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-red-500 text-white font-bold text-[8px]">
                            {user?.full_name?.[0] || 'S'}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white text-[9px] font-black shadow-sm truncate max-w-[80px]">{user?.business_name || user?.full_name || user?.username || 'user'}</span>
                      </div>
                      <button className="px-2 py-0.5 bg-red-500 rounded-full text-[7px] font-black text-white ml-1">Follow</button>
                    </div>
                    <p className="text-white text-[8px] font-medium line-clamp-2 max-w-[80%] drop-shadow-md">
                      {text || 'Thinking of a catchy title...'}
                    </p>
                  </div>
                </div>

                {/* iOS Style Bottom Bar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/50 rounded-full" />
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <DefaultInput
              type="textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add title"
            />

            <DefaultInput
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Add captions (optional)"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group"
            >
              {privacy === "public" && <LockOpenIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
              {privacy === "private" && <LockClosedIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
              {privacy === "friends" && <UsersIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
              <span className="text-[10px] font-bold   text-slate-500 group-hover:text-red-600">
                {privacy === "public" ? "Public" : privacy === "private" ? "Private" : "Friends Only"}
              </span>
            </button>
          </div>
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
                  <h3 className="text-xs font-bold   text-slate-400">Visibility</h3>
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
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${privacy === opt.id ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
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

        {/* Upload Progress Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - uploadProgress / 100)}
                    strokeLinecap="round"
                    className="text-red-500 transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-slate-900">
                  {uploadProgress}%
                </div>
              </div>
              <p className="text-sm font-bold text-slate-400   animate-pulse">Uploading Video</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 flex gap-3 pb-10 sm:pb-6 mt-auto border-t border-slate-100">
          <button
            onClick={() => {
              setPreviewPost({
                id: "preview-final-video",
                src: videoPreview,
                isVideo: true,
                caption: text || "Video Preview",
                user: {
                  name: user?.full_name || user?.name || "Guest User",
                  avatar: user?.profile_pic || user?.avatar || "https://via.placeholder.com/150",
                  id: user?.user_id || user?.id || 0
                },
                liked: false,
                likeCount: 0,
                rawCreatedAt: new Date().toISOString()
              });
            }}
            className="p-3 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center"
            title="Preview Post"
          >
            <EyeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={submit}
            disabled={isLoading}
            className="flex-1 py-3 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? "Publishing..." : "Publish Post"}
          </button>
        </div>

        {previewPost && (
          <PostModal
            post={previewPost}
            onClose={() => setPreviewPost(null)}
            onToggleLike={() => { }}
            isPreview={true}
          />
        )}
      </motion.div>
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
  removeImageAt,
  setImages,
  isLoading = false,
  uploadProgress = 0,
}: {
  imageFiles: File[];
  imagePreviews: string[];
  onClose: () => void;
  onPosted: () => void;
  removeImageAt: (idx: number) => void;
  setImages: (images: File[]) => void;
  isLoading?: boolean;
  uploadProgress?: number;
  onSubmitPayload: (payload: {
    type: "images";
    images: File[];
    text?: string;
    subtitle?: string;
    privacy?: "public" | "private" | "friends";
  }) => void;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "friends">("public");
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const { user } = useAuth();

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  // Close modal if all images are removed
  useEffect(() => {
    if (imagePreviews.length === 0) onClose();
    if (index >= imagePreviews.length) setIndex(Math.max(0, imagePreviews.length - 1));
  }, [imagePreviews.length, index, onClose]);

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
    onSubmitPayload({
      type: "images",
      images: imageFiles,
      text: text || undefined,
      subtitle: subtitle || undefined,
      privacy,
    });
  };

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
        <div className="px-4 py-3 flex items-center justify-between relative">
          <div className="w-10">
            {step === 1 && (
              <button onClick={() => setStep(0)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                <ChevronLeftIcon className="w-6 h-6 text-slate-900" />
              </button>
            )}
          </div>
          <div className="w-10">
            {step === 0 && (
              <h2 className="text-sm text-slate-900 absolute left-1/2 -translate-x-1/2">Post Preview</h2>
            )}
          </div>

          <div className="w-10 flex justify-end">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {step === 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 flex flex-col justify-center min-h-0">
                <div className="relative group">
                  <div className="w-full aspect-square overflow-hidden bg-slate-50 border border-slate-100 shadow-inner">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={index}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(e, info) => {
                          const swipeThreshold = 30;
                          const velocityThreshold = 400;
                          if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                            setIndex((i) => Math.min(i + 1, imagePreviews.length - 1));
                          } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                            setIndex((i) => Math.max(i - 1, 0));
                          }
                        }}
                        src={imagePreviews[index]}
                        style={{ touchAction: "none" }}
                        draggable={false}
                        whileTap={{ scale: 0.98 }}
                        className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
                        alt={`slide-${index}`}
                      />
                    </AnimatePresence>
                  </div>

                  {/* Navigation Overlay */}
                  <div className="absolute p-6 inset-y-0 left-0 right-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <button
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                      disabled={index === 0}
                      className="w-10 h-10 rounded-full bg-white/90 shadow-xl backdrop-blur-md flex items-center justify-center disabled:opacity-30 disabled:scale-95 transition-all text-slate-900 pointer-events-auto"
                    >
                      <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setIndex((i) => Math.min(imagePreviews.length - 1, i + 1))}
                      disabled={index === imagePreviews.length - 1}
                      className="w-10 h-10 rounded-full bg-white/90 shadow-xl backdrop-blur-md flex items-center justify-center disabled:opacity-30 disabled:scale-95 transition-all text-slate-900 pointer-events-auto"
                    >
                      <ChevronRightIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Counter Badge */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white   shadow-lg">
                    {index + 1} / {imagePreviews.length}
                  </div>
                </div>
              </div>

              <div className="space-y-6 mt-auto pb-10 sm:pb-6 p-6">
                {/* Thumbnail Strip */}
                <div className="flex gap-1 overflow-x-auto py-2 no-scrollbar px-1">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative flex-shrink-0 py-2">
                      <button
                        onClick={() => setIndex(i)}
                        className={`relative w-16 h-16 rounded-lg overflow-hidden transition-all duration-300 ${index === i
                          ? "ring-2 ring-red-500 ring-offset-2 scale-105 opacity-100"
                          : "opacity-40 hover:opacity-70"
                          }`}
                      >
                        <img src={src} className="w-full h-full object-cover" alt={`thumb-${i}`} />
                        {i === 0 && (
                          <div className="absolute top-1 left-1 px-1 rounded-md bg-red-500 text-[6px] text-white font-bold">Cover</div>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImageAt(i);
                        }}
                        className="absolute -top-1 -right-1 h-6 w-6 bg-black/40 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-white hover:bg-red-500 transition-all ring-1 ring-white/20 z-10"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => setStep(1)}
                    className="w-full py-3 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 shadow-red-200 active:scale-95 transition-all"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full p-4">
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                {/* Horizontal Image Series with Remove Icons */}
                <div className="space-y-3">
                  <div className="flex gap-1 overflow-x-auto pb-4 no-scrollbar">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative flex-shrink-0 p-2 mt-5">
                        <div
                          onClick={() => {
                            setLightboxIndex(i);
                            setLightboxOpen(true);
                          }}
                          className={`w-18 h-18 rounded-xl overflow-hidden cursor-pointer transition-all ${index === i ? "ring-2 ring-red-500 scale-105" : "opacity-80 hover:opacity-100"
                            }`}
                        >
                          <img src={src} className="w-full h-full object-cover" alt={`final-thumb-${i}`} />
                          {i === 0 && (
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-red-500 text-[6px] text-white font-bold ">Cover</div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImageAt(i);
                          }}
                          className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-black/40 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-white hover:bg-red-500 transition-all ring-1 ring-white/20 text-[10px] font-bold"
                        >
                          {i + 1}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <DefaultInput
                    type="textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Add title"
                  />

                  <DefaultInput
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Add a catchy subtitle (optional)"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group"
                  >
                    {privacy === "public" && <LockOpenIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
                    {privacy === "private" && <LockClosedIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
                    {privacy === "friends" && <UsersIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
                    <span className="text-[10px] font-bold   text-slate-500 group-hover:text-red-600">
                      {privacy === "public" ? "Public" : privacy === "private" ? "Private" : "Friends Only"}
                    </span>
                  </button>
                </div>
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
                        <h3 className="text-xs font-bold   text-slate-400">Visibility</h3>
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
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${privacy === opt.id ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
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

              {/* Upload Progress Overlay */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4"
                  >
                    <div className="relative w-24 h-24">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-slate-100"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 40}
                          strokeDashoffset={2 * Math.PI * 40 * (1 - uploadProgress / 100)}
                          strokeLinecap="round"
                          className="text-red-500 transition-all duration-300"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-slate-900">
                        {uploadProgress}%
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-400   animate-pulse">Uploading Post</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-6 flex gap-3 pb-10 sm:pb-6 mt-auto">
                <button
                  onClick={() => {
                    setPreviewPost({
                      id: "preview-final",
                      src: imagePreviews[index],
                      allMedia: imagePreviews,
                      isVideo: false,
                      caption: text || "Post Preview",
                      user: {
                        name: user?.full_name || user?.name || "Guest User",
                        avatar: user?.profile_pic || user?.avatar || "https://via.placeholder.com/150",
                        id: user?.user_id || user?.id || 0
                      },
                      liked: false,
                      likeCount: 0,
                      rawCreatedAt: new Date().toISOString()
                    });
                  }}
                  className="p-3 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center"
                  title="Preview Post"
                >
                  <EyeIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={submit}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 shadow-xl shadow-red-200 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? "Uploading..." : "Publish Post"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        on={{ view: ({ index }) => setLightboxIndex(index) }}
        slides={imagePreviews.map(src => ({ src }))}
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
                  const newImages = [...imageFiles];
                  const [img] = newImages.splice(lightboxIndex, 1);
                  newImages.unshift(img);
                  setImages(newImages);
                  setLightboxIndex(0);
                  toast.success("Set✅");
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-[10px] font-bold   transition-all flex items-center gap-2 border border-white/20"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                Set as cover
              </button>
            </div>
          ),
          slideFooter: () => (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[30001]">
              <button
                onClick={() => {
                  removeImageAt(lightboxIndex);
                  if (imagePreviews.length <= 1) {
                    setLightboxOpen(false);
                  }
                }}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500 transition-all backdrop-blur-md rounded-full text-red-500 hover:text-white text-[10px] font-bold   flex items-center gap-3 border border-red-500/30"
              >
                <TrashIcon className="w-4 h-4" />
                Delete Image
              </button>
            </div>
          )
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

    </div>
  );
}
