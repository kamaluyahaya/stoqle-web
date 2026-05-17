"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, BoltIcon, PhotoIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';

export default function ScanPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  // Store the raw MediaStream so we can kill it synchronously
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Synchronous "nuclear" camera kill.
   * Works WITHOUT any library calls or promises — this is safe to call
   * inside a useEffect cleanup (which must be synchronous).
   */
  const nukeCamera = () => {
    // 1. Stop the captured stream directly
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) { /* ignore */ }
      });
      mediaStreamRef.current = null;
    }

    // 2. Defensive fallback — stop tracks on ANY video element on the page
    // but don't remove elements or clear srcObject yet to avoid library crash
    document.querySelectorAll('video').forEach(videoEl => {
      const v = videoEl as HTMLVideoElement;
      const stream = v.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach(t => {
          try {
            t.stop();
            t.enabled = false;
          } catch (e) { /* ignore */ }
        });
      }
    });
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.floor(minEdge * 0.7);
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
          },
          onScanSuccess,
          undefined
        );

        // Capture the live MediaStream RIGHT after start() resolves.
        // This is the key — we own this reference and can kill it synchronously later.
        const videoEl = document.querySelector('#reader video') as HTMLVideoElement | null;
        if (videoEl?.srcObject) {
          mediaStreamRef.current = videoEl.srcObject as MediaStream;
        }

        setCameraReady(true);
      } catch (err) {
        console.error("Unable to start scanner", err);
        toast.error("Unable to access camera");
      }
    };

    startScanner();

    return () => {
      // fire-and-forget: let the library clean up its own DOM first
      if (html5QrCode) {
        const cleanup = () => { try { html5QrCode?.clear(); } catch (_) { } };
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(cleanup).catch(cleanup);
        } else {
          cleanup();
        }
      }

      // SYNCHRONOUS: kill the camera tracks immediately.
      // We do this AFTER triggering the library stop to minimize conflicts.
      nukeCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = async () => {
    // 1. Kill the stream synchronously first
    nukeCamera();
    setCameraReady(false);

    // 2. Also run library teardown (cleanup DOM it created)
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (_) {
        // Already killed above — swallow errors
      }
    }
  };

  const handleBack = async () => {
    setIsProcessing(true);
    await stopScanner();
    router.back();
  };

  const onScanSuccess = (decodedText: string) => {
    if (isProcessing) return;
    handleResult(decodedText);
  };

  const handleResult = async (code: string) => {
    setIsProcessing(true);
    // Kill camera immediately on detection so the indicator goes away
    await stopScanner();

    try {
      let slug = "";
      if (code.includes('/')) {
        const parts = code.split('/');
        slug = parts.pop()?.split('?')[0] || "";
        if (!slug && parts.length > 0) slug = parts.pop() || "";
      } else if (code.startsWith('stoqle://user/')) {
        slug = code.replace('stoqle://user/', '');
      } else {
        slug = code;
      }

      if (slug) {
        toast.success("QR Code detected!");
        await new Promise(resolve => setTimeout(resolve, 800));
        router.push(`/${slug}`);
      } else {
        toast.error("Unrecognized QR Code");
        setIsProcessing(false);
      }
    } catch (_) {
      toast.error("Error processing QR code");
      setIsProcessing(false);
    }
  };

  const toggleTorch = async () => {
    if (!cameraReady) return;
    try {
      const video = document.querySelector('#reader video') as HTMLVideoElement | null;
      const stream = (video?.srcObject ?? mediaStreamRef.current) as MediaStream | null;
      const track = stream?.getVideoTracks()[0];

      if (track && track.getCapabilities && (track.getCapabilities() as any).torch) {
        const nextTorch = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: nextTorch } as any] });
        setTorchOn(nextTorch);
      } else {
        toast.info("Torch not supported on this device");
      }
    } catch (err) {
      console.error("Flash error", err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !html5QrCodeRef.current) return;
    try {
      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      handleResult(decodedText);
    } catch (_) {
      toast.error("No QR code found in this image");
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Camera Feed */}
      <div id="reader" className="absolute inset-0 w-full h-full" />

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Background Overlay with "Hole" */}
        <div className="absolute inset-0 bg-black/60">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] aspect-square rounded-[24px] bg-transparent shadow-[0_0_0_100vmax_rgba(0,0,0,0.6)]" />
        </div>

        {/* Scan Window Corners */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] aspect-square">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <path d="M 0 30 L 0 10 A 10 10 0 0 1 10 0 L 30 0" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M 70 0 L 90 0 A 10 10 0 0 1 100 10 L 100 30" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M 100 70 L 100 90 A 10 10 0 0 1 90 100 L 70 100" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M 30 100 L 10 100 A 10 10 0 0 1 0 90 L 0 70" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Animated Scanning Line */}
        <motion.div
          animate={{ top: ['15%', '85%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 z-10"
          style={{ top: '15%' }}
        >
          <div className="h-full w-full bg-white shadow-[0_0_15px_2px_rgba(255,255,255,0.8)] relative">
            <div className="absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-white/20 via-white/5 to-transparent pointer-events-none overflow-hidden">
              <div className="flex justify-around w-full h-full opacity-30">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="w-[1px] h-full bg-gradient-to-b from-transparent via-white/40 to-white/60" />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Instructions */}
        <div className="absolute top-[calc(50%+35vw+30px)] left-0 right-0 flex flex-col items-center gap-2">
          <p className="text-white text-base font-medium drop-shadow-md">
            Please place the QR code in the frame
          </p>
          <p className="text-white/50 text-xs drop-shadow-md">
            Tap the flash icon if it&apos;s too dark
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="absolute top-10 left-0 right-0 px-6 flex items-center justify-between pointer-events-auto">
        <button
          onClick={handleBack}
          className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors"
        >
          <XMarkIcon className="w-8 h-8" />
        </button>
        <button
          onClick={toggleTorch}
          className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors"
        >
          {torchOn ? <BoltIcon className="w-7 h-7 text-yellow-400 fill-current" /> : <BoltIcon className="w-7 h-7" />}
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="absolute bottom-16 left-0 right-0 flex items-center justify-evenly pointer-events-auto">
        <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={handleBack}>
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white group-hover:bg-white/30 transition-colors shadow-xl">
            <QrCodeIcon className="w-8 h-8" />
          </div>
          <span className="text-white text-xs font-bold tracking-tight">My QR code</span>
        </div>

        <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white group-hover:bg-white/30 transition-colors shadow-xl">
            <PhotoIcon className="w-8 h-8" />
          </div>
          <span className="text-white text-xs font-bold tracking-tight">Album</span>
        </div>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[10000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-bold tracking-widest text-sm uppercase">Preparing Profile...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
