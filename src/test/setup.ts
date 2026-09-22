import '@testing-library/jest-dom/vitest'

// jsdom has no layout, so nothing ever resizes; DataTable's overflow cue only needs the API to exist.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
