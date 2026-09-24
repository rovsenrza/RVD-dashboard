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

/** `url` is final: API paths get the base URL added by the callers below. */
async function send(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) {
    // A readable reason from the server (e.g. a 409 conflict) reaches the user as is.
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(
      res.status,
      body?.message ?? `${init?.method ?? 'GET'} ${url} → ${res.status}`,
    )
  }
  return res
}

const json = <T>(path: string, method: string, body?: unknown) =>
  send(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((res) => res.json() as Promise<T>)

export const api = {
  get: <T>(path: string) => json<T>(path, 'GET'),
  post: <T>(path: string, body: unknown) => json<T>(path, 'POST', body),
  patch: <T>(path: string, body: unknown) => json<T>(path, 'PATCH', body),
  delete: (path: string) => send(`${BASE_URL}${path}`, { method: 'DELETE' }).then(() => undefined),
  /** Multipart upload; the browser sets the boundary, so no Content-Type here. */
  upload: <T>(path: string, form: FormData) =>
    send(`${BASE_URL}${path}`, { method: 'POST', body: form }).then(
      (res) => res.json() as Promise<T>,
    ),
  /** A file by the URL the server gave for it (an attachment's `url`), as a Blob. */
  file: (url: string) => send(url).then((res) => res.blob()),
}
