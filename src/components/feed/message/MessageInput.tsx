"use client";

import { Send } from "lucide-react";
import React, { useRef } from "react";

type MessageInputProps = {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    onFileSelect: (file: File | null) => void;
    isSending: boolean;
    selectedFile?: File | null;
    filePreview?: string | null;
    onCancelFile?: () => void;
};

export const MessageInput: React.FC<MessageInputProps> = ({
    value,
    onChange,
    onSend,
    onFileSelect,
    isSending,
    selectedFile,
    filePreview,
    onCancelFile,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ⚡ DYNAMIC HEIGHT & FOCUS: When value changes (like auto-fill), update height and position cursor
    React.useEffect(() => {
        if (textareaRef.current) {
            const el = textareaRef.current;
            el.style.height = 'auto'; // Reset first
            
            const lineHeight = 20;
            const maxRows = 6;
            const maxHeight = lineHeight * maxRows;
            
            // Recalculate based on content
            el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
            el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="flex flex-col w-full gap-1">

            <div className="p-1 border-gray-100 flex items-end gap-3">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5  rounded-full bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm"
                    title="Attach file"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                    </svg>
                </button>

                <input

                    type="file"
                    ref={fileInputRef}
                    className="hidden "
                    onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
                />

                <div className="flex-1 relative">
                    <textarea
                        autoFocus
                        ref={textareaRef}
                        onFocus={(e) => {
                            // Move cursor to end on focus
                            const val = e.target.value;
                            e.target.setSelectionRange(val.length, val.length);
                        }}
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);

                            const el = e.target;
                            el.style.height = 'auto';

                            const lineHeight = 20;
                            const maxRows = 6;
                            const maxHeight = lineHeight * maxRows;

                            el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
                            el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedFile ? "Add a caption..." : "Type your message..."}
                        className="w-full
    rounded-3xl
    bg-gray-100
    border
    border-slate-300
    px-5
    py-2
    pr-11
    text-sm
    caret-red-500
    text-gray-500
    transition
    focus:outline-none focus:ring-0
    resize-none
    overflow-y-auto
    leading-tight
    mb-0
    block"
                        rows={1}
                    />
                </div>

                <button
                    onClick={onSend}
                    disabled={isSending || (!value.trim() && !selectedFile)}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all font-semibold shadow-md disabled:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95 shrink-0"
                >
                    {isSending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    )}
                </button>
            </div>
        </div>
    );
};
