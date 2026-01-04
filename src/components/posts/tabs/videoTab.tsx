"use client";

import React from "react";

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
  return (
    <>
      <div className="rounded-lg border border-dashed border-slate-200 p-4">
        <input id="video-upload" type="file" accept="video/*" onChange={handleVideoChange} className="sr-only" />

        <label htmlFor="video-upload" className="cursor-pointer block text-center py-6">
          <div className="mx-auto inline-flex items-center justify-center rounded-full h-12 w-12 bg-slate-50">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M22 7L13 12 22 17V7z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 6.5v11a1 1 0 001 1h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-sm font-medium text-slate-600 mt-2">Click to select a video</div>
          <div className="text-xs text-slate-400 mt-1">MP4, WebM, MOV — single file</div>
        </label>

        {videoPreview && (
          <div className="mt-3">
            <video src={videoPreview} controls className="w-full rounded-lg max-h-[320px] object-cover" />
          </div>
        )}

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm space-y-3">
          <div>
            <h4 className="text-sm font-semibold">Video size</h4>
            <p className="text-xs text-slate-600">Supports durations up to 60 minutes. Maximum 20GB video file.</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Video format</h4>
            <p className="text-xs text-slate-600">Supports common video formats. We recommend using mp4 and mov files.</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Video resolution</h4>
            <p className="text-xs text-slate-600">
              We recommend uploading videos in 720P (1280×720) resolution or higher. Videos exceeding 1080P will have clearer
              image quality when uploaded via a web browser.
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={clearVideo} className="rounded-full px-3 py-1 text-sm bg-slate-50">
            Clear
          </button>
          <button
            onClick={submitVideo}
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 active:scale-95"
          >
            Post video
          </button>
        </div>
      </div>
    </>
  );
}
