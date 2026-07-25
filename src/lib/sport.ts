import type { Lieu } from '../types/lieu'
import type { Profil } from '../types/profile'
import type { ConditionsHoraires, MeteoSpot } from '../services/weather'
import type { ConditionsMarines, DonneesMarines } from '../services/marine'
import { analyserConditions, scoreHoraire, type Critere } from './scoring'
import { construireVerdict, type Verdict } from './verdict'
import { analyserSurf } from './surf'
import { construireVerdictSurf } from './verdict-surf'
import { degresVersCardinal, qualiteEnMots } from './direction'
import { scoreDirectionHoule } from './surf'
import { ecartAngulaire } from './geo'

export type Sport = 'kite' | 'surf'

export const SPORTS: { id: Sport; label: string; icone: string }[] = [
  { id: 'kite', label: 'Kite', icone: '🪁' },
  { id: 'surf', label: 'Surf', icone: '🏄' },
]

/** Une valeur affichée dans le bandeau principal */
export interface Lecture {
  icone: string
  valeur: string
  unite: string
  detail?: string
}

export interface AnalyseSport {
  sport: Sport
  /** null quand les données nécessaires manquent : on ne note pas au jugé */
  scoreGlobal: number | null
  verdict: Verdict | null
  criteres: Critere[]
  alertes: string[]
  /** message expliquant pourquoi aucun score n'est calculable */
  indisponible: string | null
  lectures: Lecture[]
  /** direction du vent, pour le cadran */
  directionVentDeg: number
  /** direction de la houle, pour le cadran surf */
  directionHouleDeg: number | null
}

function marineDeLHeure(
  marine: DonneesMarines,
  heure: string,
  estMaintenant: boolean,
): ConditionsMarines | null {
  if (estMaintenant) return marine.actuel
  return marine.previsions.find((p) => p.heure === heure) ?? null
}

/**
 * Point d'entrée unique de l'analyse. Les deux moteurs restent séparés —
 * un bon vent de kite n'est pas un bon vent de surf — mais l'interface les
 * consomme de la même façon.
 */
export function analyserPourSport(
  sport: Sport,
  meteoHoraire: ConditionsHoraires,
  marine: DonneesMarines,
  lieu: Lieu,
  profil: Profil,
  estMaintenant: boolean,
): AnalyseSport {
  if (sport === 'kite') {
    const a = analyserConditions(meteoHoraire, marine, lieu, profil)
    const v = construireVerdict(a)
    return {
      sport,
      scoreGlobal: a.scoreGlobal,
      verdict: v,
      criteres: a.criteres,
      alertes: a.alertes,
      indisponible: null,
      directionVentDeg: meteoHoraire.directionDeg,
      directionHouleDeg: null,
      lectures: [
        {
          icone: '💨',
          valeur: String(Math.round(meteoHoraire.ventNoeuds)),
          unite: 'nds',
          detail: `rafales ${Math.round(meteoHoraire.rafalesNoeuds)}`,
        },
        {
          icone: '🧭',
          // On juge la direction au lieu de laisser le rider traduire « ONO »
          valeur: a.direction ? qualiteEnMots(a.direction.score, 'kite') : '—',
          unite: 'direction',
          detail: a.direction
            ? `${a.direction.label.toLowerCase()} · ${degresVersCardinal(meteoHoraire.directionDeg)}`
            : 'non évaluée',
        },
        {
          icone: '🪁',
          valeur: a.voile.tailleRetenue
            ? String(a.voile.tailleRetenue)
            : a.voile.tailleIdeale
              ? `~${a.voile.tailleIdeale.toFixed(0)}`
              : '—',
          unite: 'm²',
          detail: a.voile.tailleRetenue ? 'dans ton quiver' : 'estimation',
        },
        { icone: '🌡️', valeur: `${Math.round(meteoHoraire.temperatureC)}°`, unite: 'air' },
      ],
    }
  }

  const marineHoraire = marineDeLHeure(marine, meteoHoraire.heure, estMaintenant)
  const a = analyserSurf(meteoHoraire, marineHoraire, lieu, profil, {
    mailleEloignee: marine.mailleEloignee,
    horsCouverture: marine.horsCouverture,
  })
  const v = construireVerdictSurf(a)

  const lectures: Lecture[] = []
  if (marineHoraire) {
    lectures.push({
      icone: '🌊',
      valeur:
        marineHoraire.hauteurVaguesM !== null ? marineHoraire.hauteurVaguesM.toFixed(1) : '—',
      unite: 'm',
      detail: marineHoraire.hauteurVaguesM !== null ? 'hauteur' : 'indisponible',
    })
    lectures.push({
      icone: '⏱️',
      valeur:
        marineHoraire.periodeHouleS !== null
          ? marineHoraire.periodeHouleS.toFixed(0)
          : marineHoraire.periodeVaguesS !== null
            ? marineHoraire.periodeVaguesS.toFixed(0)
            : '—',
      unite: 's',
      detail: 'période',
    })
    const houle = marineHoraire.directionHouleDeg
    lectures.push({
      icone: '🧭',
      valeur:
        houle !== null && lieu.orientation !== null
          ? qualiteEnMots(scoreDirectionHoule(houle, lieu.orientation), 'surf')
          : '—',
      unite: 'houle',
      detail:
        houle !== null
          ? lieu.orientation !== null
            ? `${degresVersCardinal(houle)} · ${Math.round(ecartAngulaire(houle, lieu.orientation))}° d’écart`
            : degresVersCardinal(houle)
          : 'indisponible',
    })
  }
  lectures.push({
    icone: '💨',
    valeur: String(Math.round(meteoHoraire.ventNoeuds)),
    unite: 'nds',
    detail: a.qualiteVent
      ? `${qualiteEnMots(a.qualiteVent.score, 'surf').toLowerCase()} · ${a.qualiteVent.label.toLowerCase()}`
      : undefined,
  })

  return {
    sport,
    scoreGlobal: a.scoreGlobal,
    verdict: v,
    criteres: a.criteres,
    alertes: a.alertes,
    indisponible: a.indisponible,
    directionVentDeg: meteoHoraire.directionDeg,
    directionHouleDeg: marineHoraire?.directionHouleDeg ?? null,
    lectures,
  }
}

