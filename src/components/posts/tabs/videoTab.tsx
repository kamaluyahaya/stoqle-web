"use client";

import React from "react";
import { VideoCameraIcon, FilmIcon, TrashIcon, PlayIcon, XMarkIcon, EyeIcon } from "@heroicons/react/24/outline";
import PostModal from "@/src/components/modal/postModal";
import { useAuth } from "@/src/context/authContext";
import { useState } from "react";

export default function VideoTab({
  video,
  setVideo,
  videoPreview,
  handleVideoChange,
  submitVideo,
  clearVideo,
}: {
  video: File | null;
  setVideo: (f: File | null) => void;
  videoPreview: string | null;
  handleVideoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  submitVideo: () => void;
  clearVideo: () => void;
}) {
  const [previewPost, setPreviewPost] = useState<any>(null);
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <div
          className={`relative group p-10 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-red-400 hover:bg-red-50/20 transition-all duration-500 ease-out cursor-pointer overflow-hidden flex-1 ${videoPreview ? "lg:max-w-md" : "w-full"
            }`}
        >
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            onChange={handleVideoChange}
            className="sr-only"
          />

          <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center justify-center text-center w-full h-full relative z-10">
            <div className="mb-4 relative">
              <div className="absolute inset-0 bg-red-500/10 blur-xl rounded-full scale-150 group-hover:bg-red-500/20 transition-all" />
              <div className="relative inline-flex items-center justify-center rounded-2xl h-16 w-16 bg-white shadow-xl shadow-slate-200/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <FilmIcon className="w-8 h-8 text-red-500" />
              </div>
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1">Video Studio</h3>
            <p className="text-sm text-slate-500 font-medium">Click to select or drag a video file here</p>

            <div className="mt-4 flex gap-3">
              <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">MP4 / MOV</span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">Up to 1GB</span>
            </div>
          </label>
        </div>

        {videoPreview && (
          <div className="relative group/vid rounded-[2rem] overflow-hidden bg-black shadow-2xl ring-4 ring-slate-100 flex-1">
            <video src={videoPreview} controls className="w-full aspect-video object-cover" />
            <button
              onClick={clearVideo}
              className="absolute top-4 right-4 h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white opacity-0 group-hover/vid:opacity-100 transition-all hover:bg-red-500 flex z-30"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setPreviewPost({
                  id: "preview-video",
                  src: videoPreview,
                  isVideo: true,
                  caption: "Video Preview",
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
              className="absolute top-4 left-4 h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white opacity-0 group-hover/vid:opacity-100 transition-all hover:bg-slate-900 flex z-30"
              title="Preview Mode"
            >
              <EyeIcon className="w-5 h-5" />
            </button>

            <div className="absolute bottom-4 left-4 px-4 py-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Selected Video</span>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          onClick={submitVideo}
          disabled={!video}
          className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-300 flex items-center justify-center gap-3
            ${!video
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              : "bg-red-500 text-white hover:bg-red-600 shadow-red-200 hover:scale-[1.02] active:scale-95"
            }
          `}
        >
          {!video ? "Choose Video to Continue" : "Publish Video"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-5 rounded-3xl bg-white border border-slate-100">
          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Resolution</div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">Recommended 720p or 1080p for best quality.</p>
        </div>
        <div className="p-5 rounded-3xl bg-white border border-slate-100">
          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Duration</div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">Up to 60 minutes supported for long-form content.</p>
        </div>
      </div>

      {previewPost && (
        <PostModal
          post={previewPost}
          onClose={() => setPreviewPost(null)}
          onToggleLike={() => {}}
          isPreview={true}
        />
      )}
    </div>
  );
}
