import { useCallback } from 'react'
import type { Lieu } from '../types/lieu'
import { useLocalStorage } from './useLocalStorage'

/**
 * Spots likés par le rider. On mémorise le `Lieu` entier — comme le dernier
 * lieu consulté — et pas seulement un identifiant : un lieu cherché librement
 * (hors base vérifiée) doit pouvoir être liké et retrouvé sans le re-géocoder.
 */
export function useFavoris() {
  const [favoris, setFavoris] = useLocalStorage<Lieu[]>('kitespot.favoris.v1', [])

  const estFavori = useCallback((id: string) => favoris.some((f) => f.id === id), [favoris])

  /** Like si absent, unlike si présent. Le plus récent liké passe en tête. */
  const basculer = useCallback(
    (lieu: Lieu) => {
      setFavoris((liste) =>
        liste.some((f) => f.id === lieu.id)
          ? liste.filter((f) => f.id !== lieu.id)
          : [lieu, ...liste],
      )
    },
    [setFavoris],
  )

  const retirer = useCallback(
    (id: string) => setFavoris((liste) => liste.filter((f) => f.id !== id)),
    [setFavoris],
  )

  return { favoris, estFavori, basculer, retirer }
}
