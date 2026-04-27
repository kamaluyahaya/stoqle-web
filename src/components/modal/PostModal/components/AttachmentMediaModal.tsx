import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Camera, Image as ImageIcon } from "lucide-react";
import { PostModalContext } from "../types";

interface AttachmentMediaModalProps {
  ctx: PostModalContext;
  onClose: () => void;
  onInsertToken: (token: string, metadata: any) => void;
}

export default function AttachmentMediaModal({ ctx, onClose, onInsertToken }: AttachmentMediaModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, source: 'camera' | 'gallery') => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.length > 15 ? file.name.substring(0, 15) + "..." : file.name;
      const token = `[Media: ${fileName}]`;
      onInsertToken(token, {
        type: "media",
        id: `temp-${Date.now()}`,
        name: file.name,
        source: source,
        display: token
      });
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[200] bg-white rounded-t-[1.5rem] flex flex-col h-[70vh] sm:max-h-[70vh] sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="text-md font-bold text-slate-800 tracking-tight">Attach Media</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 bg-slate-100/50 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 relative flex flex-col min-h-[200px]">
          {/* Hidden Inputs */}
          <input 
            type="file" 
            ref={cameraInputRef} 
            className="hidden" 
            accept="image/*" 
            capture="environment" 
            onChange={(e) => handleFileChange(e, 'camera')}
          />
          <input 
            type="file" 
            ref={galleryInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => handleFileChange(e, 'gallery')}
          />

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-[1rem] transition-all group"
            >
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform group-hover:text-rose-500">
                <Camera className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-slate-700">Take Photo</span>
              <span className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Camera</span>
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-[1rem] transition-all group"
            >
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform group-hover:text-blue-500">
                <ImageIcon className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-slate-700">Photo Library</span>
              <span className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Gallery</span>
            </button>
          </div>

          <div className="mt-auto p-4 bg-slate-50 rounded-[0.75rem] border border-slate-100">
             <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
               Images selected here will be attached to your comment as a visual reference for other users.
             </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
