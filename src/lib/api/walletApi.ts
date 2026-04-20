// src/lib/api/walletApi.ts
import { safeFetch } from "./handler";

function getToken(): string {
    return typeof window !== "undefined" ? (localStorage.getItem("token") || "") : "";
}

export async function fetchMyWallet() {
    const token = getToken();
    return safeFetch("/api/wallet/me", {
        method: "GET",
        headers: {
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
}

export async function requestWithdrawal(amount: number) {
    const token = getToken();
    return safeFetch("/api/wallet/withdrawals", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ amount }),
    });
}

export async function fetchWithdrawalHistory() {
    const token = getToken();
    return safeFetch("/api/wallet/withdrawals", {
        method: "GET",
        headers: {
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
}

export async function fetchMyTransactions(limit = 50, offset = 0) {
    const token = getToken();
    return safeFetch(`/api/wallet/transactions?limit=${limit}&offset=${offset}`, {
        method: "GET",
        headers: {
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
}

export async function fetchTransactionDetails(txId: string | number) {
    const token = getToken();
    return safeFetch(`/api/wallet/transactions/${txId}/details`, {
        method: "GET",
        headers: {
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
}

export async function sendDeliveryReminder(transactionId: string | number) {
    const token = getToken();
    return safeFetch("/api/wallet/remind-customer", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ transaction_id: transactionId }),
    });
}

export async function confirmOrderReceipt(escrowId: string | number) {
    const token = getToken();
    return safeFetch("/api/wallet/escrow/confirm-receipt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ escrowId }),
    });
}

export async function confirmCustomerReceipt(orderId: string | number, shipmentId?: string | number) {
    const token = getToken();
    return safeFetch(`/api/orders/${orderId}/confirm-customer-receipt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ shipment_id: shipmentId }),
    });
}

export async function reportOrderProblem(escrowId: string | number, reason: string) {
    const token = getToken();
    return safeFetch("/api/wallet/escrow/report-problem", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ escrowId, reason }),
    });
}

export async function savePaymentAccount(data: any) {
    const token = getToken();
    return safeFetch("/api/wallet/payment-account", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data),
    });
}

export async function fetchMyPaymentAccount() {
    const token = getToken();
    return safeFetch("/api/wallet/payment-account", {
        method: "GET",
        headers: {
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
}

export async function cancelEscrowOrder(escrowId: string | number, reason?: string) {
    const token = getToken();
    return safeFetch("/api/wallet/escrow/cancel", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ escrowId, reason }),
    });
}

export async function walletCheckoutApi(data: { amount: number; pin: string; metadata: any; email?: string; }) {
    const token = getToken();
    const json = await safeFetch("/api/wallet/checkout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data),
    });
    return json;
}
