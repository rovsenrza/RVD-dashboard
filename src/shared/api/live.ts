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
  ['post', '/auth/login'],
  ['post', '/auth/refresh'],
  ['post', '/auth/logout'],
  ['post', '/auth/password'],
  ['get', '/me'],
  ['get', '/admin/users'],
  ['post', '/admin/users'],
  ['patch', '/admin/users/:id'],
  ['post', '/admin/users/:id/reset-password'],
  ['get', '/admin/settings'],
  ['patch', '/admin/settings'],
  ['get', '/admin/audit'],
  ['get', '/products'],
  ['get', '/products/:id'],
  ['get', '/products/:id/lifetime'],
  ['get', '/products/:id/history'],
  ['get', '/products/:id/replacements'],
  ['get', '/equipment'],
  ['get', '/equipment/:id'],
  ['get', '/equipment/:id/products'],
  ['get', '/equipment/:id/replacements'],
  ['get', '/dashboard/summary'],
  ['get', '/notifications'],
  ['post', '/notifications/read'],
  ['get', '/me/notification-prefs'],
  ['patch', '/me/notification-prefs'],
  ['get', '/replacements'],
  ['get', '/requests'],
  ['post', '/requests'],
] as const
