import { API_BASE_URL } from "@/src/lib/config";
import { safeFetch } from "./handler";

export async function fetchBusinessMe(token: string) {
  return safeFetch("/api/business/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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

export function patchProduct(productId: number | string, form: FormData, token: string, onProgress?: (percent: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", `${API_BASE_URL}/api/products/${productId}`, true);
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

export async function fetchMarketFeed(limit = 100, offset = 0, excludeProduct?: number | string, excludeBusiness?: number | string, hasVideo?: boolean, token?: string | null, businessCategory?: string) {
  let url = `/api/products/market/feed?limit=${limit}&offset=${offset}`;
  if (excludeProduct) url += `&exclude_product=${excludeProduct}`;
  if (excludeBusiness) url += `&exclude_business=${excludeBusiness}`;
  if (hasVideo) url += `&has_video=true`;
  if (businessCategory && businessCategory !== "For you") url += `&business_category=${encodeURIComponent(businessCategory)}`;

  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  return safeFetch(url, { method: "GET", headers });
}

export async function fetchProductById(productId: number | string, token?: string | null) {
  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  return safeFetch(`/api/products/${productId}`, { method: "GET", headers });
}

export async function fetchBusinessProducts(businessId: number | string, limit = 6, status?: string, exclude?: number | string, token?: string | null) {
  let url = `/api/products/business/${businessId}?limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (exclude) url += `&exclude=${exclude}`;

  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  return safeFetch(url, { method: "GET", headers });
}

export async function toggleProductLike(productId: number | string, token: string) {
  return safeFetch(`/api/products/${productId}/like`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });
}

export function logUserActivity(
  activity: { product_id?: number | string; action_type: 'view' | 'like' | 'cart' | 'purchase'; category?: string; business_id?: number | string },
  token?: string | null
): Promise<void> {
  return new Promise((resolve) => {
    const doLog = () => {
      const headers: any = {
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      safeFetch("/api/activity/log", {
        method: "POST",
        headers,
        body: JSON.stringify(activity),
        keepalive: true,
      }).catch(() => {}); // always silent — never throw

      resolve();
    };

    // On devices that support it, schedule during idle time
    // so this NEVER competes with rendering or user interaction
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(doLog, { timeout: 2000 });
    } else {
      // Fallback: defer 100ms to stay off the critical path
      setTimeout(doLog, 100);
    }
  });
}


export async function fetchBusinessCategories() {
  return safeFetch("/api/meta/business-categories", {
    method: "GET",
  });
}

export async function fetchTrendingProducts(limit = 20, offset = 0) {
  return safeFetch(`/api/activity/trending?limit=${limit}&offset=${offset}`, {
    method: "GET",
  });
}

export async function fetchPersonalizedFeed(limit = 20, offset = 0, token?: string | null, businessCategory?: string | null, isPartner?: boolean, softCategory?: boolean, relatedVendorIds?: number[]) {
  const headers: any = { "Accept": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  let url = `/api/activity/personalized?limit=${limit}&offset=${offset}`;
  if (businessCategory) url += `&business_category=${encodeURIComponent(businessCategory)}`;
  if (isPartner) url += `&is_partner=true`;
  if (softCategory) url += `&soft_category=true`;
  if (relatedVendorIds && relatedVendorIds.length > 0) url += `&related_vendor_ids=${relatedVendorIds.join(',')}`;

  return safeFetch(url, { method: "GET", headers });
}

export async function checkConversionSafety(productId: number | string, token: string) {
  return safeFetch(`/api/products/${productId}/check-conversion-safety`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function convertToVariantProduct(productId: number | string, token: string) {
  return safeFetch(`/api/products/${productId}/convert-to-variant`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function convertToSimpleProduct(productId: number | string, primaryVariantId: number | string, token: string) {
  return safeFetch(`/api/products/${productId}/convert-to-simple`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ primaryVariantId }),
  });
}

export async function checkDeletionSafety(productId: number | string, token: string) {
  return safeFetch(`/api/products/${productId}/check-deletion-safety`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteProduct(productId: number | string, token: string, permanent: boolean = false) {
  return safeFetch(`/api/products/${productId}${permanent ? '?permanent=true' : ''}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
