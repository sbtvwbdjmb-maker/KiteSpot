import type { Spot } from '../types/spot'
import type { Profil, NiveauRider } from '../types/profile'
import type { ConditionsHoraires, MeteoSpot } from '../services/weather'
import type { DonneesMarines } from '../services/marine'
import { analyserDirection, type AnalyseDirection } from './direction'
import { recommanderVoile, type RecoVoile } from './voile'

export type CleCritere = 'vent' | 'direction' | 'regularite' | 'materiel' | 'confort'

export interface Critere {
  cle: CleCritere
  label: string
  /** entre 0 et 1 */
  score: number
  /** la valeur mesurée, affichée telle quelle */
  valeur: string
  commentaire: string
}

/** Le facteur qui plafonne réellement la note, quand il y en a un */
export type Limitation =
  | 'vent-faible'
  | 'vent-fort-pour-niveau'
  | 'tempete'
  | 'vent-de-terre'
  | null

export interface AnalyseConditions {
  /** note globale sur 10 */
  scoreGlobal: number
  criteres: Critere[]
  direction: AnalyseDirection
  voile: RecoVoile
  alertes: string[]
  limitation: Limitation
  /** plage de vent exploitable pour le niveau du rider, en nœuds */
  plageVent: { mini: number; maxi: number }
}

/**
 * Plage de vent exploitable selon le niveau du rider, en nœuds.
 * Un débutant est vite débordé au-delà de 20 nœuds là où un confirmé
 * continue à s'amuser jusqu'à 35.
 */
const PLAGES_VENT: Record<NiveauRider, { mini: number; idealMin: number; idealMax: number; maxi: number }> = {
  débutant: { mini: 10, idealMin: 14, idealMax: 19, maxi: 24 },
  intermédiaire: { mini: 11, idealMin: 16, idealMax: 26, maxi: 34 },
  confirmé: { mini: 12, idealMin: 18, idealMax: 32, maxi: 44 },
}

// Score en trapèze : 0 hors plage, 1 sur le palier idéal, progressif entre les deux
function scoreVent(ventNoeuds: number, niveau: NiveauRider): number {
  const { mini, idealMin, idealMax, maxi } = PLAGES_VENT[niveau]
  if (ventNoeuds <= mini || ventNoeuds >= maxi) return 0
  if (ventNoeuds < idealMin) return (ventNoeuds - mini) / (idealMin - mini)
  if (ventNoeuds > idealMax) return (maxi - ventNoeuds) / (maxi - idealMax)
  return 1
}

/**
 * Régularité du vent, déduite du rapport rafales / vent moyen.
 * Un facteur de rafale au-delà de 1,4 signale un vent haché, pénible et piégeux.
 */
function scoreRegularite(vent: number, rafales: number, niveau: NiveauRider): number {
  if (vent <= 0) return 0
  const facteur = rafales / vent
  // Un vent vraiment lisse tourne autour de 1,1 de facteur de rafale.
  // Au-delà de 1,5 il devient haché, au-delà de 1,75 il est piégeux.
  let score: number
  if (facteur <= 1.1) score = 1
  else if (facteur <= 1.3) score = 1 - ((facteur - 1.1) / 0.2) * 0.15
  else if (facteur <= 1.5) score = 0.85 - ((facteur - 1.3) / 0.2) * 0.25
  else if (facteur <= 1.75) score = 0.6 - ((facteur - 1.5) / 0.25) * 0.3
  else score = 0.2
  // Un débutant subit bien plus les rafales qu'un rider confirmé
  if (niveau === 'débutant') score = score ** 1.5
  return Math.max(0, Math.min(1, score))
}

function scoreConfort(conditions: ConditionsHoraires): number {
  const t = conditions.temperatureC
  let scoreTemp: number
  if (t < 5) scoreTemp = 0.2
  else if (t < 12) scoreTemp = 0.2 + ((t - 5) / 7) * 0.5
  else if (t < 18) scoreTemp = 0.7 + ((t - 12) / 6) * 0.3
  else if (t <= 30) scoreTemp = 1
  else scoreTemp = Math.max(0.5, 1 - ((t - 30) / 10) * 0.5)

  const p = conditions.precipitationMm
  let scorePluie: number
  if (p === 0) scorePluie = 1
  else if (p <= 0.5) scorePluie = 0.85
  else if (p <= 2) scorePluie = 0.6
  else scorePluie = 0.3

  return scoreTemp * 0.6 + scorePluie * 0.4
}

