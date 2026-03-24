// src/lib/api/orderApi.ts
import { API_BASE_URL } from "@/src/lib/config";

export async function fetchActionableSummary(token: string) {
    const res = await fetch(`${API_BASE_URL}/api/orders/actionable-summary`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}
export async function cancelOrder(id: string | number, data: {
    type: 'entire' | 'shipment' | 'item';
    reason: string;
    explanation?: string;
    cancelledBy?: 'vendor' | 'customer';
    shipment_id?: string | number;
    order_id?: string | number;
}) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/orders/${id}/cancel`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function refundOrder(id: string | number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/orders/${id}/refund`, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}
