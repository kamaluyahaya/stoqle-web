import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Mic, Square, Play, Pause, Trash2, CheckCircle } from "lucide-react";
import { PostModalContext } from "../types";

interface AttachmentVoiceModalProps {
  ctx: PostModalContext;
  onClose: () => void;
  onInsertToken: (token: string, metadata: any) => void;
  onFileSelected?: (file: File) => void;
}

export default function AttachmentVoiceModal({ ctx, onClose, onInsertToken, onFileSelected }: AttachmentVoiceModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [signalLevels, setSignalLevels] = useState<number[]>(new Array(15).fill(4));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Visualizer logic
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

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      startVisualizer(stream);
    } catch (err) {
      console.error("Mic error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopVisualizer();
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
  };

  const handleConfirm = () => {
    if (!audioBlob) return;
    const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
    const token = `[Media: Voice Note]`;
    onInsertToken(token, {
      type: "media",
      id: `voice-${Date.now()}`,
      name: "Voice Note",
      display: token,
      isVoice: true,
      duration: recordingTime
    });
    onFileSelected?.(file);
    onClose();
  };

  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[200] bg-white rounded-t-[1.5rem] flex flex-col max-h-[80vh] sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
              <Mic className="w-4 h-4" />
            </div>
            <h3 className="text-md font-bold text-slate-800 tracking-tight">Voice Note</h3>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 bg-slate-100/50 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-10 flex flex-col items-center justify-center gap-8">
          {audioUrl ? (
            <div className="w-full flex flex-col items-center gap-6">
              <div className="flex items-center gap-3 bg-slate-50 rounded-full px-6 py-4 border border-slate-200 w-full">
                <button
                  onClick={() => {
                    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); }
                    else { audioRef.current?.play(); setIsPlaying(true); }
                  }}
                  className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                </button>
                <div className="flex-1 flex items-center justify-center gap-1.5 h-10">
                  {new Array(20).fill(0).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-300 ${isPlaying ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}
                      style={{ height: isPlaying ? `${10 + Math.random() * 20}px` : '6px' }}
                    />
                  ))}
                </div>
                <button onClick={deleteRecording} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                  <Trash2 size={20} />
                </button>
              </div>
              <span className="text-sm font-bold text-slate-500">Ready to attach • {formatTime(recordingTime)}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-2 h-12">
                {signalLevels.map((h, i) => (
                  <div key={i} className={`w-1.5 rounded-full transition-all duration-75 ${isRecording ? 'bg-rose-500' : 'bg-slate-200'}`} style={{ height: `${h}px` }} />
                ))}
              </div>

              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${isRecording ? 'bg-slate-800 text-white animate-pulse' : 'bg-rose-500 text-white'}`}
              >
                {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={32} />}
              </button>

              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">{isRecording ? "Recording..." : "Tap to start recording"}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">{isRecording ? formatTime(recordingTime) : "Maximum 2 minutes"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-8 pt-2 border-t border-slate-100">
          <button
            onClick={handleConfirm}
            disabled={!audioBlob || isRecording}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-500 text-white text-md font-bold shadow-lg shadow-rose-500/20 disabled:opacity-40 disabled:grayscale transition-all active:scale-[0.98]"
          >
            <CheckCircle className="w-5 h-5" />
            Attach Voice Note
          </button>
        </div>

        <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setIsPlaying(false)} className="hidden" />
      </motion.div>
    </AnimatePresence>
  );
}
