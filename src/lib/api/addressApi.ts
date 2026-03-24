import { API_BASE_URL } from "../config";

export interface UserAddress {
    address_id: number;
    title: string | null;
    full_name: string;
    phone: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    country: string;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
    is_default: boolean;
}

export async function fetchUserAddresses(token: string) {
    const res = await fetch(`${API_BASE_URL}/api/addresses`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch addresses");
    return res.json();
}

export async function createUserAddress(data: Partial<UserAddress>, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/addresses`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create address");
    return res.json();
}

export async function updateUserAddress(id: number, data: Partial<UserAddress>, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/addresses/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update address");
    return res.json();
}

export async function deleteUserAddress(id: number, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/addresses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to delete address");
    return res.json();
}

export async function setDefaultAddress(id: number, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/addresses/${id}/default`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to set default address");
    return res.json();
}
