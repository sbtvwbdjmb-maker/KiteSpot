import type { Lieu } from '../types/lieu'
import type { Profil, NiveauRider } from '../types/profile'
import type { ConditionsHoraires } from '../services/weather'
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
  /** null quand l'orientation du littoral est inconnue : direction non évaluée */
  direction: AnalyseDirection | null
  voile: RecoVoile
  alertes: string[]
  limitation: Limitation
  plageVent: { mini: number; maxi: number }
}

/**
 * Plage de vent exploitable selon le niveau, en nœuds.
 * Seuils volontairement regroupés ici pour être ajustables d'un coup d'œil.
 */
const PLAGES_VENT: Record<NiveauRider, { mini: number; idealMin: number; idealMax: number; maxi: number }> = {
  débutant: { mini: 10, idealMin: 14, idealMax: 19, maxi: 24 },
  intermédiaire: { mini: 11, idealMin: 16, idealMax: 26, maxi: 34 },
  confirmé: { mini: 12, idealMin: 18, idealMax: 32, maxi: 44 },
  expert: { mini: 12, idealMin: 18, idealMax: 36, maxi: 48 },
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
 * Régularité déduite du rapport rafales / vent moyen. Un vent vraiment lisse
 * tourne autour de 1,1 ; au-delà de 1,5 il devient haché, au-delà de 1,75 piégeux.
 */
function scoreRegularite(vent: number, rafales: number, niveau: NiveauRider): number {
  if (vent <= 0) return 0
  const facteur = rafales / vent
  let score: number
  if (facteur <= 1.1) score = 1
  else if (facteur <= 1.3) score = 1 - ((facteur - 1.1) / 0.2) * 0.15
  else if (facteur <= 1.5) score = 0.85 - ((facteur - 1.3) / 0.2) * 0.25
  else if (facteur <= 1.75) score = 0.6 - ((facteur - 1.5) / 0.25) * 0.3
  else score = 0.2
  // Un débutant subit bien plus les rafales qu'un rider aguerri
  if (niveau === 'débutant') score = score ** 1.5
  if (niveau === 'expert') score = score ** 0.8
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
  inconnue: 0,
}

const POIDS: Record<CleCritere, number> = {
  vent: 0.3,
  direction: 0.28,
  regularite: 0.16,
  materiel: 0.16,
  confort: 0.1,
}

export function analyserConditions(
  actuel: ConditionsHoraires,
  marine: DonneesMarines,
  lieu: Lieu,
  profil: Profil,
): AnalyseConditions {
  const direction = analyserDirection(actuel.directionDeg, lieu.orientation, lieu.estLagune)
  const voile = recommanderVoile(actuel.ventNoeuds, profil)

  const sVent = scoreVent(actuel.ventNoeuds, profil.niveau)
  const sRegularite = scoreRegularite(actuel.ventNoeuds, actuel.rafalesNoeuds, profil.niveau)
  const sConfort = scoreConfort(actuel)
  const facteurRafale = actuel.ventNoeuds > 0 ? actuel.rafalesNoeuds / actuel.ventNoeuds : 0

  const criteres: Critere[] = [
    {
      cle: 'vent',
      label: 'Puissance du vent',
      score: sVent,
      valeur: `${Math.round(actuel.ventNoeuds)} nds`,
      commentaire: commentaireVent(actuel.ventNoeuds, profil.niveau),
    },
    {
      cle: 'regularite',
      label: 'Régularité',
      score: sRegularite,
      valeur: `rafales ${Math.round(actuel.rafalesNoeuds)} nds`,
      commentaire: commentaireRegularite(facteurRafale),
    },
    {
      cle: 'confort',
      label: 'Conditions générales',
      score: sConfort,
      valeur: `${Math.round(actuel.temperatureC)} °C`,
      commentaire: commentaireConfort(actuel, marine),
    },
  ]

  // La direction n'entre dans la note que si l'orientation du littoral est connue
  if (direction) {
    criteres.splice(1, 0, {
      cle: 'direction',
      label: 'Direction',
      score: direction.score,
      valeur: direction.label,
      commentaire: direction.commentaire,
    })
  }

  // Le matériel n'est noté que si le rider a renseigné son quiver
  if (profil.quiver.length > 0) {
    criteres.push({
      cle: 'materiel',
      label: 'Matériel',
      score: SCORE_ADEQUATION[voile.adequation],
      valeur: voile.tailleRetenue ? `${voile.tailleRetenue} m²` : '—',
      commentaire: voile.message,
    })
  }

  // Poids renormalisés sur les seuls critères réellement évalués
  const poidsTotal = criteres.reduce((total, c) => total + POIDS[c.cle], 0)
  let score = (criteres.reduce((total, c) => total + c.score * POIDS[c.cle], 0) / poidsTotal) * 10

  const alertes: string[] = []
  const plage = PLAGES_VENT[profil.niveau]
  let limitation: Limitation = null

  // Garde-fous : ils priment sur la moyenne pondérée, pour qu'un bon score
  // matériel ou météo ne rattrape jamais des conditions inexploitables.
  if (direction?.danger) {
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
    alertes.push('Vent très rafaleux : écarts brutaux entre rafales et molles.')
  }
  if (!direction) {
    // Sans orientation du littoral, on ignore le facteur de sécurité le plus
    // important. Annoncer « va kiter » avec un 9/10 serait surconfiant : on
    // plafonne pour que le verdict reste au mieux « bonnes conditions ».
    score = Math.min(score, 7.5)
    alertes.push(
      'Orientation du littoral inconnue ici : la direction du vent n’est pas évaluée, et la note en tient compte. Juge sur place.',
    )
  }
  if (lieu.maree) {
    alertes.push('Spot dépendant de la marée : vérifie l’horaire avant de te déplacer.')
  }
  if (profil.niveau === 'débutant' && lieu.niveau === 'confirmé') {
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
  if (vent <= idealMax) return 'Vent dans ta plage idéale.'
  if (vent < maxi) return 'Vent musclé pour ton niveau, prévois de la marge en dépower.'
  return `Au-delà de ${maxi} nœuds, c'est hors plage pour ton niveau.`
}

function commentaireRegularite(facteur: number): string {
  if (facteur <= 1.1) return 'Vent lisse et constant.'
  if (facteur <= 1.3) return 'Quelques rafales, rien de gênant.'
  if (facteur <= 1.5) return 'Vent un peu haché, des à-coups à gérer.'
  if (facteur <= 1.75) return 'Vent irrégulier, molles et rafales marquées.'
  return 'Vent très haché, écarts dangereux entre rafales et molles.'
}

function commentaireConfort(conditions: ConditionsHoraires, marine: DonneesMarines): string {
  const parts: string[] = []
  if (conditions.temperatureC >= 22) parts.push('Température agréable')
  else if (conditions.temperatureC >= 15) parts.push('Correct en combinaison')
  else parts.push('Il fait frais, combinaison épaisse')
  if (marine.temperatureEauC !== null) parts.push(`eau à ${Math.round(marine.temperatureEauC)} °C`)
  if (conditions.precipitationMm > 0.5) parts.push('il pleut')
  return `${parts.join(', ')}.`
}

// ---------------------------------------------------------------------------
// Meilleur créneau de la journée
// ---------------------------------------------------------------------------

export interface Creneau {
  debut: string
  fin: string
  score: number
  ventMoyen: number
}

/** Score simplifié d'une heure, utilisé pour la timeline et le meilleur créneau */
export function scoreHoraire(h: ConditionsHoraires, lieu: Lieu, profil: Profil): number {
  const direction = analyserDirection(h.directionDeg, lieu.orientation, lieu.estLagune)
  const sVent = scoreVent(h.ventNoeuds, profil.niveau)
  const sReg = scoreRegularite(h.ventNoeuds, h.rafalesNoeuds, profil.niveau)

  // Sans orientation connue, on note sur le vent seul plutôt que d'inventer une direction
  let score = direction
    ? (sVent * 0.5 + direction.score * 0.32 + sReg * 0.18) * 10
    : (sVent * 0.75 + sReg * 0.25) * 10

  if (direction?.danger) score = Math.min(score, 3.5)
  const plage = PLAGES_VENT[profil.niveau]
  if (h.ventNoeuds <= plage.mini) score = Math.min(score, 2.4)
  if (h.ventNoeuds >= plage.maxi) score = Math.min(score, 3.2)

  return Math.max(0, Math.min(10, score))
}

/** Meilleure fenêtre de 2 à 4 h consécutives entre maintenant et le coucher du soleil */
export function meilleurCreneau(
  previsions: ConditionsHoraires[],
  lieu: Lieu,
  profil: Profil,
  maintenant: Date,
  coucherSoleil: string,
): Creneau | null {
  const fin = new Date(coucherSoleil).getTime()
  const debut = maintenant.getTime()

  const eligibles = previsions.filter((h) => {
    const t = new Date(h.heure).getTime()
    return t >= debut - 3600_000 && t <= fin
  })
  if (eligibles.length < 2) return null

  const scores = eligibles.map((h) => scoreHoraire(h, lieu, profil))

  let meilleur: { i: number; longueur: number; moyenne: number } | null = null
  for (let longueur = 4; longueur >= 2; longueur--) {
    for (let i = 0; i + longueur <= eligibles.length; i++) {
      const moyenne = scores.slice(i, i + longueur).reduce((a, b) => a + b, 0) / longueur
      if (!meilleur || moyenne > meilleur.moyenne + 0.05) meilleur = { i, longueur, moyenne }
    }
  }

  // En dessous de 5/10, mieux vaut ne pas envoyer quelqu'un à l'eau
  if (!meilleur || meilleur.moyenne < 5) return null

  const tranche = eligibles.slice(meilleur.i, meilleur.i + meilleur.longueur)
  return {
    debut: tranche[0].heure,
    fin: tranche[tranche.length - 1].heure,
    score: meilleur.moyenne,
    ventMoyen: tranche.reduce((a, h) => a + h.ventNoeuds, 0) / tranche.length,
  }
}
