import { useEffect, useState } from 'react'
import { fetchVentActuel } from '../services/weather'
import { analyserDirection } from '../lib/direction'
import { recommanderVoile } from '../lib/voile'
import { scoreHoraire } from '../lib/scoring'
import type { Spot } from '../types/spot'
import type { Profil } from '../types/profile'

export interface ApercuSpot {
  score: number
  ventNoeuds: number
  directionLabel: string
  voile: number | null
}

/**
 * Charge le vent instantané d'une liste de spots pour alimenter les vignettes.
 * Les échecs individuels sont silencieux : une vignette sans donnée reste
 * simplement muette plutôt que d'afficher une valeur inventée.
 */
export function useApercuSpots(spots: Spot[], profil: Profil) {
  const [apercus, setApercus] = useState<Record<string, ApercuSpot>>({})
  const cle = spots.map((s) => s.id).join(',')

  useEffect(() => {
    if (spots.length === 0) return
    let annule = false

    void Promise.all(
      spots.map(async (spot) => {
        try {
          const vent = await fetchVentActuel(spot.lat, spot.lon)
          const direction = analyserDirection(vent.directionDeg, spot)
          const voile = recommanderVoile(vent.ventNoeuds, profil)
          const score = scoreHoraire(
            {
              heure: new Date().toISOString(),
              ventNoeuds: vent.ventNoeuds,
              rafalesNoeuds: vent.rafalesNoeuds,
              directionDeg: vent.directionDeg,
              temperatureC: vent.temperatureC,
              precipitationMm: 0,
              couvertureNuageusePct: 0,
            },
            spot,
            profil,
          )
          return [
            spot.id,
            {
              score,
              ventNoeuds: vent.ventNoeuds,
              directionLabel: direction.label,
              voile: voile.tailleRetenue,
            },
          ] as const
        } catch {
          return null
        }
      }),
    ).then((resultats) => {
      if (annule) return
      const suivant: Record<string, ApercuSpot> = {}
      for (const r of resultats) if (r) suivant[r[0]] = r[1]
      setApercus(suivant)
    })

    return () => {
      annule = true
    }
    // profil influe sur le score : on recharge quand il change
  }, [cle, profil, spots])

  return apercus
}
