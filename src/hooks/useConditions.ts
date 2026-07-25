import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMeteo, type MeteoSpot } from '../services/weather'
import { fetchMarine, type DonneesMarines } from '../services/marine'
import { creerCache, clePoint } from '../lib/cache'
import type { Lieu } from '../types/lieu'

/**
 * Open-Meteo réactualise ses modèles au mieux toutes les 15 min (assimilation
 * horaire pour la plupart). Un rafraîchissement toutes les 10 min garantit
 * qu'on ne rate rien sans marteler l'API ; le cache absorbe les allers-retours
 * entre spots. Voir le README pour les quotas.
 */
const INTERVALLE_MS = 10 * 60 * 1000
const DUREE_CACHE_MS = 9 * 60 * 1000

const cacheMeteo = creerCache<MeteoSpot>(DUREE_CACHE_MS)
const cacheMarine = creerCache<DonneesMarines>(DUREE_CACHE_MS)

const MARINE_VIDE: DonneesMarines = { temperatureEauC: null, hauteurVaguesM: null }

interface EtatConditions {
  meteo: MeteoSpot | null
  marine: DonneesMarines
  chargement: boolean
  erreur: string | null
  misAJourLe: Date | null
}

export function useConditions(lieu: Lieu | null) {
  const [etat, setEtat] = useState<EtatConditions>({
    meteo: null,
    marine: MARINE_VIDE,
    chargement: false,
    erreur: null,
    misAJourLe: null,
  })
  const lieuRef = useRef<Lieu | null>(lieu)
  lieuRef.current = lieu

  const charger = useCallback(async (cible: Lieu, forcer: boolean) => {
    const cle = clePoint(cible.lat, cible.lon)
    setEtat((e) => ({ ...e, chargement: true, erreur: null }))
    try {
      // La météo est indispensable ; les données marines sont un bonus qui ne
      // doit jamais faire échouer l'écran principal.
      const [meteo, marine] = await Promise.all([
        cacheMeteo.resoudre(cle, () => fetchMeteo(cible.lat, cible.lon), forcer),
        cacheMarine.resoudre(cle, () => fetchMarine(cible.lat, cible.lon), forcer),
      ])
      if (lieuRef.current?.id !== cible.id) return
      setEtat({ meteo, marine, chargement: false, erreur: null, misAJourLe: new Date() })
    } catch {
      if (lieuRef.current?.id !== cible.id) return
      setEtat((e) => ({
        ...e,
        chargement: false,
        erreur: 'Impossible de joindre Open-Meteo. Vérifie ta connexion.',
      }))
    }
  }, [])

  useEffect(() => {
    if (!lieu) return
    void charger(lieu, false)

    const minuteur = setInterval(() => void charger(lieu, true), INTERVALLE_MS)

    // On rattrape aussi au retour sur l'onglet : rouvrir le site doit montrer du frais
    const surRetour = () => {
      if (document.visibilityState === 'visible') void charger(lieu, false)
    }
    document.addEventListener('visibilitychange', surRetour)

    return () => {
      clearInterval(minuteur)
      document.removeEventListener('visibilitychange', surRetour)
    }
  }, [lieu, charger])

  const rafraichir = useCallback(() => {
    if (lieu) void charger(lieu, true)
  }, [lieu, charger])

  return { ...etat, rafraichir }
}

/** « il y a 3 min » — se recalcule tout seul pendant que la page reste ouverte */
export function useFraicheur(misAJourLe: Date | null): string | null {
  const [, forcerRendu] = useState(0)

  useEffect(() => {
    const t = setInterval(() => forcerRendu((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (!misAJourLe) return null
  const minutes = Math.floor((Date.now() - misAJourLe.getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes === 1) return 'il y a 1 min'
  if (minutes < 60) return `il y a ${minutes} min`
  return misAJourLe.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
