// Bornes de la plage de vent exploitable en kite, en nœuds
const VENT_MIN = 12
const VENT_MAX = 35
// Largeur de la zone de transition (score dégressif) proche des bornes
const MARGE_TRANSITION = 5
// Score plancher à l'intérieur de la plage exploitable, pour la distinguer du "pas exploitable"
const SCORE_PLANCHER = 0.2

export type QualiteVent = 'bon' | 'moyen' | 'nul'

/**
 * Score de "ridabilité" entre 0 et 1 à partir de la vitesse du vent (nœuds).
 * Exploitable entre 12 et 35 nœuds, avec un score dégressif proche des bornes
 * (trapèze : monte de 12 à 17 nds, plateau, redescend de 30 à 35 nds).
 */
export function scoreRidabilite(vitesseNoeuds: number): number {
  if (vitesseNoeuds < VENT_MIN || vitesseNoeuds > VENT_MAX) return 0

  const distanceBorneMin = vitesseNoeuds - VENT_MIN
  const distanceBorneMax = VENT_MAX - vitesseNoeuds
  const facteur = Math.min(distanceBorneMin, distanceBorneMax, MARGE_TRANSITION) / MARGE_TRANSITION

  return Math.max(SCORE_PLANCHER, facteur)
}

export function qualiteVent(vitesseNoeuds: number): QualiteVent {
  const score = scoreRidabilite(vitesseNoeuds)
  if (score >= 0.6) return 'bon'
  if (score > 0) return 'moyen'
  return 'nul'
}

// Classes Tailwind associées à chaque niveau de qualité (texte, fond, marker carte)
export const COULEURS_QUALITE: Record<QualiteVent, { texte: string; fond: string; marker: string }> = {
  bon: { texte: 'text-emerald-700', fond: 'bg-emerald-100', marker: '#10b981' },
  moyen: { texte: 'text-orange-700', fond: 'bg-orange-100', marker: '#f97316' },
  nul: { texte: 'text-slate-500', fond: 'bg-slate-100', marker: '#94a3b8' },
}
