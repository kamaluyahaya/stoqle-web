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

export function postProduct(form: FormData, token: string, onProgress?: (percent: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/api/products`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      let json = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch (e) {
        // failed to parse JSON
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json);
      } else {
        reject({ status: xhr.status, body: json || xhr.responseText });
      }
    };

    xhr.onerror = () => {
      reject({ status: 0, body: "Network Error" });
    };

    xhr.send(form);
  });
}

export async function fetchMarketFeed(limit = 100, offset = 0, excludeProduct?: number | string, excludeBusiness?: number | string, hasVideo?: boolean) {
  let url = `${API_BASE_URL}/api/products/market/feed?limit=${limit}&offset=${offset}`;
  if (excludeProduct) url += `&exclude_product=${excludeProduct}`;
  if (excludeBusiness) url += `&exclude_business=${excludeBusiness}`;
  if (hasVideo) url += `&has_video=true`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function fetchProductById(productId: number | string) {
  const res = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function fetchBusinessProducts(businessId: number | string, limit = 6, status?: string, exclude?: number | string) {
  let url = `${API_BASE_URL}/api/products/business/${businessId}?limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (exclude) url += `&exclude=${exclude}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}
