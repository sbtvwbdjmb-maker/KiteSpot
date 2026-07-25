import { useCallback, useEffect, useState } from 'react'
import { fetchMeteo, type MeteoSpot } from '../services/weather'
import { fetchMarine, type DonneesMarines } from '../services/marine'
import type { Spot } from '../types/spot'

interface EtatConditions {
  meteo: MeteoSpot | null
  marine: DonneesMarines
  chargement: boolean
  erreur: string | null
  misAJourLe: Date | null
}

const MARINE_VIDE: DonneesMarines = { temperatureEauC: null, hauteurVaguesM: null }

/** Charge météo + données marines d'un spot, et les rafraîchit à la demande */
export function useConditions(spot: Spot | null) {
  const [etat, setEtat] = useState<EtatConditions>({
    meteo: null,
    marine: MARINE_VIDE,
    chargement: false,
    erreur: null,
    misAJourLe: null,
  })

  const charger = useCallback(async (cible: Spot, signal?: AbortSignal) => {
    setEtat((e) => ({ ...e, chargement: true, erreur: null }))
    try {
      // La météo est indispensable, les données marines sont un bonus :
      // on n'échoue jamais parce que l'API marine ne couvre pas le plan d'eau.
      const [meteo, marine] = await Promise.all([
        fetchMeteo(cible.lat, cible.lon),
        fetchMarine(cible.lat, cible.lon),
      ])
      if (signal?.aborted) return
      setEtat({ meteo, marine, chargement: false, erreur: null, misAJourLe: new Date() })
    } catch {
      if (signal?.aborted) return
      setEtat((e) => ({
        ...e,
        chargement: false,
        erreur: 'Impossible de joindre Open-Meteo. Vérifie ta connexion et réessaie.',
      }))
    }
  }, [])

  useEffect(() => {
    if (!spot) return
    const controleur = new AbortController()
    void charger(spot, controleur.signal)
    return () => controleur.abort()
  }, [spot, charger])

  const rafraichir = useCallback(() => {
    if (spot) void charger(spot)
  }, [spot, charger])

  return { ...etat, rafraichir }
}
