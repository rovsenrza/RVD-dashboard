import type { SignedIn } from '@/entities/types'

/**
 * Thin fetch wrapper. When 1C integration lands, only this file and the
 * adapters in ./adapters change — feature hooks keep the same signatures.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
/**
 * The refresh cookie goes with every call even when the API lives on its own origin
 * (the customer's hosting serves the site only); on the same origin this changes nothing.
 */
const CREDENTIALS: RequestCredentials = 'include'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Sign-in (Д6): the short access token lives here, in memory only; the long
 * refresh token is an httpOnly cookie the browser sends to /auth/refresh.
 * One refresh at a time serves the whole page — restoring the session on load
 * and renewing it mid-session alike: two at once would spend the same refresh
 * token twice.
 */
let accessToken: string | null = null
let renewing: Promise<SignedIn | null> | null = null
let expired: (() => void) | null = null

const renew = () =>
  (renewing ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: CREDENTIALS })
    .then(async (res) => {
      if (!res.ok) return null
      const me = (await res.json()) as SignedIn
      accessToken = me.accessToken
      return me
    })
    .catch(() => null)
    .finally(() => {
      renewing = null
    }))

export const authToken = {
  set: (token: string | null) => {
    accessToken = token || null
  },
  /** The session the refresh cookie holds (a reload, a new tab), or null when there is none. */
  restore: renew,
  /** Called when the session cannot be renewed: the cabinet goes back to the sign-in page. */
  onExpired: (callback: (() => void) | null) => {
    expired = callback
  },
}

/** `url` is final: API paths get the base URL added by the callers below. */
async function send(url: string, init?: RequestInit, again = true): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const res = await fetch(url, { ...init, headers, credentials: CREDENTIALS })
  if (res.status === 401 && again && accessToken && !url.includes('/auth/')) {
    if (await renew()) return send(url, init, false)
    accessToken = null
    expired?.()
  }
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
  }).then((res) => (res.status === 204 ? (undefined as T) : (res.json() as Promise<T>)))

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
