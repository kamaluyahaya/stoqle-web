// src/lib/api/walletApi.ts
import { API_BASE_URL } from "@/src/lib/config";

export async function fetchMyWallet() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/me`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function requestWithdrawal(amount: number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/withdrawals`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ amount }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function fetchWithdrawalHistory() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/withdrawals`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function fetchMyTransactions(limit = 50, offset = 0) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/transactions?limit=${limit}&offset=${offset}`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function fetchTransactionDetails(txId: string | number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/transactions/${txId}/details`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}
export async function sendDeliveryReminder(transactionId: string | number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/remind-customer`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ transaction_id: transactionId }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function confirmOrderReceipt(escrowId: string | number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/escrow/confirm-receipt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ escrowId }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function confirmCustomerReceipt(orderId: string | number, shipmentId?: string | number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/confirm-customer-receipt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ shipment_id: shipmentId }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function reportOrderProblem(escrowId: string | number, reason: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/escrow/report-problem`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ escrowId, reason }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function savePaymentAccount(data: any) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/payment-account`, {
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
export async function fetchMyPaymentAccount() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/payment-account`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function cancelEscrowOrder(escrowId: string | number, reason?: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/escrow/cancel`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ escrowId, reason }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function walletCheckoutApi(data: { amount: number; pin: string; metadata: any; email?: string; }) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/api/wallet/checkout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
            throw { status: res.status, body: json, message: "SECURITY_BLOCK:" + (json?.message || "Action restricted") };
        }
        throw { status: res.status, body: json };
    }
    return json;
}
