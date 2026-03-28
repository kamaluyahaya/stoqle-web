"use client";

import React, { useRef, useState, useEffect } from "react";
import { XMarkIcon, CameraIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

export default function CameraModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMounted = useRef(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setError(null);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (!isMounted.current) {
        newStream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = newStream;
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
        setError("Unable to access camera. Please check permissions.");
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    startCamera();
    
    return () => {
      isMounted.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const snap = () => {
    if (!videoRef.current) return;
    
    // Safety: Capture FIRST before stopping hardware
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Stop tracks IMMEDIATELY after capturing data to ensure light goes off fast
    if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `snap-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      }
    }, "image/jpeg", 0.9);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black flex flex-col items-center justify-center p-0 overflow-hidden" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-4 flex items-center justify-between text-white">
        <button onClick={onClose} className="p-2 rounded-full bg-black/40 backdrop-blur-md">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h3 className="text-sm font-bold tracking-tight">Camera</h3>
        <button onClick={toggleCamera} className="p-2 rounded-full bg-black/40 backdrop-blur-md">
          <ArrowPathIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Video Container */}
      <div className="relative w-full h-full flex flex-col justify-center bg-black overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-white space-y-4">
            <p className="text-red-400 font-medium">{error}</p>
            <button 
              onClick={startCamera}
              className="px-6 py-2 bg-white text-black rounded-full font-bold text-sm"
            >
              Try Again
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-transform duration-300 ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />
        )}
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] flex items-center justify-center bg-gradient-to-t from-black/80 to-transparent">
        {!error && (
            <button 
                onClick={snap}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-90 transition-transform"
                aria-label="Snap Photo"
            >
                <div className="w-16 h-16 rounded-full bg-white group-hover:scale-105 transition-transform" />
            </button>
        )}
      </div>
      
      {/* iOS style bar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full" />
    </div>
  );
}
