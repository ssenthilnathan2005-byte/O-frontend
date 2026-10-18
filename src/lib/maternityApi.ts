import { getToken } from "../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() || ""}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data as T;
}

export const maternityApi = {
  list: () => call<any[]>("GET", "/maternity"),
  get: (inwardId: string) => call<{ patient: any; profile: any | null }>("GET", `/maternity/${inwardId}`),
  save: (inwardId: string, data: any) => call<any>("POST", `/maternity/${inwardId}`, data),
  // observations / fetal monitoring
  obsList: (inwardId: string) => call<any>("GET", `/maternity-obs/${inwardId}`),
  obsAdd: (inwardId: string, data: any) => call<any>("POST", `/maternity-obs/${inwardId}`, data),
  obsDelete: (id: string) => call<any>("DELETE", `/maternity-obs/entry/${id}`),
};
