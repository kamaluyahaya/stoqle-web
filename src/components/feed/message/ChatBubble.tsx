"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, RotateCcw, AlertCircle, ShieldCheck, Zap, Download, Play, Pause } from "lucide-react";
import { chatDb } from "@/src/lib/services/chatDb";
import { useAudio } from "@/src/context/audioContext";

type MessageProps = {
    mine: boolean;
    status?: "sending" | "sent" | "delivered" | "failed" | "read" | "processing";
    onRetry?: () => void;
    content?: string;
    sentAt?: string | null;
    senderName?: string;
    isRead?: number | boolean;
    messageType?: "text" | "file" | string;
    file?: { file_id?: string | number; file_url?: string; file_name?: string } | null;
    fileUrl?: string | null;
    fileType?: string | null;
    file_name?: string | null;
    product_id?: string | number | null;
    product_name?: string | null;
    product_price?: string | null;
    product_image?: string | null;
    product_variant?: string | null;
    senderId?: string | number | null;
    senderAvatar?: string | null;
    onAvatarClick?: (userId: string | number, avatarUrl: string, name: string) => void;
    onProductClick?: (productId: string | number) => void;
    order_id?: string | number | null;
    order_ref?: string | null;
    onOrderClick?: (orderId: string | number, orderRef: string) => void;
    onImageClick?: (url: string) => void;
    onPdfClick?: (url: string) => void;
    messageId?: string | number;
    onLongPress?: (messageId: string | number) => void;
    isEdited?: boolean;
    onVideoClick?: (url: string) => void;
    video_thumbnail?: string | null;
};

const StatusStatus: React.FC<{ status: "sending" | "sent" | "delivered" | "read" | "failed" | "processing", mine: boolean }> = ({ status, mine }) => {
    if (status === 'failed') return null;

    return (
        <div className={`flex items-center transition-all duration-300 ${status === 'sending' || status === 'processing' ? 'opacity-50' : 'opacity-100'}`}>
            {(status === 'sending' || status === 'processing') ? (
                <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin opacity-60" />
            ) : status === 'sent' ? (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={mine ? "text-slate-400" : "text-gray-400"}>
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            ) : (
                <div className="flex -space-x-1 items-center">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={status === 'read' ? "text-white" : mine ? "text-slate-400" : "text-gray-400"}>
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={status === 'read' ? "text-white" : mine ? "text-slate-400" : "text-gray-400"}>
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            )}
        </div>
    );
};

