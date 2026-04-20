// src/lib/api/paymentApi.ts
import { safeFetch } from "./handler";

export async function initializePayment(data: { email: string; amount: number; metadata?: any; reference?: string }, token?: string) {
    const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    
    const headers: any = {
        "Content-Type": "application/json",
    };
    if (activeToken) headers["Authorization"] = `Bearer ${activeToken}`;

    return safeFetch("/api/payment/initialize", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
    });
}

export async function verifyPayment(reference: string) {
    return safeFetch(`/api/payment/verify/${reference}`, {
        method: "GET",
    });
}

export async function verifyAndCompleteOrder(reference: string, token?: string) {
    const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    
    const headers: any = {
        "Content-Type": "application/json",
    };
    if (activeToken) headers["Authorization"] = `Bearer ${activeToken}`;

    return safeFetch("/api/payment/verify-and-complete", {
        method: "POST",
        headers,
        body: JSON.stringify({ reference }),
    });
}

export async function recordAbandoned(reference: string, reason: 'cancelled' | 'failed', token?: string, message?: string) {
    const headers: any = {
        "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    return safeFetch("/api/payment/record-abandoned", {
        method: "POST",
        headers,
        body: JSON.stringify({ reference, reason, message }),
    });
}
