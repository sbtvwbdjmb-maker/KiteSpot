import { useCallback } from 'react'
import spotsData from '../data/spots.json'
import type { Spot } from '../types/spot'
import type { Lieu } from '../types/lieu'
import type { ResultatLieu } from '../services/geocoding'
import { deduireOrientation } from '../services/coastline'
import { useLocalStorage } from './useLocalStorage'

export const SPOTS = spotsData as Spot[]

export function spotVersLieu(spot: Spot): Lieu {
  return {
    id: spot.id,
    nom: spot.name,
    localite: spot.locality,
    pays: spot.country,
    lat: spot.lat,
    lon: spot.lon,
    orientation: spot.orientation,
    sourceOrientation: 'curatee',
    estLagune: spot.type.includes('lagune'),
    type: spot.type,
    niveau: spot.niveau,
    popularite: spot.popularite,
    maree: spot.maree,
    acces: spot.acces,
    notes: spot.notes,
  }
}

export function idGeo(lat: number, lon: number): string {
  return `geo:${lat.toFixed(4)},${lon.toFixed(4)}`
}

/**
 * Résout un lieu cherché en lieu analysable.
 *
 * L'orientation du littoral est déduite du relief autour du point. Quand le
 * relief ne permet pas de trancher (île, tombolo, plaine au niveau de la mer),
 * on laisse l'orientation à null : KiteSpot affiche alors le vent sans se
 * prononcer sur la direction, plutôt que d'annoncer un onshore erroné.
 */
export function useResolutionLieu() {
  // Corrections d'orientation saisies par le rider, mémorisées par lieu
  const [corrections, setCorrections] = useLocalStorage<Record<string, number>>(
    'kitespot.orientations.v1',
    {},
  )

  const resoudre = useCallback(
    async (resultat: ResultatLieu, signal?: AbortSignal): Promise<Lieu> => {
      const id = idGeo(resultat.lat, resultat.lon)

      // Un lieu cherché qui tombe sur un spot curaté récupère ses données vérifiées
      const spotProche = SPOTS.find(
        (s) => Math.abs(s.lat - resultat.lat) < 0.02 && Math.abs(s.lon - resultat.lon) < 0.02,
      )
      if (spotProche) return spotVersLieu(spotProche)

      const correction = corrections[id]
      if (correction !== undefined) {
        return {
          id,
          nom: resultat.nom,
          localite: resultat.localite,
          pays: resultat.pays,
          lat: resultat.lat,
          lon: resultat.lon,
          orientation: correction,
          sourceOrientation: 'manuelle',
          estLagune: false,
        }
      }

      const deduite = await deduireOrientation(resultat.lat, resultat.lon, signal)
      return {
        id,
        nom: resultat.nom,
        localite: resultat.localite,
        pays: resultat.pays,
        lat: resultat.lat,
        lon: resultat.lon,
        orientation: deduite.orientation,
        sourceOrientation: deduite.orientation === null ? 'inconnue' : 'estimee',
        estLagune: false,
      }
    },
    [corrections],
  )

  const corrigerOrientation = useCallback(
    (lieuId: string, orientation: number) =>
      setCorrections((c) => ({ ...c, [lieuId]: orientation })),
    [setCorrections],
  )

  return { resoudre, corrigerOrientation }
}
