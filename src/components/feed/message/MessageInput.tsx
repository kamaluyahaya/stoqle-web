"use client";

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="flex flex-col w-full gap-3">
            {/* File Preview Overlay */}
            {selectedFile && (
                <div className="mx-2 mb-2 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3 relative animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="relative shrink-0">
                        {filePreview ? (
                            <img
                                src={filePreview}
                                alt="Preview"
                                className="w-12 h-12 rounded-lg object-cover shadow-sm"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center text-red-500 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">
                            {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                            {(selectedFile.size / 1024).toFixed(1)} KB • Ready to send
                        </p>
                    </div>

                    <button
                        onClick={onCancelFile}
                        className="p-1.5 rounded-full bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="bg-white p-1 border-gray-100 flex items-end gap-3">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 mb-1 rounded-full bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm"
                    title="Attach file"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
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
                    className="hidden"
                    onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
                />

                <div className="flex-1 relative">
                    <textarea
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            // Auto-resize
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedFile ? "Add a caption..." : "Type your message..."}
                        className="w-full bg-gray-50 text-gray-900 border-none rounded-2xl px-5 py-3 pr-4 focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm outline-none shadow-inner resize-none min-h-[48px] max-h-32 block overflow-y-auto custom-scrollbar"
                        rows={1}
                    />
                </div>

                <button
                    onClick={onSend}
                    disabled={isSending || (!value.trim() && !selectedFile)}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all font-semibold shadow-md disabled:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95 shrink-0"
                >
                    {isSending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
};
