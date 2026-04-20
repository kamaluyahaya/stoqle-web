import { safeFetch } from "./handler";

// src/lib/api/categoryApi.ts
export type Category = {
  category_id: number;
  business_id?: number;
  category_name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
};


export async function fetchMyCategories(token?: string): Promise<Category[]> {
  const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") || undefined : undefined);
  return safeFetch("/api/category/me", {
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
}

export async function postCategory(payload: { category_name: string; description?: string }, token?: string): Promise<Category> {
  const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") || undefined : undefined);
  if (!t) throw new Error("Authentication required");
  return safeFetch("/api/category/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    },
    body: JSON.stringify(payload),
  });
}


export async function updateCategory(category_id: number, payload: { category_name?: string; description?: string }, token?: string): Promise<Category> {
  const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") || undefined : undefined);
  if (!t) throw new Error("Authentication required");
  return safeFetch(`/api/category/${category_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch global business categories from the database.
 */
export async function fetchBusinessCategories(): Promise<{id: number, name: string, description?: string}[]> {
  return safeFetch("/api/meta/business-categories");
}
