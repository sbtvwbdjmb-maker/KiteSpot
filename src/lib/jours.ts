import type { Lieu } from '../types/lieu'
import type { Profil } from '../types/profile'
import type { MeteoSpot, ConditionsHoraires } from '../services/weather'
import type { DonneesMarines } from '../services/marine'
import { scoreHorairePourSport, type Sport } from './sport'

export interface ResumeJour {
  /** date ISO AAAA-MM-JJ */
  date: string
  label: string
  /** meilleur score atteint dans la journée, entre lever et coucher du soleil */
  meilleurScore: number | null
  /** heure de ce meilleur score */
  meilleureHeure: string | null
  leverSoleil: string
  coucherSoleil: string
  heures: ConditionsHoraires[]
}

function dateISO(instant: string): string {
  return instant.slice(0, 10)
}

function libelleJour(date: string, index: number): string {
  if (index === 0) return 'Auj.'
  if (index === 1) return 'Demain'
  const d = new Date(`${date}T12:00:00`)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${d.getDate()}`
}

/**
 * Découpe les prévisions par journée et calcule, pour chacune, le meilleur
 * score atteignable entre le lever et le coucher du soleil.
 *
 * Le score d'une journée est le meilleur de ses heures de jour : c'est ce qui
 * répond à « est-ce que ça vaut le coup ce jour-là ». Les heures sans donnée
 * sont ignorées, jamais comblées ; une journée entièrement sans donnée garde
 * un score null et sera affichée comme indisponible.
 */
export function resumerJours(
  meteo: MeteoSpot,
  marine: DonneesMarines,
  lieu: Lieu,
  profil: Profil,
  sport: Sport,
): ResumeJour[] {
  const parDate = new Map<string, ConditionsHoraires[]>()
  for (const h of meteo.previsions) {
    const d = dateISO(h.heure)
    const liste = parDate.get(d)
    if (liste) liste.push(h)
    else parDate.set(d, [h])
  }

  return meteo.jours.map((jour, index) => {
    const heures = parDate.get(jour.date) ?? []
    const lever = new Date(jour.leverSoleil).getTime()
    const coucher = new Date(jour.coucherSoleil).getTime()

    let meilleurScore: number | null = null
    let meilleureHeure: string | null = null

    for (const h of heures) {
      const t = new Date(h.heure).getTime()
      // On ne juge une journée que sur ses heures navigables
      if (t < lever || t > coucher) continue
      const score = scoreHorairePourSport(sport, h, marine, lieu, profil)
      if (score === null) continue
      if (meilleurScore === null || score > meilleurScore) {
        meilleurScore = score
        meilleureHeure = h.heure
      }
    }

    return {
      date: jour.date,
      label: libelleJour(jour.date, index),
      meilleurScore,
      meilleureHeure,
      leverSoleil: jour.leverSoleil,
      coucherSoleil: jour.coucherSoleil,
      heures,
    }
  })
}
