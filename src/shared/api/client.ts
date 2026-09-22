/**
 * Thin fetch wrapper. When 1C integration lands, only this file and the
 * adapters in ./adapters change — feature hooks keep the same signatures.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    // A readable reason from the server (e.g. a 409 conflict) reaches the user as is.
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(
      res.status,
      body?.message ?? `${init?.method ?? 'GET'} ${path} → ${res.status}`,
    )
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
}
