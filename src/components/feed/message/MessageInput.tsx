import { Send, Mic, Square, Play, Pause, Trash2, Volume2, Smile, X as CloseIcon } from "lucide-react";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useAudio } from "@/src/context/audioContext";
import { motion, AnimatePresence } from "framer-motion";

const EMOJI_PICKER_LIST = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😮‍💨", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤔", "🤭", "🥱", "🤗", "🤫", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟",
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🤜", "🤛", "🙌", "👐", "🤲", "🤝", "🙏", "👏", "🖐", "✋", "🖖", "👋", "✍️", "💅", "🤳", "💪", "🦾"
];

type MessageInputProps = {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    onFileSelect: (file: File | null) => void;
    isSending: boolean;
    selectedFile?: File | null;
    filePreview?: string | null;
    onCancelFile?: () => void;
    alwaysAllowSend?: boolean;
    hideEmojis?: boolean;
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
    alwaysAllowSend = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [signalLevels, setSignalLevels] = useState<number[]>(new Array(15).fill(4));
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const { playingAudioId, registerPlayback } = useAudio();

    // ⚡ CONCURRENCY CONTROL: Stop playing if another audio starts
    useEffect(() => {
        if (playingAudioId !== 'preview_recording' && isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        }
    }, [playingAudioId, isPlaying]);

    // Waveform visualizer logic
    const startVisualizer = (stream: MediaStream) => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 64;
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const update = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);

            // Map frequencies to 15 bar levels (scaled 2-24px)
            const newLevels = Array.from({ length: 15 }, (_, i) => {
                const val = dataArray[i * 2] || 0;
                return 4 + (val / 255) * 20;
            });
            setSignalLevels(newLevels);
            animationFrameRef.current = requestAnimationFrame(update);
        };
        update();
    };

    const stopVisualizer = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        setSignalLevels(new Array(15).fill(4));
    };

    // Recording duration timer
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingTime(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);

                // Pass it up as a file so existing logic handles it
                const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
                onFileSelect(file);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            startVisualizer(stream);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopVisualizer();
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            audioChunksRef.current = [];
            setIsRecording(false);
            setAudioBlob(null);
            setAudioUrl(null);
            stopVisualizer();
        }
    };

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            registerPlayback(null);
        } else {
            registerPlayback('preview_recording');
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const deleteRecording = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(null);
        setAudioUrl(null);
        setIsPlaying(false);
        onCancelFile?.();
    };

    // Clean up on component unmount
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    // ⚡ DYNAMIC HEIGHT & FOCUS: When value changes (like auto-fill), update height and position cursor
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

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
        // Support Cmd+Enter or Ctrl+Enter for sending on desktop
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            if (value.trim() || selectedFile || audioUrl || alwaysAllowSend) {
                e.preventDefault();
                onSend();
            }
        }
    };

    return (
        <div className="flex flex-col w-full gap-1 overflow-hidden">
            <div className="w-full p-1 border-gray-100 flex items-end gap-3">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5  rounded-full bg-gray-50 text-gray-500 hover:bg-rose-50 hover:text-rose-500 transition-colors shadow-sm"
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
                    {audioUrl ? (
                        <div className="flex items-center gap-3 bg-gray-50 rounded-3xl px-4 py-2 border border-slate-200 animate-in fade-in slide-in-from-bottom-2">
                            <button
                                onClick={togglePlayback}
                                className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                            >
                                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                            </button>

                            <div className="flex-1 h-8 flex items-center justify-center gap-1 overflow-hidden px-4">
                                {signalLevels.map((h, i) => (
                                    <div
                                        key={i}
                                        className={`w-1 rounded-full transition-all duration-75 ${isPlaying ? 'bg-rose-500 animate-pulse' : 'bg-gray-300'}`}
                                        style={{ height: `${isPlaying ? Math.max(4, Math.random() * 20) : 4}px` }}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={deleteRecording}
                                className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>

                            <audio
                                ref={audioRef}
                                src={audioUrl}
                                onEnded={() => setIsPlaying(false)}
                                className="hidden"
                            />
                        </div>
                    ) : isRecording ? (
                        <div className="flex items-center gap-3 bg-rose-50 rounded-3xl px-4 py-2 border border-rose-100 animate-in slide-in-from-left-2">
                            <div className="flex items-center gap-1 min-w-[60px] justify-center">
                                {signalLevels.map((h, i) => (
                                    <div key={i} className="w-1 bg-rose-500 rounded-full transition-all duration-75" style={{ height: `${h}px` }} />
                                ))}
                            </div>
                            <span className="flex-1 text-xs font-bold text-rose-500">Recording...</span>
                            <span className="text-[10px] font-bold text-rose-500 tabular-nums">{formatTime(recordingTime)}</span>
                            <button onClick={cancelRecording} className="text-[10px]  tracking-widest font-black text-rose-400">Cancel</button>
                        </div>
                    ) : (
                        <textarea
                            ref={textareaRef}
                            onFocus={(e) => {
                                setIsFocused(true);
                                // Move cursor to end on focus
                                const val = e.target.value;
                                e.target.setSelectionRange(val.length, val.length);
                            }}
                            onBlur={() => {
                                // Slight delay to allow emoji click to fire before hiding
                                setTimeout(() => setIsFocused(false), 200);
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
        caret-rose-500
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
                    )}
                </div>

                <div
                    className="relative shrink-0"
                    onMouseDown={() => !value.trim() && !selectedFile && !audioUrl && startRecording()}
                    onMouseUp={() => stopRecording()}
                    onMouseLeave={() => stopRecording()}
                    onTouchStart={(e) => {
                        if (!value.trim() && !selectedFile && !audioUrl) {
                            e.preventDefault();
                            startRecording();
                        }
                    }}
                    onTouchEnd={(e) => {
                        if (isRecording) {
                            e.preventDefault();
                            stopRecording();
                        }
                    }}
                >
                    <button
                        onClick={() => {
                            if (value.trim() || selectedFile || audioUrl || alwaysAllowSend) {
                                onSend();
                                setAudioBlob(null);
                                setAudioUrl(null);
                            }
                        }}
                        disabled={isSending}
                        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all font-semibold shadow-md active:scale-95 disabled:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed group
                            ${isRecording ? 'bg-rose-500 scale-125 shadow-rose-200' : (value.trim() || selectedFile || audioUrl || alwaysAllowSend) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}
                        `}
                    >
                        {isSending ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : isRecording ? (
                            <Volume2 className="h-4 w-4 animate-pulse text-white" />
                        ) : (value.trim() || selectedFile || audioUrl) ? (
                            <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        ) : (
                            <Mic className="h-4 w-4" />
                        )}
                    </button>

                    {isRecording && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap animate-bounce">
                            Release to finish recording
                        </div>
                    )}
                </div>

                {/* ⚡ Emoji Trigger */}
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowEmojiPicker(!showEmojiPicker);
                        }}
                        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-90 ${showEmojiPicker ? 'bg-rose-100 text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Smile className="h-5 w-5" />
                    </button>

                    <AnimatePresence>
                        {showEmojiPicker && (
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowEmojiPicker(false)}
                                    className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                                />
                                <motion.div
                                    ref={emojiPickerRef}
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="relative w-full max-w-[320px] bg-white rounded-3xl shadow-2xl overflow-hidden p-5"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Emojis</h3>
                                        <button
                                            onClick={() => setShowEmojiPicker(false)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-rose-500 transition-colors"
                                        >
                                            <CloseIcon className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-6 gap-2 max-h-[350px] overflow-y-auto no-scrollbar pb-2">
                                        {EMOJI_PICKER_LIST.map((emoji, idx) => (
                                            <button
                                                key={`${emoji}-${idx}`}
                                                type="button"
                                                onClick={() => {
                                                    onChange(value + emoji);
                                                    // For better UX, we don't auto-close so they can type multiple emojis
                                                }}
                                                className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 rounded-xl text-2xl transition-all active:scale-90"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end">
                                        <button
                                            onClick={() => setShowEmojiPicker(false)}
                                            className="px-6 py-2 bg-rose-500 text-white text-xs font-bold rounded-full shadow-lg shadow-rose-200 active:scale-95 transition-all"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
