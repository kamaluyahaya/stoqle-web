import React, { useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Camera, Image as ImageIcon, X, CheckCircle } from "lucide-react";
import { PostModalContext } from "../types";

interface AttachmentMediaModalProps {
  ctx: PostModalContext;
  onClose: () => void;
  onInsertToken: (token: string, metadata: any) => void;
  /** Called with the selected File objects so the composer can include them in the upload */
  onFilesSelected?: (files: File[]) => void;
}

export default function AttachmentMediaModal({ ctx, onClose, onInsertToken, onFilesSelected }: AttachmentMediaModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Max 4 images total
    const allowed = files.slice(0, 4 - selectedFiles.length);
    const newPreviews = allowed.map(f => URL.createObjectURL(f));

    setSelectedFiles(prev => [...prev, ...allowed]);
    setPreviews(prev => [...prev, ...newPreviews]);

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (selectedFiles.length === 0) {
      onClose();
      return;
    }

    // Insert a display token into the comment text for each selected image
    // We only insert ONE combined token to keep the text clean
    const token = `[Media: ${selectedFiles.length} image${selectedFiles.length > 1 ? "s" : ""}]`;
    onInsertToken(token, {
      type: "media",
      id: `temp-${Date.now()}`,
      name: selectedFiles[0].name,
      display: token,
      localPreviews: previews,
      fileCount: selectedFiles.length,
    });

    // Pass the raw File objects up so handleAddComment can upload them
    onFilesSelected?.(selectedFiles);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[200] bg-white rounded-t-[1.5rem] flex flex-col max-h-[80vh] sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="text-md font-bold text-slate-800 tracking-tight">
              Attach Media
              {selectedFiles.length > 0 && (
                <span className="ml-2 text-xs font-semibold text-rose-500">
                  ({selectedFiles.length}/4)
                </span>
              )}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 bg-slate-100/50 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 relative flex flex-col gap-4 overflow-y-auto">
          {/* Hidden Inputs */}
          <input
            type="file"
            ref={cameraInputRef}
            className="hidden"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileChange}
          />
          <input
            type="file"
            ref={galleryInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((src, idx) => (
                <div key={idx} className="relative aspect-square rounded-[0.5rem] overflow-hidden bg-slate-100 border border-slate-200 group">
                  <Image
                    src={src}
                    alt={`Preview ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="100px"
                  />
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity active:scale-90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pick Buttons — only show if under the 4-image limit */}
          {selectedFiles.length < 4 && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-[1rem] transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-2 group-hover:scale-105 transition-transform group-hover:text-rose-500">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-700">Take Photo</span>
                <span className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wider">Camera</span>
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-[1rem] transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-2 group-hover:scale-105 transition-transform group-hover:text-blue-500">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-700">Photo Library</span>
                <span className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wider">Gallery</span>
              </button>
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-slate-50 rounded-[0.75rem] border border-slate-100">
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Up to 4 images can be attached to your comment and will be visible to everyone.
            </p>
          </div>
        </div>

        {/* Confirm Button */}
        <div className="px-5 pb-6 pt-2 border-t border-slate-100">
          <button
            onClick={handleConfirm}
            disabled={selectedFiles.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500 text-white text-sm font-bold shadow-md shadow-rose-500/20 disabled:opacity-40 disabled:grayscale transition-all active:scale-[0.98]"
          >
            <CheckCircle className="w-4 h-4" />
            {selectedFiles.length === 0
              ? "Select Images First"
              : `Attach ${selectedFiles.length} Image${selectedFiles.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
