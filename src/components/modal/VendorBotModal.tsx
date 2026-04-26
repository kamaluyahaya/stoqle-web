"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getNextZIndex } from "@/src/lib/utils/z-index";
import { Sparkles, Send, X, Loader2, ImagePlus } from "lucide-react";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import PreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { PreviewPayload } from "@/src/types/product";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface VendorBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductPreview?: (payload: PreviewPayload) => void;
}

export const VendorBotModal: React.FC<VendorBotModalProps> = ({
  isOpen,
  onClose,
  onProductPreview
}) => {
  const [zIndex, setZIndex] = useState(() => getNextZIndex());
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your Stoqle Vendor Assistant. I can help you create, edit, or manage products and store policies. What would you like to do?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const { token } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Payload Modal
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const processBotReply = (replyText: string, currentMessages: Message[]) => {
    let finalReply = replyText;
    const payloadMatch = finalReply.match(/\[PREVIEW_PAYLOAD\]([\s\S]*?)\[\/PREVIEW_PAYLOAD\]/);
    
    if (payloadMatch && payloadMatch[1]) {
       try {
         const parsedPayload = JSON.parse(payloadMatch[1].trim());
         finalReply = finalReply.replace(/\[PREVIEW_PAYLOAD\][\s\S]*?\[\/PREVIEW_PAYLOAD\]/, '').trim();
         
         if (onProductPreview) {
           onProductPreview(parsedPayload);
         } else {
           setPreviewPayload(parsedPayload);
         }
         
         if (!finalReply) {
           finalReply = "Here is the preview of your product. Please confirm to publish.";
         }
       } catch (e) {
         console.error("Failed to parse JSON payload from AI", e);
       }
    }
    
    setMessages([...currentMessages, { role: 'assistant', content: finalReply }]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message to UI
    const updatedMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/vendor-bot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(1) // send history except first greeting
        })
      });

      const data = await response.json();
      
      if (data.success && data.reply) {
        processBotReply(data.reply, updatedMessages);
      } else {
        setMessages([...updatedMessages, { role: 'assistant', content: "I'm sorry, I encountered an error processing your request." }]);
      }
    } catch (error) {
      console.error(error);
      setMessages([...updatedMessages, { role: 'assistant', content: "Network error. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsTyping(true);
    const formData = new FormData();
    formData.append("files", file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/meta/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if ((data.status === 'success' || data.success) && data.data && data.data.filenames && data.data.filenames.length > 0) {
        const fileUrl = `${API_BASE_URL}/${data.data.filenames[0]}`;
        const userMsg = `[Uploaded Product Image: ${fileUrl}]`;
        const updatedMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
        setMessages(updatedMessages);
        
        // Trigger bot response after image upload
        const botResponse = await fetch(`${API_BASE_URL}/api/chat/vendor-bot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            message: userMsg,
            history: updatedMessages.slice(1)
          })
        });
        const botData = await botResponse.json();
        if (botData.success && botData.reply) {
          processBotReply(botData.reply, updatedMessages);
        }
      } else {
        setMessages([...messages, { role: 'assistant', content: "Failed to upload image." }]);
      }
    } catch (error) {
      console.error("Upload error", error);
      setMessages([...messages, { role: 'assistant', content: "Network error during upload." }]);
    } finally {
      setIsTyping(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
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
              className="relative w-full max-w-lg bg-white rounded-t-[1.5rem] sm:rounded-[1rem] shadow-2xl flex flex-col h-[85vh] sm:h-[75vh] max-h-[800px] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Vendor Assistant</h2>
                    <p className="text-xs text-slate-500 font-medium">Powered by AI</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-rose-500 text-white rounded-br-sm shadow-md shadow-rose-200'
                          : 'bg-white text-slate-700 rounded-bl-sm shadow-sm border border-slate-100'
                      }`}
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {msg.role === 'user' && msg.content.includes('[Uploaded Product Image:') ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs opacity-90">I uploaded an image:</span>
                          <img 
                            src={msg.content.match(/\[Uploaded Product Image:\s*(.*?)\]/)?.[1]} 
                            alt="Uploaded" 
                            className="max-w-[150px] rounded-lg border border-rose-300" 
                          />
                        </div>
                      ) : (
                        formatText(msg.content)
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-slate-100 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                      <span className="text-xs text-slate-500">AI is thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-slate-100">
                <div className="relative flex items-center">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask AI to add a product, create a description..."
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none max-h-32 text-sm"
                    rows={1}
                    style={{ minHeight: "44px" }}
                  />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isTyping}
                    className="absolute left-2 p-2 text-slate-400 hover:text-violet-500 rounded-xl transition-colors disabled:opacity-50"
                    title="Upload Product Image"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="absolute right-2 p-2 bg-violet-500 text-white rounded-xl hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                  AI can make mistakes. Please verify product details before publishing.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Fallback Preview Modal (if parent doesn't handle it) */}
      {previewPayload && !onProductPreview && (
        <PreviewModal 
          open={!!previewPayload} 
          payload={previewPayload} 
          onClose={() => setPreviewPayload(null)} 
          zIndex={zIndex + 10}
        />
      )}
    </>
  );
};
