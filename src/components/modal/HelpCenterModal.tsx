"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, CameraIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import DescriptionTextarea from "../input/defaultDescTextarea";
import PhoneNumberInput from "../input/default-phone-number";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import Swal from "sweetalert2";

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpCenterModal({ isOpen, onClose }: HelpCenterModalProps) {
  const { token } = useAuth();
  const [description, setDescription] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length + files.length > 5) {
      toast.error("You can only upload up to 5 photos/videos");
      return;
    }

    const newFiles = [...files, ...selectedFiles];
    setFiles(newFiles);

    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    const newPreviews = [...previews];

    URL.revokeObjectURL(newPreviews[index]);
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);

    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.length < 30) {
      toast.error("Description must be at least 30 characters");
      return;
    }
    if (phoneNumber.length < 11) {
      toast.error("Phone number must be at least 11 digits");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("description", description);
      formData.append("phone_number", phoneNumber);

      files.forEach((file) => {
        formData.append("media", file);
      });

      const res = await fetch(`${API_BASE_URL}/api/app/feedback`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to submit feedback");
      }

      Swal.fire({
        title: "Feedback Submitted!",
        text: "Thank you for your feedback! We will get back to you soon.",
        icon: "success",
        confirmButtonText: "Okay",
        confirmButtonColor: "#dc2626", // rose-500
        background: "#ffffff",
        customClass: {
          title: "text-lg font-bold text-slate-900",
          popup: "rounded-3xl",
          confirmButton: "rounded-full px-8 py-2 font-bold",
        },
      });

      // Reset form
      setDescription("");
      setPhoneNumber("");
      setFiles([]);
      setPreviews([]);
      onClose();
    } catch (error: any) {
      console.error("Feedback submission error:", error);
      toast.error(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[1000000] bg-white flex flex-col md:max-w-xl md:mx-auto md:h-[90vh] md:top-10 md:rounded-3xl md:shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-slate-100">
            <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors">
              <XMarkIcon className="w-6 h-6 text-slate-800" />
            </button>
            <h2 className="text-md font-bold text-slate-900">Help Center</h2>
            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Feedback Description</p>

              <DescriptionTextarea
                value={description}
                onChange={setDescription}
                placeholder="Describe your issues or suggestion in detail..."
                maxLength={500}
                required
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-slate-500">Photos and videos (optional)</h3>
                <span className="text-[10px] text-slate-400 font-medium">{files.length}/5</span>
              </div>

              <div className="flex flex-wrap gap-3">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                    <img src={src} className="w-full h-full object-cover" alt="" />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {files.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition-colors"
                  >
                    <CameraIcon className="w-6 h-6 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="pt-2">
              <PhoneNumberInput
                label="Phone number"
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="Your contact number"
                variant="default"
                required
                maxLength={11}
              />
            </div>
          </form>

          {/* Footer */}
          <div className="p-4 bg-white md:rounded-b-3xl">
            {(description.length > 0 && description.length < 30) || (phoneNumber.length > 0 && phoneNumber.length < 11) ? (
              <p className="text-[10px] text-rose-500 mb-2 font-medium text-center">
                {description.length < 30
                  ? "Description must be at least 30 characters"
                  : "Phone number must be 11 digits"}
              </p>
            ) : null}
            <button
              onClick={handleSubmit}
              disabled={description.length < 30 || phoneNumber.length < 11 || isSubmitting}
              className="w-full py-2 bg-rose-500 disabled:bg-rose-200 disabled:text-slate-100 disabled:shadow-none text-white rounded-full  flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-rose-500/20"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting Feedback...
                </>
              ) : (
                "Submit Feedback"
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