const SCORE_ADEQUATION: Record<RecoVoile['adequation'], number> = {
  ideale: 1,
  acceptable: 0.8,
  limite: 0.5,
  aucune: 0.15,
}

const POIDS: Record<CleCritere, number> = {
  vent: 0.3,
  direction: 0.28,
  regularite: 0.16,
  materiel: 0.16,
  confort: 0.1,
}

export function analyserConditions(
  meteo: MeteoSpot,
  marine: DonneesMarines,
  spot: Spot,
  profil: Profil,
): AnalyseConditions {
  const actuel = meteo.actuel
  const direction = analyserDirection(actuel.directionDeg, spot)
  const voile = recommanderVoile(actuel.ventNoeuds, profil)

  const sVent = scoreVent(actuel.ventNoeuds, profil.niveau)
  const sRegularite = scoreRegularite(actuel.ventNoeuds, actuel.rafalesNoeuds, profil.niveau)
  const sConfort = scoreConfort(actuel)
  const sMateriel = SCORE_ADEQUATION[voile.adequation]

  const facteurRafale = actuel.ventNoeuds > 0 ? actuel.rafalesNoeuds / actuel.ventNoeuds : 0

  const criteres: Critere[] = [
    {
      cle: 'vent',
      label: 'Force du vent',
      score: sVent,
      valeur: `${Math.round(actuel.ventNoeuds)} nds`,
      commentaire: commentaireVent(actuel.ventNoeuds, profil.niveau),
    },
    {
      cle: 'direction',
      label: 'Direction',
      score: direction.score,
      valeur: direction.label,
      commentaire: direction.commentaire,
    },
    {
      cle: 'regularite',
      label: 'Régularité',
      score: sRegularite,
      valeur: `rafales ${Math.round(actuel.rafalesNoeuds)} nds`,
      commentaire: commentaireRegularite(facteurRafale),
    },
    {
      cle: 'materiel',
      label: 'Matériel',
      score: sMateriel,
      valeur: voile.tailleRetenue ? `${voile.tailleRetenue} m²` : '—',
      commentaire: voile.message,
    },
    {
      cle: 'confort',
      label: 'Confort',
      score: sConfort,
      valeur: `${Math.round(actuel.temperatureC)} °C`,
      commentaire: commentaireConfort(actuel, marine),
    },
  ]

  let score = criteres.reduce((total, c) => total + c.score * POIDS[c.cle], 0) * 10

  const alertes: string[] = []
  const plage = PLAGES_VENT[profil.niveau]
  let limitation: Limitation = null

  // Garde-fous de sécurité : ils priment sur la moyenne pondérée, pour éviter
  // qu'un bon score matériel ou météo ne rattrape un vent inexploitable.
  if (direction.danger) {
    score = Math.min(score, 3.5)
    limitation = 'vent-de-terre'
    alertes.push(
      direction.orientation === 'offshore'
        ? 'Vent de terre : tu dérives vers le large. Ne navigue pas sans assistance.'
        : 'Vent sortant : reste près du bord et navigue accompagné.',
    )
  }
  if (actuel.ventNoeuds > 38) {
    score = Math.min(score, 2.8)
    limitation = 'tempete'
    alertes.push('Vent de tempête : au-delà de ce qui se navigue raisonnablement.')
  } else if (actuel.ventNoeuds >= plage.maxi) {
    // Hors plage par le haut : dangereux même si la voile du quiver "colle"
    score = Math.min(score, 3.2)
    limitation = limitation ?? 'vent-fort-pour-niveau'
    alertes.push(
      `Vent trop fort pour un niveau ${profil.niveau} : ${Math.round(actuel.ventNoeuds)} nœuds dépassent ta plage (~${plage.maxi} nds max).`,
    )
  } else if (actuel.ventNoeuds <= plage.mini) {
    score = Math.min(score, 2.4)
    limitation = limitation ?? 'vent-faible'
  }
  if (facteurRafale > 1.6 && actuel.ventNoeuds >= 10) {
    alertes.push('Vent très rafaleux : écarts brutaux entre les rafales et le vent moyen.')
  }
  if (spot.maree) {
    alertes.push('Spot dépendant de la marée : vérifie l’horaire avant de te déplacer.')
  }
  if (profil.niveau === 'débutant' && spot.niveau === 'confirmé') {
    alertes.push('Spot classé confirmé : engagement au-dessus de ton niveau déclaré.')
  }

  return {
    scoreGlobal: Math.max(0, Math.min(10, score)),
    criteres,
    direction,
    voile,
    alertes,
    limitation,
    plageVent: { mini: plage.mini, maxi: plage.maxi },
  }
}

