// src/lib/api/cartApi.ts
import { API_BASE_URL } from "@/src/lib/config";

export async function addToCartApi(data: { product_id: number; sku_id?: number | null; variant_option_ids?: string[] | null; quantity: number }, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/cart`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function fetchCartApi(token: string) {
    const res = await fetch(`${API_BASE_URL}/api/cart`, {
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

export async function updateCartQuantityApi(cartId: number, quantity: number, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/cart/${cartId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function removeFromCartApi(cartId: number, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/cart/${cartId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}

export async function clearCartApi(token: string) {
    const res = await fetch(`${API_BASE_URL}/api/cart`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
}
