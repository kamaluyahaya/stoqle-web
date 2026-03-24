import { API_BASE_URL } from "@/src/lib/config";

export async function fetchUnifiedSearch(query: string, limit = 5, token?: string | null, tab?: string, subTab?: string) {
  const headers: any = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let url = `${API_BASE_URL}/api/search/unified?query=${encodeURIComponent(query)}&limit=${limit}`;
  if (tab) url += `&tab=${tab}`;
  if (subTab) url += `&subTab=${subTab}`;

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function fetchSearchSuggestions(query: string) {
  const res = await fetch(`${API_BASE_URL}/api/search/suggest?query=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function fetchTrendingSearches() {
  const res = await fetch(`${API_BASE_URL}/api/search/trending`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function fetchRecentSearches(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/search/recent`, {
    method: "GET",
    headers: { 
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}
