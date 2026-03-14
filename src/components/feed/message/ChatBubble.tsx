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
    product_id?: string | number | null;
    product_name?: string | null;
    product_price?: string | null;
    product_image?: string | null;
    product_variant?: string | null;
    senderAvatar?: string | null;
    onProductClick?: (productId: string | number) => void;
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
    product_id,
    product_name,
    product_price,
    product_image,
    product_variant,
    senderAvatar,
    onProductClick
}) => {
    // Determine the actual URL and type from available props
    const actualUrl = fileUrl || file?.file_url;
    const actualType = fileType || (actualUrl ? (actualUrl.split('.').pop()?.toLowerCase()) : null);

    const isImage = actualUrl && (actualType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(actualType || ''));
    const isVideo = actualUrl && (actualType?.includes('video') || ['mp4', 'webm', 'ogg'].includes(actualType || ''));
    const isPdf = actualUrl && (actualType?.includes('pdf') || actualType === 'pdf');

    return (
        <div className={`flex w-full mb-2 items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
            {/* Sender Avatar */}
            <div className={`shrink-0 mb-1 transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer`}>
                {senderAvatar ? (
                    <img src={senderAvatar} className="w-8 h-8 rounded-full border border-gray-100 object-cover shadow-sm bg-gray-50" alt="" />
                ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${mine ? "bg-red-600 text-white" : "bg-red-50 text-red-500 border border-red-100"}`}>
                        {senderName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                )}
            </div>

            <div
                className={`flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[65%] ${mine ? "items-end" : "items-start"
                    }`}
            >

                <div
                    className={`relative overflow-hidden transition-all duration-300 ${mine
                        ? "bg-red-500 text-white rounded-2xl rounded-tr-none shadow-md shadow-red-500/10"
                        : "bg-white text-gray-800 border-gray-100 rounded-2xl rounded-tl-none border shadow-sm"
                        } ${isImage || isVideo ? "p-1" : "p-2.5 px-3"}`}
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

                    {/* Product Metadata Tag */}
                    {product_name && (
                        <div 
                            onClick={() => product_id && onProductClick?.(product_id)}
                            className={`mb-3 p-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] ${mine ? "bg-black/10 hover:bg-black/20" : "bg-red-50 border border-red-100 hover:bg-red-100/50"}`}
                        >
                            {product_image && (
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/20 bg-white/50 shrink-0 shadow-sm">
                                    <img src={product_image} className="w-full h-full object-cover" alt="" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className={`text-[10px] font-bold uppercase tracking-tight leading-tight line-clamp-2 max-w-[calc(100%-65px)] ${mine ? "text-white" : "text-slate-900"}`}>{product_name}</h4>
                                    <span className={`text-[11px] font-black shrink-0 ml-auto ${mine ? "text-white" : "text-red-600"}`}>₦{Number(product_price || 0).toLocaleString()}</span>
                                </div>
                                {product_variant && (
                                    <p className={`text-[9px] font-bold mt-0.5 truncate uppercase tracking-widest ${mine ? "text-white/70" : "text-slate-400"}`}>{product_variant}</p>
                                )}
                            </div>
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