function commentaireVent(vent: number, niveau: NiveauRider): string {
  const { mini, idealMin, idealMax, maxi } = PLAGES_VENT[niveau]
  if (vent <= mini) return `Trop faible : il te faut au moins ${mini} nœuds pour décoller.`
  if (vent < idealMin) return 'Vent léger, tu seras en sous-régime sur une grosse voile.'
  if (vent <= idealMax) return 'Vent dans ta plage idéale, tu peux te faire plaisir.'
  if (vent < maxi) return 'Vent musclé pour ton niveau, prévois de la marge en dépower.'
  return `Au-delà de ${maxi} nœuds, c'est hors plage pour ton niveau.`
}

function commentaireRegularite(facteur: number): string {
  if (facteur <= 1.2) return 'Vent lisse et constant, très agréable à exploiter.'
  if (facteur <= 1.4) return 'Quelques rafales, rien de gênant.'
  if (facteur <= 1.7) return 'Vent irrégulier, il faudra gérer les à-coups.'
  return 'Vent très haché, dangereux à cause des écarts entre rafales et molles.'
}

function commentaireConfort(conditions: ConditionsHoraires, marine: DonneesMarines): string {
  const parts: string[] = []
  if (conditions.temperatureC >= 22) parts.push('Température agréable')
  else if (conditions.temperatureC >= 15) parts.push('Température correcte en combinaison')
  else parts.push('Il fait frais, prends une combinaison épaisse')

  if (marine.temperatureEauC !== null) parts.push(`eau à ${Math.round(marine.temperatureEauC)} °C`)
  if (conditions.precipitationMm > 0.5) parts.push('il pleut')
  return `${parts.join(', ')}.`
}

// ---------------------------------------------------------------------------
// Recherche du meilleur créneau de la journée
// ---------------------------------------------------------------------------

export interface Creneau {
  debut: string
  fin: string
  score: number
  ventMoyen: number
}

/** Score simplifié d'une heure de prévision, utilisé pour la timeline et le créneau */
export function scoreHoraire(h: ConditionsHoraires, spot: Spot, profil: Profil): number {
  const direction = analyserDirection(h.directionDeg, spot)
  const sVent = scoreVent(h.ventNoeuds, profil.niveau)
  const sReg = scoreRegularite(h.ventNoeuds, h.rafalesNoeuds, profil.niveau)
  let score = (sVent * 0.5 + direction.score * 0.32 + sReg * 0.18) * 10
  if (direction.danger) score = Math.min(score, 3.5)
  return Math.max(0, Math.min(10, score))
}

/**
 * Cherche la meilleure fenêtre de navigation (2 à 4 h consécutives) parmi les
 * heures restantes de la journée, entre maintenant et le coucher du soleil.
 */
export function meilleurCreneau(
  previsions: ConditionsHoraires[],
  spot: Spot,
  profil: Profil,
  maintenant: Date,
  coucherSoleil: string,
): Creneau | null {
  const fin = new Date(coucherSoleil).getTime()
  const debut = maintenant.getTime()

  const eligibles = previsions.filter((h) => {
    const t = new Date(h.heure).getTime()
    return t >= debut - 60 * 60 * 1000 && t <= fin
  })
  if (eligibles.length < 2) return null

  const scores = eligibles.map((h) => scoreHoraire(h, spot, profil))

  let meilleur: { i: number; longueur: number; moyenne: number } | null = null
  for (let longueur = 4; longueur >= 2; longueur--) {
    for (let i = 0; i + longueur <= eligibles.length; i++) {
      const tranche = scores.slice(i, i + longueur)
      const moyenne = tranche.reduce((a, b) => a + b, 0) / longueur
      if (!meilleur || moyenne > meilleur.moyenne + 0.05) {
        meilleur = { i, longueur, moyenne }
      }
    }
  }

  // En dessous de 5/10 de moyenne, mieux vaut ne pas envoyer quelqu'un à l'eau
  if (!meilleur || meilleur.moyenne < 5) return null

  const tranche = eligibles.slice(meilleur.i, meilleur.i + meilleur.longueur)
  return {
    debut: tranche[0].heure,
    fin: tranche[tranche.length - 1].heure,
    score: meilleur.moyenne,
    ventMoyen: tranche.reduce((a, h) => a + h.ventNoeuds, 0) / tranche.length,
  }
}
