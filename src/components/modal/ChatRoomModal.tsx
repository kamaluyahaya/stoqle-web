"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatView } from "../feed/message/ChatView";
import { getNextZIndex } from "@/src/lib/utils/z-index";

interface ChatRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string | number | null;
  roomId?: string | number | null;
  initialOtherUser?: any;
}

export const ChatRoomModal: React.FC<ChatRoomModalProps> = ({
  isOpen,
  onClose,
  targetUserId,
  roomId,
  initialOtherUser,
}) => {
  const [zIndex, setZIndex] = useState(() => getNextZIndex());

  // Request new z-index on open
  useEffect(() => {
    if (isOpen) {
      setZIndex(getNextZIndex());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4"
          style={{ zIndex }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: "100%", scale: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: "100%", scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-white rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-[85vh] max-h-[1000px]"
          >
            <div className="flex-1 overflow-hidden">
              <ChatView
                targetUserIdProp={targetUserId}
                roomIdProp={roomId}
                hideSidebar={true}
                onClose={onClose}
                initialOtherUser={initialOtherUser}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
