import type { Lieu } from '../types/lieu'
import type { NiveauRider, Profil } from '../types/profile'
import type { ConditionsHoraires } from '../services/weather'
import type { ConditionsMarines } from '../services/marine'
import { analyserDirection, type OrientationVent } from './direction'
import { ecartAngulaire } from './geo'
import type { Critere } from './scoring'

export interface AnalyseSurf {
  /** null quand la houle n'est pas connue ici : on ne note pas au jugé */
  scoreGlobal: number | null
  criteres: Critere[]
  alertes: string[]
  /** raison pour laquelle aucun score n'a pu être calculé */
  indisponible: string | null
  qualiteVent: QualiteVentSurf | null
  plageVague: { mini: number; maxi: number }
}

export interface QualiteVentSurf {
  orientation: OrientationVent
  label: string
  score: number
  commentaire: string
}

/**
 * Hauteur de vague exploitable selon le niveau, en mètres (hauteur significative).
 * Seuils regroupés ici pour être ajustables d'un coup d'œil.
 */
export const PLAGES_VAGUE: Record<
  NiveauRider,
  { mini: number; idealMin: number; idealMax: number; maxi: number }
> = {
  débutant: { mini: 0.3, idealMin: 0.5, idealMax: 1.0, maxi: 1.5 },
  intermédiaire: { mini: 0.4, idealMin: 0.8, idealMax: 1.8, maxi: 2.5 },
  confirmé: { mini: 0.5, idealMin: 1.0, idealMax: 2.5, maxi: 3.5 },
  expert: { mini: 0.6, idealMin: 1.2, idealMax: 3.5, maxi: 6 },
}

/**
 * Qualité du vent pour le surf — l'exact inverse du kite.
 * Un vent de terre (offshore) lisse la surface et creuse la vague ; un vent
 * de mer (onshore) la hache et la fait fermer.
 */
const SCORE_ORIENTATION_SURF: Record<OrientationVent, { score: number; commentaire: string }> = {
  offshore: { score: 1, commentaire: 'Vent de terre : surface lisse, vagues bien creusées.' },
  'side-offshore': { score: 0.85, commentaire: 'Vent de trois-quarts sortant : conditions propres.' },
  'side-shore': { score: 0.5, commentaire: 'Vent latéral : surface correcte, un peu de clapot.' },
  'side-onshore': { score: 0.3, commentaire: 'Vent de trois-quarts rentrant : ça commence à hacher.' },
  onshore: { score: 0.15, commentaire: 'Vent de mer : vagues désorganisées qui ferment.' },
}

/**
 * Une houle n'atteint la plage que si elle vient du large. On compare donc sa
 * provenance au cap vers le large : plus l'écart est faible, plus la houle
 * entre droit dans le spot. Au-delà d'un quart de tour, elle longe la côte
 * ou vient de terre, et il ne reste presque rien à l'arrivée.
 */
export function scoreDirectionHoule(
  directionHouleDeg: number,
  orientationLittoral: number,
): number {
  const ecart = ecartAngulaire(directionHouleDeg, orientationLittoral)
  if (ecart <= 30) return 1
  if (ecart <= 60) return 0.85
  if (ecart <= 90) return 0.55
  if (ecart <= 120) return 0.25
  return 0.05
}

function commentaireDirectionHoule(ecart: number): string {
  if (ecart <= 30) return 'Houle bien en face du spot, elle entre droit dedans.'
  if (ecart <= 60) return 'Houle légèrement oblique, elle rentre bien.'
  if (ecart <= 90) return 'Houle de biais : une partie de l’énergie passe à côté.'
  if (ecart <= 120) return 'Houle très oblique, peu d’énergie arrive au bord.'
  return 'Houle mal orientée pour ce spot : elle n’atteint pas la plage.'
}

// Un vent faible reste préférable quelle que soit son orientation
function scoreForceVent(ventNoeuds: number): number {
  if (ventNoeuds < 5) return 1
  if (ventNoeuds < 10) return 0.9
  if (ventNoeuds < 15) return 0.68
  if (ventNoeuds < 20) return 0.45
  if (ventNoeuds < 25) return 0.25
  return 0.1
}

