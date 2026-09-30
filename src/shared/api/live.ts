/**
 * Hybrid mode (Д5): everything stays on the mocks except the hose registry,
 * which is read from the real API (VITE_API_BASE_URL) — 1С data in the browser
 * before the rest of the BFF exists. `VITE_LIVE_PRODUCTS=true` turns it on.
 */
export const LIVE_PRODUCTS = import.meta.env.VITE_LIVE_PRODUCTS === 'true'
