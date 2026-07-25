import { useCallback, useState } from 'react'

/** Petit wrapper localStorage tolérant : si le stockage est indisponible, on reste en mémoire */
export function useLocalStorage<T>(cle: string, valeurInitiale: T) {
  const [valeur, setValeurInterne] = useState<T>(() => {
    try {
      const brut = window.localStorage.getItem(cle)
      return brut ? (JSON.parse(brut) as T) : valeurInitiale
    } catch {
      return valeurInitiale
    }
  })

  const setValeur = useCallback(
    (maj: T | ((precedent: T) => T)) => {
      setValeurInterne((precedent) => {
        const suivant = typeof maj === 'function' ? (maj as (p: T) => T)(precedent) : maj
        try {
          window.localStorage.setItem(cle, JSON.stringify(suivant))
        } catch {
          // navigation privée ou quota plein : on garde la valeur en mémoire
        }
        return suivant
      })
    },
    [cle],
  )

  return [valeur, setValeur] as const
}
