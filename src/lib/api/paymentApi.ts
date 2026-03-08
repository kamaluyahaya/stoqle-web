// src/lib/api/paymentApi.ts
import { API_BASE_URL } from "@/src/lib/config";

export async function initializePayment(data: { email: string; amount: number; metadata?: any; reference?: string }) {
    const res = await fetch(`${API_BASE_URL}/api/payment/initialize`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function verifyPayment(reference: string) {
    const res = await fetch(`${API_BASE_URL}/api/payment/verify/${reference}`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function verifyAndCompleteOrder(reference: string) {
    const res = await fetch(`${API_BASE_URL}/api/payment/verify-and-complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({ reference }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}
