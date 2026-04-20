import { safeFetch } from "./handler";

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
    return safeFetch("/api/addresses", {
        headers: { Authorization: `Bearer ${token}` }
    });
}

export async function createUserAddress(data: Partial<UserAddress>, token: string) {
    return safeFetch("/api/addresses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
}

export async function updateUserAddress(id: number, data: Partial<UserAddress>, token: string) {
    return safeFetch(`/api/addresses/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
}

export async function deleteUserAddress(id: number, token: string) {
    return safeFetch(`/api/addresses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
    });
}

export async function setDefaultAddress(id: number, token: string) {
    return safeFetch(`/api/addresses/${id}/default`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
    });
}
