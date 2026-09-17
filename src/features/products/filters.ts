/** URL contract for the products registry filters, shared by the page and its dialog. */
export const FILTER_KEYS = ['status', 'lifecycle', 'equipment', 'catalog'] as const

export type FilterKey = (typeof FILTER_KEYS)[number]
export type FilterValues = Partial<Record<FilterKey, string>>
