import { API_BASE_URL } from "../config";

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
  const res = await fetch(`${API_BASE_URL}/api/category/me`, {
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Failed to fetch categories (${res.status})`);
  }
  const body = await res.json();
  return body as Category[];
}

export async function postCategory(payload: { category_name: string; description?: string }, token?: string): Promise<Category> {
  const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") || undefined : undefined);
  if (!t) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE_URL}/api/category/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || `Failed to create category (${res.status})`);
  }
  // If API returns created object - return it; otherwise we return a best-effort shape
  return (body && body.category_id) ? body as Category : { category_id: body?.id ?? Date.now(), category_name: payload.category_name, description: payload.description ?? "" } as Category;
}


// src/lib/api/categoryApi.ts
export async function updateCategory(category_id: number, payload: { category_name?: string; description?: string }, token?: string): Promise<Category> {
  const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") || undefined : undefined);
  if (!t) throw new Error("Authentication required");
  const res = await fetch(`${API_BASE_URL}/api/category/${category_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Failed to update category (${res.status})`);
  return body as Category;
}
