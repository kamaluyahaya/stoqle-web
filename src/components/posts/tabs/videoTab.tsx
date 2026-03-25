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
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

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

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center">
          {!videoPreview ? (
            <div
              className="relative group p-10 rounded-[0.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-red-400 hover:bg-red-50/20 transition-all duration-500 ease-out cursor-pointer overflow-hidden w-full h-[400px]"
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
                  <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">Max 3 Mins</span>
                </div>
              </label>
            </div>
          ) : (
            <div className="relative group/vid w-full flex flex-col items-center justify-center py-4  ">
              {/* Phone Frame */}
              <div className="relative w-[220px] h-[440px] bg-slate-900 rounded-[2.2rem] border-[6px] border-slate-900 shadow-2xl overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-xl z-20" />

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
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white scale-110">
                        <PlayIcon className="w-6 h-6 fill-current" />
                      </div>
                    </div>
                  )}

                  {/* Social Overlays */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-3 pb-6 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                    {/* Right side icons */}
                    <div className="absolute right-1 bottom-10 flex flex-col items-center gap-3 text-white">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                        </div>
                        <span className="text-[7px] font-bold">0</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" /></svg>
                        </div>
                        <span className="text-[7px] font-bold">0</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" /></svg>
                        </div>
                        <span className="text-[7px] font-bold">0</span>
                      </div>
                    </div>

                    {/* Bottom info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-full border border-white flex-shrink-0 overflow-hidden bg-slate-200">
                          {user?.profile_pic ? (
                            <img src={user.profile_pic} className="w-full h-full object-cover" alt="user" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-red-500 text-white font-bold text-[8px]">
                              {user?.full_name?.[0] || 'S'}
                            </div>
                          )}
                        </div>
                        <span className="text-white text-[8px] font-black shadow-sm truncate max-w-[70px] flex-shrink-0">{user?.business_name || user?.full_name || user?.username || 'user'}</span>
                        <button className="px-2 py-0.5 bg-red-500 rounded-full text-[7px] font-black text-white ml-1 flex-shrink-0">Follow</button>
                      </div>
                    </div>
                  </div>

                  {/* iOS Style Bottom Bar */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/40 rounded-full" />
                </div>
              </div>

              {/* Quick Actions overlayed on the side or top */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={clearVideo}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-white shadow-lg border border-slate-100 text-slate-500 hover:text-red-500 hover:scale-110 transition-all active:scale-95"
                  title="Remove video"
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
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-white shadow-lg border border-slate-100 text-slate-500 hover:text-red-600 hover:scale-110 transition-all active:scale-95"
                  title="Preview"
                >
                  <EyeIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                <input
                  id="change-video-upload"
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="sr-only"
                />
                <label
                  htmlFor="change-video-upload"
                  className="cursor-pointer px-5 py-2 rounded-full bg-slate-700 shadow-xl text-[10px] font-black text-white  hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
                >
                  <VideoCameraIcon className="w-3.5 h-3.5" />
                  Change video
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="">
        <button
          onClick={submitVideo}
          disabled={!video}
          className={`w-full py-2 rounded-full text-sm transition-all duration-300 flex items-center justify-center gap-3
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
          <p className="text-xs text-slate-500 font-medium leading-relaxed">Maximum 3 minutes for high-impact reels.</p>
        </div>
      </div>

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
