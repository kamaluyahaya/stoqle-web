// src/lib/api/handler.ts
import { API_BASE_URL } from "@/src/lib/config";

export interface ApiResponse<T = any> {
    status: number;
    body: T;
    isOffline?: boolean;
}

/**
 * Custom Error class for API failures to ensure consistent logging
 * and easy expansion in the console.
 */
export class ApiError extends Error {
    status: number;
    body: any;
    isOffline: boolean;
    source?: string;

    constructor(message: string, status: number, body: any, isOffline: boolean = false, source?: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
        this.isOffline = isOffline;
        this.source = source;

        // Set the prototype explicitly for extending built-in objects in older environments
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    /**
     * Provide a structured format that stringifies well
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            body: this.body,
            isOffline: this.isOffline,
            source: this.source,
        };
    }
}

/**
 * Check if the current environment is offline.
 * Works on both server (RSC) and client contexts.
 */
export function isOffline(): boolean {
    if (typeof window === "undefined") return false; // Server-side: assume online
    return !navigator.onLine;
}

/**
 * A professional fetch wrapper that handles network errors, offline states, 
 * and standardized error responses globally.
 */
export async function safeFetch<T = any>(
    url: string, 
    options: RequestInit = {}
): Promise<T> {
    const source = options.method ? `${options.method} ${url}` : `GET ${url}`;
    
    // Ensure absolute URL if not provided
    const finalUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;

    // Pre-emptive offline check to suppress console noise
    if (isOffline()) {
        throw new ApiError(
            "No internet connection.",
            0,
            { message: "Offline state detected" },
            true,
            source
        );
    }

    try {
        const res = await fetch(finalUrl, {
            ...options,
            headers: {
                "Accept": "application/json",
                ...options.headers,
            },
        });

        // Try to parse JSON but don't crash if it's not JSON
        const json = await res.json().catch(() => null);

        if (!res.ok) {
            throw new ApiError(
                json?.message || `Request failed with status ${res.status}`,
                res.status,
                json || { message: `Status code: ${res.status}` },
                false,
                source
            );
        }

        return json as T;
    } catch (error: any) {
        // If it's already an ApiError, rethrow it
        if (error instanceof ApiError) throw error;

        // If we caught a raw TypeError (failed to fetch) or other network-level error
        const offline = isOffline();
        
        throw new ApiError(
            offline ? "Network connection lost" : (error?.message || "Internal network error"),
            0,
            { originalError: error?.message || "Unknown" },
            offline,
            source
        );
    }
}
