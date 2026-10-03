import { useEffect, useState } from 'react'

/** The value once it has stopped changing for `ms`: a search box asks the server once per pause, not per key. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}
