// src/lib/api/inventoryApi.ts
import { API_BASE_URL } from "@/src/lib/config";

const getHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": token ? `Bearer ${token}` : "",
  };
};

export const smartInventoryApi = {
  getSmartInventory: async (params: { search?: string; filter?: string; limit?: number; offset?: number }) => {
    const url = new URL(`${API_BASE_URL}/api/inventory/smart`);
    if (params.search) url.searchParams.append("search", params.search);
    if (params.filter) url.searchParams.append("filter", params.filter);
    if (params.limit) url.searchParams.append("limit", String(params.limit));
    if (params.offset) url.searchParams.append("offset", String(params.offset));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
  },

  quickUpdateStock: async (data: { inventory_id: number; new_quantity: number; reason?: string }) => {
    const res = await fetch(`${API_BASE_URL}/api/inventory/quick-update`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
  },

  getAdjustments: async (params: { product_id?: number; inventory_id?: number; search?: string; limit?: number; offset?: number }) => {
    const url = new URL(`${API_BASE_URL}/api/inventory/adjustments`);
    if (params.product_id) url.searchParams.append("product_id", String(params.product_id));
    if (params.inventory_id) url.searchParams.append("inventory_id", String(params.inventory_id));
    if (params.limit) url.searchParams.append("limit", String(params.limit));
    if (params.offset) url.searchParams.append("offset", String(params.offset));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, body: json };
    return json;
  },
};