/** Score d'une heure pour la timeline. null = données insuffisantes. */
export function scoreHorairePourSport(
  sport: Sport,
  meteoHoraire: ConditionsHoraires,
  marine: DonneesMarines,
  lieu: Lieu,
  profil: Profil,
): number | null {
  if (sport === 'kite') return scoreHoraire(meteoHoraire, lieu, profil)
  const marineHoraire = marine.previsions.find((p) => p.heure === meteoHoraire.heure) ?? null
  return analyserSurf(meteoHoraire, marineHoraire, lieu, profil, {
    mailleEloignee: marine.mailleEloignee,
    horsCouverture: marine.horsCouverture,
  }).scoreGlobal
}

export interface Creneau {
  debut: string
  fin: string
  score: number
}

/**
 * Meilleure fenêtre de 2 à 4 h consécutives entre maintenant et le coucher du
 * soleil. Les heures sans donnée sont ignorées, jamais comblées.
 */
export function meilleurCreneauSport(
  sport: Sport,
  meteo: MeteoSpot,
  marine: DonneesMarines,
  lieu: Lieu,
  profil: Profil,
  maintenant: Date,
): { creneau: Creneau | null; donneesIncompletes: boolean } {
  const fin = new Date(meteo.coucherSoleil).getTime()
  const debut = maintenant.getTime()

  const eligibles = meteo.previsions.filter((h) => {
    const t = new Date(h.heure).getTime()
    return t >= debut - 3600_000 && t <= fin
  })
  if (eligibles.length < 2) return { creneau: null, donneesIncompletes: true }

  const scores = eligibles.map((h) => scoreHorairePourSport(sport, h, marine, lieu, profil))
  const manquants = scores.filter((s) => s === null).length
  if (manquants === scores.length) return { creneau: null, donneesIncompletes: true }

  let meilleur: { i: number; longueur: number; moyenne: number } | null = null
  for (let longueur = 4; longueur >= 2; longueur--) {
    for (let i = 0; i + longueur <= eligibles.length; i++) {
      const tranche = scores.slice(i, i + longueur)
      if (tranche.some((s) => s === null)) continue
      const moyenne = (tranche as number[]).reduce((a, b) => a + b, 0) / longueur
      if (!meilleur || moyenne > meilleur.moyenne + 0.05) meilleur = { i, longueur, moyenne }
    }
  }

  // En dessous de 5/10 de moyenne, il n'y a pas de bon créneau à annoncer
  if (!meilleur || meilleur.moyenne < 5) {
    return { creneau: null, donneesIncompletes: manquants > 0 }
  }

  const tranche = eligibles.slice(meilleur.i, meilleur.i + meilleur.longueur)
  return {
    creneau: {
      debut: tranche[0].heure,
      fin: tranche[tranche.length - 1].heure,
      score: meilleur.moyenne,
    },
    donneesIncompletes: manquants > 0,
  }
}
