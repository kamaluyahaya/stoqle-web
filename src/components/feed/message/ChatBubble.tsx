"use client";

import React from "react";

type MessageProps = {
    mine: boolean;
    content?: string;
    sentAt?: string | null;
    senderName?: string;
    isRead?: number | boolean;
    messageType?: "text" | "file" | string;
    file?: { file_id?: string | number; file_url?: string } | null;
    fileUrl?: string | null;
    fileType?: string | null;
};

export const ChatBubble: React.FC<MessageProps> = ({
    mine,
    content,
    sentAt,
    senderName,
    isRead,
    messageType,
    file,
    fileUrl,
    fileType,
}) => {
    // Determine the actual URL and type from available props
    const actualUrl = fileUrl || file?.file_url;
    const actualType = fileType || (actualUrl ? (actualUrl.split('.').pop()?.toLowerCase()) : null);

    const isImage = actualUrl && (actualType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(actualType || ''));
    const isVideo = actualUrl && (actualType?.includes('video') || ['mp4', 'webm', 'ogg'].includes(actualType || ''));
    const isPdf = actualUrl && (actualType?.includes('pdf') || actualType === 'pdf');

    return (
        <div className={`flex w-full mb-1 ${mine ? "justify-end" : "justify-start"}`}>
            <div
                className={`flex flex-col max-w-[85%] md:max-w-[70%] ${mine ? "items-end" : "items-start"
                    }`}
            >

                <div
                    className={`relative overflow-hidden transition-all duration-300 ${mine
                        ? "bg-red-500 text-white rounded-2xl rounded-tr-none"
                        : "bg-white text-gray-800 border-gray-100 rounded-2xl rounded-tl-none border shadow-sm"
                        } ${isImage || isVideo ? "p-1" : "p-3"}`}
                >
                    {/* Media Rendering */}
                    {actualUrl && (
                        <div className="mb-2">
                            {isImage ? (
                                <img
                                    src={actualUrl}
                                    alt="Shared image"
                                    className="max-w-full rounded-xl object-cover hover:opacity-95 transition-opacity cursor-pointer shadow-sm"
                                    style={{ maxHeight: '300px' }}
                                />
                            ) : isVideo ? (
                                <video
                                    src={actualUrl}
                                    controls
                                    className="max-w-full rounded-xl shadow-sm"
                                    style={{ maxHeight: '300px' }}
                                />
                            ) : (
                                <div className={`flex items-center gap-3 rounded-xl ${mine ? "bg-red-600" : "bg-gray-50 border border-gray-100"}`}>
                                    <div className={`p-2 rounded-lg ${mine ? "bg-red-400" : "bg-red-100 text-red-500"}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">
                                            {isPdf ? "PDF Document" : "Shared File"}
                                        </p>
                                        <a
                                            href={actualUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`text-[11px] font-bold underline decoration-2 underline-offset-4 mt-1 block ${mine ? "text-red-100 hover:text-white" : "text-red-500 hover:text-red-600"}`}
                                        >
                                            View & Download
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Text Content */}
                    {content && (
                        <p className="whitespace-pre-wrap leading-relaxed text-sm px-1 p-0 py-0.5">{content}</p>
                    )}
                </div>

                {/* Footer / Status */}
                <div
                    className={`flex items-right gap-1.5 mt-1.5 mb-1 text-[10px] font-medium tracking-tight ${mine ? "text-red-400" : "text-gray-400"
                        }`}
                >
                    {sentAt && (
                        <span>
                            {new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    {mine && (
                        <span className="flex items-center gap-0.1">
                            • {isRead ? "Read" : "Sent"}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
