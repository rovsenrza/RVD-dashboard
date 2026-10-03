/**
 * Hybrid mode: the routes the real API (apps/api) already answers come from
 * it — 1С data through its cache — and everything else stays on the mocks.
 * `VITE_LIVE_API=true` turns it on; `VITE_LIVE_PRODUCTS` is its older name.
 */
export const LIVE =
  import.meta.env.VITE_LIVE_API === 'true' || import.meta.env.VITE_LIVE_PRODUCTS === 'true'

/**
 * What apps/api serves. In live mode the mocks let exactly these through and
 * the dev server forwards them; a route joins this list when the BFF has it.
 */
export const LIVE_ROUTES = [
  ['get', '/products'],
  ['get', '/products/:id'],
  ['get', '/products/:id/lifetime'],
  ['get', '/products/:id/history'],
  ['get', '/equipment'],
  ['get', '/equipment/:id'],
  ['get', '/equipment/:id/products'],
  ['get', '/equipment/:id/replacements'],
  ['get', '/dashboard/summary'],
  ['get', '/requests'],
  ['post', '/requests'],
] as const
