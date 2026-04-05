// src/lib/videoPlaybackManager.ts

type Listener = (activeId: string | null) => void;

type VideoEntry = {
    el: HTMLVideoElement;
    mountedAt: number;
};

class VideoPlaybackManager {
    private activeVideoId: string | null = null;
    private registry = new Map<string, VideoEntry>();
    private listeners = new Set<Listener>();
    private isDebugMode = false;
    private manualPauseMap = new Map<string, boolean>();

    private sanityInterval: ReturnType<typeof setInterval> | null = null;
    private playSessionId = 0;

    constructor() {
        if (typeof window !== "undefined") {
            this.startSanityCheck();
        }
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        listener(this.activeVideoId);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify() {
        for (const listener of this.listeners) {
            listener(this.activeVideoId);
        }
    }

    private log(...args: any[]) {
        if (this.isDebugMode) {
            console.log("[PlaybackManager]", ...args);
        }
    }

    register(id: string, videoElement: HTMLVideoElement) {
        // Remove duplicates pointing to the same DOM element
        for (const [existingId, entry] of this.registry.entries()) {
            if (entry.el === videoElement && existingId !== id) {
                this.registry.delete(existingId);
            }
        }

        this.registry.set(id, {
            el: videoElement,
            mountedAt: Date.now(),
        });

        this.log(`Registered ${id}`);
    }

    unregister(id: string) {
        this.registry.delete(id);

        if (this.activeVideoId === id) {
            this.activeVideoId = null;
            this.notify();
        }

        this.log(`Unregistered ${id}`);
    }

    getActiveVideoId() {
        return this.activeVideoId;
    }

    async authorizeAndPlay(
        videoId: string,
        finalMuted: boolean = false,
        finalVolume: number = 1
    ) {
        const session = ++this.playSessionId;
        const entry = this.registry.get(videoId);

        this.log(`authorizeAndPlay(${videoId}) session=${session}`);

        if (!entry || !entry.el.isConnected) {
            this.log(`Target video not found or not connected: ${videoId}`);
            return;
        }

        const targetVideo = entry.el;

        // Stop everything else immediately.
        this.pauseAllExcept(videoId);

        // Mark as active early so the UI can switch from poster -> video,
        // but playback itself is still gated below.
        this.activeVideoId = videoId;
        this.notify();

        // Wait until the first frame is actually ready to paint.
        // Wait until the first frame is actually ready to paint.
        // We require at least HAVE_FUTURE_DATA (3) to avoid black-screen flickers.
        const ready = await this.waitForFirstPaint(targetVideo, session);
        
        if (!ready || this.playSessionId !== session || this.activeVideoId !== videoId) {
            this.log(`Aborted play for ${videoId} - session or readiness mismatch`);
            // Safety: Ensure this specific element is NOT playing if it lost the session
            targetVideo.pause();
            targetVideo.muted = true;
            return;
        }

        // STEP 2: Force frame render BEFORE sound
        targetVideo.muted = true;
        targetVideo.volume = 0;

        // CRITICAL: Respect manual pause override before starting background playback
        if (this.manualPauseMap.get(videoId)) {
            this.log(`Manual pause active for ${videoId} - skipping .play()`);
            return;
        }

        try {
            await targetVideo.play();
            // Force browser to commit at least one frame paint
            await new Promise(requestAnimationFrame);
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch {
            return;
        }

        // STEP 3: Activate sound AFTER frame is visible
        if (this.activeVideoId === videoId && this.playSessionId === session) {
            targetVideo.muted = finalMuted;
            targetVideo.volume = finalMuted ? 0 : finalVolume;
        }

        this.log(`Playing ${videoId}`, {
            readyState: targetVideo.readyState,
            paused: targetVideo.paused,
            muted: targetVideo.muted,
        });
    }

    /**
     * Proactively start buffering a video without starting playback.
     * Crucial for seamless reels transitions.
     */
    prepare(videoId: string) {
        const entry = this.registry.get(videoId);
        if (!entry) return;

        const video = entry.el;
        
        // Start pre-filling the hardware buffer
        if (video.readyState === 0 && video.src && !video.currentSrc) {
            this.log(`Preparing/Loading ${videoId}`);
            video.load();
        }
    }

    pauseAllExcept(activeId: string) {
        this.log(`Pausing all except ${activeId}`);
        for (const [id, entry] of this.registry.entries()) {
            const video = entry.el;
            if (id !== activeId) {
                // EXTREME RESET: Force stop, mute, volume 0, AND reset time
                video.pause();
                video.muted = true;
                video.volume = 0;
                try {
                    video.currentTime = 0;
                } catch { }
            }
        }
    }

    setManualPause(id: string, isPaused: boolean) {
        this.manualPauseMap.set(id, isPaused);
        if (isPaused) {
            const entry = this.registry.get(id);
            if (entry) entry.el.pause();
        }
    }

    forceSilenceNonActive() {
        const activeId = this.activeVideoId;

        for (const [id, entry] of this.registry.entries()) {
            if (id === activeId) continue;

            const video = entry.el;
            try {
                video.pause();
            } catch { }
            video.muted = true;
            video.volume = 0;
        }
    }

    private waitForFirstPaint(video: HTMLVideoElement, session: number) {
        return new Promise<boolean>((resolve) => {
            if (this.playSessionId !== session) {
                resolve(false);
                return;
            }

            let done = false;
            let timer: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
                if (done) return;
                done = true;

                video.removeEventListener("loadeddata", onReady);
                video.removeEventListener("canplay", onReady);
                video.removeEventListener("playing", onReady);

                if (timer) clearTimeout(timer);
            };

            const finish = () => {
                cleanup();
                resolve(true);
            };

            const onReady = () => {
                if (this.playSessionId !== session) {
                    cleanup();
                    resolve(false);
                    return;
                }

                // Best effort to wait for a painted frame.
                const anyVideo = video as HTMLVideoElement & {
                    requestVideoFrameCallback?: (
                        cb: (now: number, metadata: VideoFrameCallbackMetadata) => void
                    ) => number;
                    cancelVideoFrameCallback?: (handle: number) => void;
                };

                if (typeof anyVideo.requestVideoFrameCallback === "function") {
                    try {
                        anyVideo.requestVideoFrameCallback(() => {
                            finish();
                        });
                        return;
                    } catch {
                        // fall through to rAF
                    }
                }

                requestAnimationFrame(() => finish());
            };

            // If already ready enough (HAVE_FUTURE_DATA), resolve on next paint tick.
            if (video.readyState >= 3) {
                requestAnimationFrame(() => {
                    if (this.playSessionId !== session) {
                        resolve(false);
                        return;
                    }
                    finish();
                });
                return;
            }

            video.addEventListener("loadeddata", onReady, { once: true });
            video.addEventListener("canplay", onReady, { once: true });
            video.addEventListener("playing", onReady, { once: true });

            // Hard timeout so we never hang forever.
            timer = setTimeout(() => {
                if (this.playSessionId !== session) {
                    cleanup();
                    resolve(false);
                    return;
                }
                finish();
            }, 1800);
        });
    }

    private startSanityCheck() {
        this.sanityInterval = setInterval(() => {
            let playingCount = 0;

            for (const [id, entry] of this.registry.entries()) {
                const v = entry.el;

                if (!v.isConnected) {
                    this.registry.delete(id);
                    continue;
                }

                if (!v.paused) {
                    playingCount++;
                    if (id !== this.activeVideoId) {
                        this.log(`Rogue playback detected: ${id}`);
                        try {
                            v.pause();
                        } catch { }
                        v.muted = true;
                        v.volume = 0;
                    }
                }
            }

            if (playingCount > 1) {
                this.log(`Multiple players detected: ${playingCount}`);
                this.forceSilenceNonActive();
            }
        }, 1000);
    }

    private async triggerAsyncPlayback(
        video: HTMLVideoElement,
        videoId: string,
        session: number,
        muted: boolean,
        vol: number
    ) {
        // STEP 1: Wait until frame is actually renderable
        if (video.readyState < 3) {
            await new Promise<void>((resolve) => {
                const onCanPlay = () => {
                    video.removeEventListener("canplay", onCanPlay);
                    resolve();
                };
                video.addEventListener("canplay", onCanPlay);
            });
        }

        // Abort if user already scrolled away
        if (this.playSessionId !== session || this.activeVideoId !== videoId) return;

        // STEP 2: Force frame render BEFORE sound
        video.muted = true;
        video.volume = 0;

        try {
            await video.play();

            // 🚨 FORCE FRAME RENDER (this is the missing piece)
            await new Promise(requestAnimationFrame);

        } catch {
            return;
        }

        // STEP 3: Activate sound AFTER frame is visible
        if (this.activeVideoId === videoId) {
            video.muted = muted;
            video.volume = muted ? 0 : vol;
        }
    }
}

export const videoPlaybackManager = new VideoPlaybackManager();