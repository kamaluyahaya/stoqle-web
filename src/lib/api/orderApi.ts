// src/lib/api/orderApi.ts
import { safeFetch } from "./handler";

export async function fetchActionableSummary(token: string) {
    return safeFetch("/api/orders/actionable-summary", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
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
    return safeFetch(`/api/orders/${id}/cancel`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data),
    });
}

export async function refundOrder(id: string | number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return safeFetch(`/api/orders/${id}/refund`, {
        method: "POST",
        headers: {
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
}
