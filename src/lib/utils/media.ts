import { API_BASE_URL } from "../config";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

/**
 * Centered utility to format URLs for media assets (images/videos).
 * Handles:
 * 1. Absolute URLs (keeps them as is)
 * 2. Relative URLs (resolves against API_BASE_URL)
 * 3. Localhost Dynamic Replacement: On real devices, if the URL contains 'localhost', 
 *    it replaces it with the current window host IP so resources load correctly.
 */
export const formatUrl = (url: string | undefined): string => {
    if (!url) return NO_IMAGE_PLACEHOLDER;
    
    let formatted = url;
    
    // Resolve relative paths
    if (!url.startsWith("http") && !url.startsWith("blob:") && !url.startsWith("data:")) {
        const baseUrl = API_BASE_URL?.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
        const normalizedPath = url.startsWith("/") ? url : `/${url}`;
        
        formatted = normalizedPath.startsWith("/public") 
            ? `${baseUrl}${normalizedPath}` 
            : `${baseUrl}/public${normalizedPath}`;
    }

    // 2. Handle localhost/IP replacement for cross-device access
    // This should only happen if we are NOT on localhost ourselves OR if we specifically want to point to the backend's IP
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '';

    // If original URL is localhost but current browser is NOT localhost (e.g. browsing from phone)
    if (!isLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(formatted)) {
        try {
            const baseUrl = (API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
            if (baseUrl) {
                const targetUrl = new URL(baseUrl);
                const targetHostname = targetUrl.hostname;
                if (targetHostname && targetHostname !== 'localhost' && targetHostname !== '127.0.0.1') {
                    // Replace ONLY the hostname, preserving the port
                    formatted = formatted.replace(/(localhost|127\.0\.0\.1)/, targetHostname);
                }
            }
        } catch (e) {
            console.warn("Localhost replacement failed:", e);
        }
    } else if (isLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(formatted)) {
        // If we ARE on localhost, avoid forcing the port of API_BASE_URL onto other local URLs
        // The old code was: formatted = formatted.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, targetBase);
        // We now just leave it as is, which keeps port 3000 URLs as port 3000.
    }
    
    // Final safety: encode URI to handle spaces or special chars
    try {
        return encodeURI(formatted);
    } catch (e) {
        return formatted;
    }
};

export const isVideoUrl = (u?: string): boolean => {
    if (!u) return false;
    const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
    return VIDEO_EXT_RE.test(u);
};
