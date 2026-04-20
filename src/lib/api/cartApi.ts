import { safeFetch } from "./handler";

export async function addToCartApi(data: { product_id: number; sku_id?: number | null; variant_option_ids?: string[] | null; quantity: number }, token: string) {
    return safeFetch("/api/cart", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
}

export async function fetchCartApi(token: string) {
    return safeFetch("/api/cart", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function updateCartQuantityApi(cartId: number, quantity: number, token: string) {
    return safeFetch(`/api/cart/${cartId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
    });
}

export async function removeFromCartApi(cartId: number, token: string) {
    return safeFetch(`/api/cart/${cartId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function clearCartApi(token: string) {
    return safeFetch("/api/cart", {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}
