"use client";

import React, { useEffect } from "react";
import { toast } from "sonner";
import { isOffline } from "@/src/lib/api/handler";

/**
 * StabilityProvider is a global singleton component that manages 
 * application stability, network state transitions, and unhandled 
 * error reporting.
 */
export default function StabilityProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // ─── Network Status Management ───────────────────────────────────────────
        const handleOnline = () => {
            toast.success("Connection restored! Back online.", {
                id: "network-status",
                duration: 4000,
            });
            // Optional: Trigger a global refresh of failed data here
            window.dispatchEvent(new CustomEvent("stoqle:online"));
        };

        const handleOffline = () => {
            toast.warning("Network connection lost. Some features may be limited.", {
                id: "network-status",
                duration: Infinity, // Stay until manually closed or back online
            });
            window.dispatchEvent(new CustomEvent("stoqle:offline"));
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // ─── Global Error Interception ───────────────────────────────────────────
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            // Prevent the browser from logging the default unhandled rejection if it's our ApiError or offline-related
            const reason = event.reason;
            
            if (reason && typeof reason === "object") {
                const isApiError = reason.name === "ApiError" || reason.isOffline;
                
                // If it's a known API error during background tasks, we handle it silently
                if (isApiError) {
                    if (isOffline()) {
                        event.preventDefault(); // Stop standard crash
                        console.debug("[Stability] Suppressed unhandled offline rejection:", reason);
                        return;
                    }
                }
            }

            // For genuinely unknown crashes, log structured data
            console.error("[Stability] Unhandled Rejection Caught:", {
                message: reason?.message || "Unknown error",
                stack: reason?.stack,
                status: "uncaught",
            });
        };

        const handleRuntimeError = (event: ErrorEvent) => {
            // Log structured runtime errors
            console.error("[Stability] Runtime Error Caught:", {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
            });
        };

        window.addEventListener("unhandledrejection", handleUnhandledRejection);
        window.addEventListener("error", handleRuntimeError);

        // Initial check
        if (!navigator.onLine) handleOffline();

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            window.removeEventListener("error", handleRuntimeError);
        };
    }, []);

    return <>{children}</>;
}