export const ChatBubble: React.FC<MessageProps> = ({
    mine,
    status = "sent",
    onRetry,
    content,
    sentAt,
    senderName,
    isRead,
    messageType,
    file,
    fileUrl,
    fileType,
    file_name,
    product_id,
    product_name,
    product_price,
    product_image,
    product_variant,
    senderAvatar,
    onProductClick,
    order_id,
    order_ref,
    onOrderClick,
    onImageClick,
    onPdfClick,
    senderId,
    onAvatarClick,
    messageId,
    onLongPress,
    isEdited,
    onVideoClick,
    video_thumbnail
}) => {
    // Determine the actual URL and type from available props
    const actualUrl = fileUrl || file?.file_url;
    const actualType = fileType || (actualUrl ? (actualUrl.split('.').pop()?.toLowerCase()) : null);

    const isImage = actualUrl && (actualType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(actualType || ''));
    const isVideo = actualUrl && (actualType?.includes('video') || ['mp4', 'webm', 'ogg'].includes(actualType || ''));
    const isPdf = actualUrl && (actualType?.includes('pdf') || actualType === 'pdf');
    const isVoice = messageType === 'voice' || (actualUrl && (actualType?.includes('audio') || ['webm', 'ogg', 'mp3', 'wav', 'm4a'].includes(actualType || '')));

    const [isImageLoading, setIsImageLoading] = React.useState(true);
    const [cachedUrl, setCachedUrl] = React.useState<string | null>(null);

    // ⚡ INSTANT MEDIA RELOAD: Check cache on mount
    React.useEffect(() => {
        if (isImage && actualUrl && !actualUrl.startsWith('blob:') && !actualUrl.startsWith('data:')) {
            chatDb.getMedia(actualUrl).then(blob => {
                if (blob) {
                    setCachedUrl(URL.createObjectURL(blob));
                    setIsImageLoading(false);
                }
            });
        }
        return () => {
            if (cachedUrl) URL.revokeObjectURL(cachedUrl);
        };
    }, [actualUrl, isImage]);

    const finalDisplayUrl = cachedUrl || actualUrl;

    const handleImageLoad = () => {
        setIsImageLoading(false);
        // ⚡ SMART CACHING: Store for next time if not already cached
        if (isImage && actualUrl && !cachedUrl && !actualUrl.startsWith('blob:') && !actualUrl.startsWith('data:')) {
            fetch(actualUrl)
                .then(res => res.blob())
                .then(blob => {
                    chatDb.cacheMedia(actualUrl, blob);
                })
                .catch(() => console.warn("Caching failed for media", actualUrl));
        }
    };

    // ⚡ DYNAMIC VIDEO THUMBNAIL CACHING
    const [videoThumbUrl, setVideoThumbUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (isVideo && actualUrl && !actualUrl.startsWith('blob:') && !actualUrl.startsWith('data:')) {
            const thumbKey = actualUrl + '_thumb';
            chatDb.getMedia(thumbKey).then(blob => {
                if (blob) {
                    setVideoThumbUrl(URL.createObjectURL(blob));
                } else {
                    // Try to derive it live
                    const video = document.createElement('video');
                    video.src = actualUrl;
                    video.crossOrigin = 'anonymous';
                    video.muted = true;
                    video.playsInline = true;
                    video.currentTime = 3.0; // Seek to 3 seconds for better cover
                    
                    video.onloadeddata = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth || 640;
                        canvas.height = video.videoHeight || 360;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            canvas.toBlob(b => {
                                if (b) {
                                    setVideoThumbUrl(URL.createObjectURL(b));
                                    chatDb.cacheMedia(thumbKey, b);
                                }
                            }, 'image/jpeg', 0.8);
                        }
                    };
                }
            });
        }
        return () => {
            if (videoThumbUrl) URL.revokeObjectURL(videoThumbUrl);
        };
    }, [isVideo, actualUrl]);

    const [isVoicePlaying, setIsVoicePlaying] = React.useState(false);
    const voiceAudioRef = React.useRef<HTMLAudioElement | null>(null);
    const { playingAudioId, registerPlayback } = useAudio();

    // ⚡ CONCURRENCY CONTROL: Stop playing if another audio starts
    React.useEffect(() => {
        const uniqueId = String(messageId || actualUrl);
        if (playingAudioId !== uniqueId && isVoicePlaying) {
            voiceAudioRef.current?.pause();
            setIsVoicePlaying(false);
        }
    }, [playingAudioId, messageId, actualUrl, isVoicePlaying]);

    const toggleVoicePlayback = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!voiceAudioRef.current) return;
        
        const uniqueId = String(messageId || actualUrl);
        
        if (isVoicePlaying) {
            voiceAudioRef.current.pause();
            registerPlayback(null);
        } else {
            registerPlayback(uniqueId);
            voiceAudioRef.current.play();
        }
        setIsVoicePlaying(!isVoicePlaying);
    };

    // ⚡ LONG PRESS HANDLING
    const pressTimer = React.useRef<any>(null);
    const handlePressStart = () => {
        if (!messageId || !onLongPress) return;
        pressTimer.current = setTimeout(() => {
            onLongPress(messageId);
        }, 600); // 600ms for solid long press feel
    };
    const handlePressEnd = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    return (
        <motion.div
            initial={mine ? { opacity: 0, y: 30, scale: 0.2, originX: 1, originY: 1 } : { opacity: 0, y: 15, scale: 0.9, originX: 0, originY: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                mass: 0.8
            }}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            className={`flex w-full mb-1 items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"} select-none`}
        >
            {/* Sender Avatar */}
            <div
                onClick={() => onAvatarClick?.(senderId || 0, senderAvatar || "", senderName || "")}
                className={`shrink-0 mb-1 transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer`}
            >
                {senderAvatar ? (
                    <img src={senderAvatar} className="w-8 h-8 rounded-full border border-gray-100 object-cover shadow-sm bg-gray-50" alt="" />
                ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${mine ? "bg-red-600 text-white" : "bg-red-50 text-red-500 border border-red-100"}`}>
                        {senderName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                )}
            </div>

            <div
                className={`flex flex-col max-w-[80%] ${mine ? "items-end" : "items-start"
                    }`}
            >

                <div
                    className={`relative overflow-hidden transition-all duration-300 ${mine
                        ? "bg-[#E11D48] text-white rounded-2xl rounded-tr-none  "
                        : "bg-white text-gray-800 border-gray-100 rounded-2xl rounded-tl-none border "
                        } ${isImage || isVideo ? "p-1" : "p-1.5 px-3"}`}
                >
                    {/* Media Rendering */}
                    {actualUrl && (
                        <div className={`mb-1 relative group/image rounded-xl overflow-hidden ${status === 'sending' ? 'opacity-70 grayscale-[50%]' : ''}`}>
                            {(isImageLoading || status === 'sending') && isImage && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/50 backdrop-blur-[2px]">
                                    <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                                </div>
                            )}
                            {isImage ? (
                                <img
                                    src={finalDisplayUrl || ""}
                                    alt="Shared image"
                                    loading="eager"
                                    onLoad={handleImageLoad}
                                    onClick={() => onImageClick && actualUrl && onImageClick(actualUrl)}
                                    className={`max-w-full rounded-xl object-cover hover:opacity-95 transition-all cursor-pointer  ${isImageLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                                        }`}
                                    style={{ maxHeight: '350px', minWidth: '180px', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                                />
                             ) : isVideo ? (
                                <div 
                                    className="relative group/vid cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (status !== 'processing' && onVideoClick && actualUrl) {
                                            onVideoClick(actualUrl);
                                        }
                                    }}
                                >
                                    {status === 'processing' && (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm rounded-xl">
                                            <Loader2 className="w-6 h-6 text-white animate-spin mb-1" />
                                            <span className="text-white text-[9px] font-bold tracking-widest uppercase">Processing</span>
                                        </div>
                                    )}
                                    
                                    {/* Video Cover Image (Static Cachable Image) */}
                                    <div className="relative overflow-hidden rounded-xl bg-slate-100">
                                        {videoThumbUrl || video_thumbnail ? (
                                            <img 
                                                src={videoThumbUrl || video_thumbnail || ''}
                                                alt="Video cover"
                                                className={`max-w-full rounded-xl object-cover transition-all duration-500 ${status === 'processing' ? 'blur-sm scale-95 opacity-80' : 'hover:opacity-95'}`}
                                                style={{ 
                                                    maxHeight: '300px',
                                                    minWidth: '180px',
                                                    display: 'block'
                                                }}
                                            />
                                        ) : (
                                            <video 
                                                src={actualUrl ? `${actualUrl}#t=3.0` : ''}
                                                crossOrigin="anonymous"
                                                muted 
                                                playsInline
                                                className={`max-w-full rounded-xl object-cover transition-all duration-500 ${status === 'processing' ? 'blur-sm scale-95 opacity-80' : 'hover:opacity-95'}`}
                                                style={{ 
                                                    maxHeight: '300px',
                                                    minWidth: '180px',
                                                    display: 'block'
                                                }}
                                                preload="metadata"
                                                onLoadedData={(e) => {
                                                    // In case the background canvas extractor fails, use the inline video tags to capture
                                                    const video = e.currentTarget;
                                                    if (video.currentTime < 2.9) {
                                                        video.currentTime = 3.0;
                                                    } else {
                                                        const canvas = document.createElement('canvas');
                                                        canvas.width = video.videoWidth;
                                                        canvas.height = video.videoHeight;
                                                        const ctx = canvas.getContext('2d');
                                                        if (ctx) {
                                                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                                            canvas.toBlob(b => {
                                                                if (b && actualUrl) {
                                                                    setVideoThumbUrl(URL.createObjectURL(b));
                                                                    chatDb.cacheMedia(actualUrl + '_thumb', b);
                                                                }
                                                            }, 'image/jpeg', 0.8);
                                                        }
                                                    }
                                                }}
                                            />
                                        )}
                                        
                                        {/* Video Badge (Top Right) */}
                                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md flex items-center gap-1 border border-white/10 shadow-lg">
                                            <svg className="w-2.5 h-2.5 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                            <span className="text-[8px] font-black text-white uppercase tracking-tighter">Video</span>
                                        </div>

                                        {/* Large Center Play Button Overlay */}
                                        {status !== 'processing' && (
                                            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto bg-black/5 hover:bg-black/20 transition-colors">
                                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-xl shadow-2xl border border-white/30 transition-transform active:scale-95 group-hover/vid:scale-110">
                                                     <svg className="w-6 h-6 text-white ml-0.5 fill-current drop-shadow-lg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : isPdf ? (
                                <div className={`flex flex-col gap-2 w-full max-w-[280px] transition-all hover:bg-opacity-95 items-start`}>
                                    {/* Stylized 'Paper' PDF Preview Content */}
                                    <div className="relative w-full overflow-visible group/pdf">
                                        <div className="relative aspect-[4/3] w-full bg-white rounded-xl overflow-hidden shadow-2xl shadow-black/10 transition-transform group-hover/pdf:-translate-y-1 relative z-20 border border-slate-50">
                                            {/* 'Stacked Paper' Layers Effect */}
                                            <div className="absolute -inset-1 bg-slate-100/30 rounded-xl -rotate-1 scale-105 -z-10" />
                                            <div className="absolute -inset-1 bg-slate-200/20 rounded-xl rotate-2 scale-105 -z-10 shadow-sm" />

                                            <iframe
                                                src={actualUrl + "#toolbar=0&navpanes=0&scrollbar=0"}
                                                className="w-full h-[200%] pointer-events-none opacity-90 transition-opacity group-hover/pdf:opacity-100 origin-top"
                                                title="PDF Content"
                                                frameBorder="0"
                                                scrolling="no"
                                                style={{ transform: 'scale(1.2)' }}
                                            />

                                            {/* Paper bottom gradient fade to show it's 'half' */}
                                            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent z-10" />
                                        </div>

                                        {/* Status Overlays */}
                                        {status === 'sending' && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
                                                <Loader2 className="w-5 h-5 text-red-500 animate-spin mb-2" />
                                                <div className="w-full max-w-[120px] h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                    <motion.div
                                                        initial={{ width: "10%" }}
                                                        animate={{ width: "95%" }}
                                                        transition={{ duration: 5, repeat: Infinity }}
                                                        className="h-full bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                                    />
                                                </div>
                                                <span className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-widest">Uploading...</span>
                                            </div>
                                        )}

                                        {/* Click to open overlay */}
                                        {status !== 'sending' && (
                                            <div
                                                onClick={() => onPdfClick?.(actualUrl || "")}
                                                className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover/pdf:opacity-100 transition-opacity bg-black/5 cursor-pointer"
                                            >
                                                <div className="p-2.5 rounded-full bg-white text-red-500 shadow-xl border border-red-50 scale-90 group-hover/pdf:scale-100 transition-transform">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Filename and Meta under content */}
                                    <div className="px-1 py-1 w-full text-left">
                                        <p className={`text-[11px] font-black truncate tracking-tight mb-0.5 ${mine ? "text-white" : "text-slate-800"}`}>
                                            {(() => {
                                                if (file_name) return file_name;
                                                if (file?.file_name) return file.file_name;
                                                // Fallback: extract from URL
                                                try {
                                                    const url = actualUrl || "";
                                                    const parts = url.split('/');
                                                    const last = parts[parts.length - 1];
                                                    // Remove timestamp prefix if it matches our pattern (e.g. 123456789-)
                                                    return last.includes('-') ? last.split('-').slice(1).join('-') : last;
                                                } catch {
                                                    return "Document.pdf";
                                                }
                                            })()}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-bold uppercase tracking-widest ${mine ? "text-white/60" : "text-slate-400"}`}>
                                                PDF Document
                                            </span>
                                            {status !== 'sending' && (
                                                <div className={`w-1 h-1 rounded-full ${mine ? "bg-white/40" : "bg-slate-300"}`} />
                                            )}
                                            {status !== 'sending' && (
                                                <button
                                                    onClick={() => onPdfClick?.(actualUrl || "")}
                                                    className={`text-[9px] font-black uppercase tracking-widest underline decoration-1 underline-offset-2 ${mine ? "text-white hover:text-red-100" : "text-red-500 hover:text-red-600"}`}
                                                >
                                                    View
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : isVoice ? (
                                <div className={`flex items-center gap-3 py-1 min-w-[200px] ${mine ? "text-white" : "text-slate-800"}`}>
                                    <button
                                        onClick={toggleVoicePlayback}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm ${mine ? "bg-white text-rose-500" : "bg-rose-500 text-white"}`}
                                    >
                                        {isVoicePlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                                    </button>

                                    <div className="flex-1 flex flex-col gap-1.5">
                                        <div className="flex items-center gap-1 justify-center h-6">
                                             {[...Array(15)].map((_, i) => (
                                                 <div 
                                                     key={i} 
                                                     className={`w-0.5 rounded-full transition-all duration-300 ${mine ? "bg-white" : "bg-red-500"} ${isVoicePlaying ? 'animate-pulse' : 'opacity-40'}`} 
                                                     style={{ 
                                                         height: `${Math.max(3, Math.random() * 18)}px`,
                                                         animationDelay: `${i * 0.05}s`
                                                     }} 
                                                 />
                                             ))}
                                         </div>
                                    </div>

                                    <audio
                                        ref={voiceAudioRef}
                                        src={actualUrl || ""}
                                        onEnded={() => setIsVoicePlaying(false)}
                                        className="hidden"
                                    />
                                </div>
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
                                    <h4 className={`text-[10px] font-bold uppercase tracking-tight leading-tight line-clamp-2 ${mine ? "text-white" : "text-slate-900"}`}>{product_name}</h4>
                                    <span className={`text-[11px] font-black shrink-0 ml-auto ${mine ? "text-white" : "text-red-600"}`}>₦{Number(product_price || 0).toLocaleString()}</span>
                                </div>
                                {product_variant && (
                                    <p className={`text-[9px] font-bold mt-0.5 whitespace-normal leading-relaxed uppercase tracking-widest ${mine ? "text-white/70" : "text-slate-400"}`}>{product_variant}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Order Reference Tag Card */}
                    {order_ref && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onOrderClick) onOrderClick(order_id || "", order_ref || "");
                            }}
                            className={`mb-3 p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] ${mine
                                ? "bg-white/10 border-white/20 hover:bg-white/20"
                                : "bg-slate-50 border-slate-100 hover:bg-white hover:shadow-sm"
                                }`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`shrink-0 w-11 h-11 rounded-xl overflow-hidden shadow-sm border ${mine ? "bg-white/10 border-white/20" : "bg-white border-slate-100"}`}>
                                        {product_image ? (
                                            <img src={product_image} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center ${mine ? "bg-white/20 text-white" : "bg-red-50 text-red-500"}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0 pr-1">
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${mine ? "text-red-100" : "text-slate-400"}`}>Order Reference</span>
                                        <span className={`text-[11px] font-bold truncate max-w-[120px] ${mine ? "text-white" : "text-slate-900"}`}>{order_ref}</span>
                                    </div>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold shrink-0 ${mine ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}>
                                    DETAILS
                                </div>
                            </div>
                            <div className={`h-[1px] w-full ${mine ? "bg-white/10" : "bg-slate-100"}`} />
                            <p className={`text-[9px] font-medium leading-tight ${mine ? "text-red-100" : "text-slate-500"}`}>
                                Tap to track delivery progress or view order management options.
                            </p>
                        </div>
                    )}

                    {/* Text Content / Caption */}
                    {content && (
                        <div className="relative group/text">
                            <p className={`whitespace-pre-wrap leading-relaxed px-1 p-0 py-0.5 ${actualUrl
                                ? `text-[11px] font-medium leading-tight mt-1 ${mine ? "text-red-50/90" : "text-gray-500"}`
                                : "text-sm"
                                }`}>
                                {content}
                                <span className="inline-flex h-[1px] w-[50px]" />
                            </p>
                            <div className="absolute bottom-0 right-0 flex items-center justify-end gap-1 opacity-70 px-1 pb-0.5">
                                {isEdited && (
                                    <span className={`text-[7px] font-black uppercase tracking-widest ${mine ? "opacity-60" : "opacity-40"}`}>
                                        Edited
                                    </span>
                                )}
                                {sentAt && (
                                    <span className={`text-[7.5px] font-black tabular-nums uppercase ${mine ? "opacity-60" : "opacity-40"}`}>
                                        {new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                                {mine && (
                                    <StatusStatus
                                        status={isRead ? "read" : status === "sending" ? "sending" : status === "sent" ? "sent" : "delivered"}
                                        mine={mine}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Media-only status (when no caption) */}
                    {!content && (
                        <div className={`absolute bottom-1 right-1 flex items-center gap-1 backdrop-blur-md px-1 py-0.5 rounded-full ring-1 ${mine ? "bg-black/10 ring-white/5" : "bg-white/50 ring-black/5"}`}>
                            {isEdited && (
                                <span className={`text-[7px] font-black uppercase tracking-widest ${mine ? "text-white/70" : "text-gray-500/70"}`}>
                                    Edited
                                </span>
                            )}
                            {sentAt && (
                                <span className={`text-[7.5px] font-black tabular-nums uppercase ${mine ? "text-white/90" : "text-gray-500/80"}`}>
                                    {new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {mine && (
                                <StatusStatus
                                    status={isRead ? "read" : status === "sending" ? "sending" : status === "sent" ? "sent" : "delivered"}
                                    mine={mine}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Only for failed messages */}
                {status === 'failed' && (
                    <div
                        className="flex items-center gap-1.5 mt-0.5 mb-0.5 text-[10px] font-bold tracking-tight text-red-500"
                    >
                        <div
                            onClick={onRetry}
                            className="flex items-center gap-1 cursor-pointer hover:underline"
                        >
                            <AlertCircle className="w-3 h-3" />
                            <span>Retry</span>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
