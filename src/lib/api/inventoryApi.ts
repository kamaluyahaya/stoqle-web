// src/lib/api/inventoryApi.ts
import { safeFetch } from "./handler";

const getHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    "Authorization": token ? `Bearer ${token}` : "",
  };
};

export const smartInventoryApi = {
  getSmartInventory: async (params: { search?: string; filter?: string; limit?: number; offset?: number }) => {
    const url = new URL("/api/inventory/smart", "http://localhost/"); // Temporary base for URL constructor
    if (params.search) url.searchParams.append("search", params.search);
    if (params.filter) url.searchParams.append("filter", params.filter);
    if (params.limit) url.searchParams.append("limit", String(params.limit));
    if (params.offset) url.searchParams.append("offset", String(params.offset));

    const finalUrl = url.pathname + url.search;

    return safeFetch(finalUrl, {
      method: "GET",
      headers: getHeaders(),
    });
  },

  quickUpdateStock: async (data: { inventory_id: number; new_quantity: number; reason?: string }) => {
    return safeFetch("/api/inventory/quick-update", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  getAdjustments: async (params: { product_id?: number; inventory_id?: number; search?: string; limit?: number; offset?: number }) => {
    const url = new URL("/api/inventory/adjustments", "http://localhost/");
    if (params.product_id) url.searchParams.append("product_id", String(params.product_id));
    if (params.inventory_id) url.searchParams.append("inventory_id", String(params.inventory_id));
    if (params.limit) url.searchParams.append("limit", String(params.limit));
    if (params.offset) url.searchParams.append("offset", String(params.offset));

    const finalUrl = url.pathname + url.search;

    return safeFetch(finalUrl, {
      method: "GET",
      headers: getHeaders(),
    });
  },
};
