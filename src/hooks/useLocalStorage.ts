import { useCallback, useState } from 'react'

/**
 * Vérifie que le navigateur laisse *vraiment* écrire et relire le stockage
 * local. En navigation privée (Safari notamment) ou quand les données de site
 * sont bloquées, `setItem` échoue : les réglages tiennent le temps de la
 * visite, mais sont oubliés au rafraîchissement. On teste par une sonde
 * écrite-puis-relue plutôt que par la simple présence de l'objet.
 */
export function stockagePersistant(): boolean {
  try {
    const cle = '__kitespot_sonde__'
    window.localStorage.setItem(cle, '1')
    const ok = window.localStorage.getItem(cle) === '1'
    window.localStorage.removeItem(cle)
    return ok
  } catch {
    return false
  }
}

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