// Score en trapèze sur la hauteur, comme pour le vent en kite
function scoreHauteur(hauteurM: number, niveau: NiveauRider): number {
  const { mini, idealMin, idealMax, maxi } = PLAGES_VAGUE[niveau]
  if (hauteurM <= mini || hauteurM >= maxi) return 0
  if (hauteurM < idealMin) return (hauteurM - mini) / (idealMin - mini)
  if (hauteurM > idealMax) return (maxi - hauteurM) / (maxi - idealMax)
  return 1
}

/**
 * La période sépare une houle formée d'un clapot de vent : sous 7 s, ce sont
 * des vagues levées par le vent local, courtes et sans puissance.
 */
function scorePeriode(periodeS: number): number {
  if (periodeS < 5) return 0.15
  if (periodeS < 7) return 0.35
  if (periodeS < 9) return 0.6
  if (periodeS < 11) return 0.8
  if (periodeS < 13) return 0.95
  return 1
}

const POIDS = {
  hauteur: 0.3,
  periode: 0.18,
  directionHoule: 0.18,
  orientationVent: 0.2,
  forceVent: 0.14,
}

export function analyserSurf(
  meteo: ConditionsHoraires,
  marine: ConditionsMarines | null,
  lieu: Lieu,
  profil: Profil,
  contexte: { mailleLointaine: boolean; horsCouverture: boolean; distanceMailleKm: number | null },
): AnalyseSurf {
  const plage = PLAGES_VAGUE[profil.niveau]
  const vide = (raison: string): AnalyseSurf => ({
    scoreGlobal: null,
    criteres: [],
    alertes: [],
    indisponible: raison,
    qualiteVent: null,
    plageVague: { mini: plage.mini, maxi: plage.maxi },
  })

  // Un plan d'eau fermé n'a pas de houle : le modèle marin y répond quand même,
  // mais avec les valeurs de la mer ouverte voisine. On refuse de les lire
  // plutôt que d'annoncer des vagues là où il n'y en a pas.
  if (lieu.estLagune) {
    return vide(
      'Plan d’eau fermé : il n’y a pas de houle ici. C’est un spot d’eau plate, à regarder côté kite.',
    )
  }
  if (contexte.horsCouverture || !marine || marine.hauteurVaguesM === null) {
    return vide('Le modèle de houle ne couvre pas ce point. Aucun score surf ne peut être calculé.')
  }

  const hauteur = marine.hauteurVaguesM
  // On préfère la période de houle, plus représentative que la période totale
  const periode = marine.periodeHouleS ?? marine.periodeVaguesS

  const direction = analyserDirection(meteo.directionDeg, lieu.orientation, false)
  const qualiteVent: QualiteVentSurf | null = direction
    ? {
        orientation: direction.orientation,
        label: direction.label,
        score: SCORE_ORIENTATION_SURF[direction.orientation].score,
        commentaire: SCORE_ORIENTATION_SURF[direction.orientation].commentaire,
      }
    : null

  const criteres: Critere[] = [
    {
      cle: 'vent',
      label: 'Taille des vagues',
      score: scoreHauteur(hauteur, profil.niveau),
      valeur: `${hauteur.toFixed(1)} m`,
      commentaire: commentaireHauteur(hauteur, profil.niveau),
    },
  ]

  if (periode !== null) {
    criteres.push({
      cle: 'regularite',
      label: 'Période',
      score: scorePeriode(periode),
      valeur: `${periode.toFixed(0)} s`,
      commentaire: commentairePeriode(periode),
    })
  }

  // La houle ne compte que si on connaît l'orientation du littoral
  if (marine.directionHouleDeg !== null && lieu.orientation !== null) {
    const ecart = ecartAngulaire(marine.directionHouleDeg, lieu.orientation)
    criteres.push({
      cle: 'materiel',
      label: 'Orientation de la houle',
      score: scoreDirectionHoule(marine.directionHouleDeg, lieu.orientation),
      valeur: `${Math.round(ecart)}° d’écart`,
      commentaire: commentaireDirectionHoule(ecart),
    })
  }

  if (qualiteVent) {
    criteres.push({
      cle: 'direction',
      label: 'Qualité du vent',
      score: qualiteVent.score,
      valeur: qualiteVent.label,
      commentaire: qualiteVent.commentaire,
    })
  }

  criteres.push({
    cle: 'confort',
    label: 'Force du vent',
    score: scoreForceVent(meteo.ventNoeuds),
    valeur: `${Math.round(meteo.ventNoeuds)} nds`,
    commentaire: commentaireForceVent(meteo.ventNoeuds),
  })

  // Poids renormalisés sur les seuls critères réellement évaluables
  const poidsParCle: Record<string, number> = {
    vent: POIDS.hauteur,
    regularite: POIDS.periode,
    materiel: POIDS.directionHoule,
    direction: POIDS.orientationVent,
    confort: POIDS.forceVent,
  }
  const poidsTotal = criteres.reduce((t, c) => t + poidsParCle[c.cle], 0)
  let score = (criteres.reduce((t, c) => t + c.score * poidsParCle[c.cle], 0) / poidsTotal) * 10

  const alertes: string[] = []

  // Garde-fous : la taille prime sur la moyenne, c'est le facteur de sécurité
  if (hauteur >= plage.maxi) {
    score = Math.min(score, 3)
    alertes.push(
      `Vagues de ${hauteur.toFixed(1)} m : au-dessus de ta plage de ${profil.niveau} (~${plage.maxi} m max).`,
    )
  } else if (hauteur <= plage.mini) {
    score = Math.min(score, 2.4)
  }
  if (!qualiteVent) {
    // Sans orientation du littoral, on ignore si le vent lisse ou hache la vague
    score = Math.min(score, 7)
    alertes.push(
      'Orientation du littoral inconnue ici : la qualité du vent n’est pas évaluée, et la note en tient compte.',
    )
  }
  if (contexte.mailleLointaine && contexte.distanceMailleKm !== null) {
    alertes.push(
      `Point de houle le plus proche à ${Math.round(contexte.distanceMailleKm)} km : lecture approximative pour ce spot.`,
    )
  }
  if (marine.hauteurVaguesVentM !== null && marine.hauteurVaguesVentM > hauteur * 0.6) {
    alertes.push('Mer surtout levée par le vent local : vagues courtes et désordonnées.')
  }
  if (lieu.maree) {
    alertes.push('Spot dépendant de la marée : vérifie l’horaire avant de te déplacer.')
  }

  return {
    scoreGlobal: Math.max(0, Math.min(10, score)),
    criteres,
    alertes,
    indisponible: null,
    qualiteVent,
    plageVague: { mini: plage.mini, maxi: plage.maxi },
  }
}

function commentaireHauteur(h: number, niveau: NiveauRider): string {
  const { mini, idealMin, idealMax, maxi } = PLAGES_VAGUE[niveau]
  if (h <= mini) return 'Trop petit, il n’y a pas de quoi surfer.'
  if (h < idealMin) return 'Petites vagues, ça reste jouable en longboard.'
  if (h <= idealMax) return 'Taille idéale pour ton niveau.'
  if (h < maxi) return 'Gros pour ton niveau, engagement sérieux.'
  return `Au-delà de ${maxi} m, c’est hors plage pour ton niveau.`
}

function commentairePeriode(p: number): string {
  if (p < 7) return 'Période courte : clapot de vent plutôt que houle formée.'
  if (p < 9) return 'Période moyenne, vagues correctes sans grande puissance.'
  if (p < 12) return 'Belle houle, bien organisée.'
  return 'Houle longue et puissante, très bien ordonnée.'
}

function commentaireForceVent(v: number): string {
  if (v < 5) return 'Quasi pas de vent : surface glassy.'
  if (v < 10) return 'Vent léger, la surface reste propre.'
  if (v < 18) return 'Vent sensible, la surface se ride.'
  return 'Vent fort : mer désordonnée.'
}
