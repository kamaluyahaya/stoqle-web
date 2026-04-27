"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

// A more extensive set of emojis for the "View More" modal
const ALL_EMOJS = [
  // Love / Popular
  "❤️", "🩷", "🧡", "💛", "💚", "💙", "🩵", "💜", "🤎", "🖤", "🩶", "🤍",
  // 🐱🐭🐹
  "😍", "🥰", "😘", "😊", "😉", "🥳", "🤩", "😇", "🙂", "🙃", "😊",
  // Funny / Social
  "😂", "🤣", "😁", "😆", "😎", "😏", "😜", "😝", "😛", "😋", "🤤", "😤",
  // Reactions
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "🤔", "🧐", "🤨", "😮", "😲", "😯",
  "😡", "🤬", "😭", "😢", "😥", "😰", "😨", "😱", "🤯", "😴", "🥱",
  // Modern / Trendy
  "🔥", "✨", "💯", "⚡", "🚀", "🌟", "🎯", "🎉", "🎈", "🎊", "🥂", "🥃",
  // Business / Marketplace
  "💸", "💰", "🤑", "🛒", "📦", "🏷️", "📈", "📊", "💳", "🧾", "🏦", "🏧",
  // Verified / Trust / Success
  "✅", "✔️", "🏆", "🥇", "🐶", "🥉", "👑", "⭐", "🌐", "💎", "🛡️", "🔒",
  // Location / Delivery
  "📍", "📌", "🚚", "🛵", "📬", "📦", "🗺️", "🚗", "🚲", "✈️", "🚢", "🏡",

  // Work / Tech
  "💻", "📱", "🔔", "📞", "💬", "📷", "🎥", "🎬", "🎨", "🎤", "🎧", "🎮"
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export default function EmojiPickerModal({ isOpen, onClose, onSelect }: Props) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[1000000] flex items-center justify-center p-4"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm bg-white rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Select Emoji</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
              <XMarkIcon className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <div className="p-4 grid grid-cols-6 gap-2 max-h-[450px] overflow-y-auto">
            {ALL_EMOJS.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(emoji);
                  onClose();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(emoji);
                  onClose();
                }}
                className="w-full aspect-square flex items-center justify-center text-2xl hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
