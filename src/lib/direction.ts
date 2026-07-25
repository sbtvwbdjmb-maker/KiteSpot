import type { Spot } from '../types/spot'
import { ecartAngulaire } from './geo'

export type OrientationVent =
  | 'onshore'
  | 'side-onshore'
  | 'side-shore'
  | 'side-offshore'
  | 'offshore'

export interface AnalyseDirection {
  orientation: OrientationVent
  label: string
  /** Écart entre la provenance du vent et la direction du large, en degrés */
  ecartDeg: number
  score: number
  commentaire: string
  /** true quand le vent pousse vers le large : risque de ne pas pouvoir revenir */
  danger: boolean
}

const POINTS_CARDINAUX = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO',
]

// Convertit une direction en degrés (provenance du vent, convention météo) en point cardinal
export function degresVersCardinal(deg: number): string {
  const index = Math.round(deg / 22.5) % 16
  return POINTS_CARDINAUX[(index + 16) % 16]
}

/**
 * Analyse la direction du vent par rapport à l'orientation du littoral du spot.
 *
 * `spot.orientation` = direction vers laquelle on regarde depuis la plage face à la mer.
 * `directionVentDeg` = provenance du vent (convention météo).
 *
 * Si le vent vient de la même direction que le large, il souffle vers la plage : onshore.
 * S'il vient de la direction opposée, il souffle vers le large : offshore, la situation
 * la plus risquée en kite car on dérive au large sans pouvoir revenir.
 */
export function analyserDirection(directionVentDeg: number, spot: Spot): AnalyseDirection {
  const ecart = ecartAngulaire(directionVentDeg, spot.orientation)
  // Un plan d'eau fermé (lagune) réduit fortement le risque du vent de terre
  const estLagune = spot.type.includes('lagune')

  let orientation: OrientationVent
  if (ecart <= 22.5) orientation = 'onshore'
  else if (ecart <= 67.5) orientation = 'side-onshore'
  else if (ecart <= 112.5) orientation = 'side-shore'
  else if (ecart <= 157.5) orientation = 'side-offshore'
  else orientation = 'offshore'

  const bases: Record<OrientationVent, { score: number; label: string; commentaire: string }> = {
    'side-shore': {
      score: 1,
      label: 'Side-shore',
      commentaire: 'Vent parallèle à la plage, la configuration idéale pour naviguer et remonter au vent.',
    },
    'side-onshore': {
      score: 0.92,
      label: 'Side-onshore',
      commentaire: 'Vent de trois-quarts rentrant, très confortable et sécurisant : tu redérives vers la plage.',
    },
    onshore: {
      score: 0.55,
      label: 'Onshore',
      commentaire: 'Vent de face plein travers, sécurisant mais le shore break rend les départs et retours physiques.',
    },
    'side-offshore': {
      score: 0.32,
      label: 'Side-offshore',
      commentaire: 'Vent de trois-quarts sortant : souvent rafaleux près du bord et tu dérives vers le large.',
    },
    offshore: {
      score: 0.06,
      label: 'Offshore',
      commentaire: 'Vent de terre soufflant vers le large. Sans bateau de sécurité, on ne navigue pas.',
    },
  }

  const base = bases[orientation]
  let score = base.score
  let commentaire = base.commentaire
  let danger = orientation === 'offshore' || orientation === 'side-offshore'

  if (estLagune && danger) {
    // Sur une lagune fermée, le vent de terre reste gênant mais pas dangereux
    score = orientation === 'offshore' ? 0.5 : 0.7
    commentaire =
      'Vent de terre, mais le plan d’eau est fermé : la dérive reste contenue. Reste près du bord au vent.'
    danger = false
  }

  return { orientation, label: base.label, ecartDeg: ecart, score, commentaire, danger }
}
