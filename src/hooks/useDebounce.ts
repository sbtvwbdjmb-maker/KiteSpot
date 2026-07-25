import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [valeurDebounced, setValeurDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setValeurDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return valeurDebounced
}
