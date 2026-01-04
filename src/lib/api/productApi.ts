// src/lib/productApi.ts
import { API_BASE_URL } from "@/src/lib/config";

export async function fetchBusinessMe(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/business/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err: any = new Error("fetchBusinessMe failed");
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function postProduct(form: FormData, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // NOTE: Do NOT set Content-Type when sending FormData (browser will set boundary)
    },
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // throw structured error so caller can inspect status/body
    throw { status: res.status, body: json };
  }
  return json;
}
