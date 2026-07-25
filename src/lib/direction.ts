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

const BASES: Record<OrientationVent, { score: number; label: string; commentaire: string }> = {
  'side-shore': {
    score: 1,
    label: 'Side-shore',
    commentaire: 'Vent parallèle à la plage : la configuration idéale.',
  },
  'side-onshore': {
    score: 0.92,
    label: 'Side-onshore',
    commentaire: 'Vent de trois-quarts rentrant : confortable et sécurisant.',
  },
  onshore: {
    score: 0.55,
    label: 'Onshore',
    commentaire: 'Vent de face : sécurisant, mais départs physiques dans le shore break.',
  },
  'side-offshore': {
    score: 0.32,
    label: 'Side-offshore',
    commentaire: 'Vent sortant : souvent rafaleux, et tu dérives vers le large.',
  },
  offshore: {
    score: 0.06,
    label: 'Offshore',
    commentaire: 'Vent de terre vers le large. Sans assistance, on ne navigue pas.',
  },
}

/**
 * Analyse la direction du vent par rapport à l'orientation du littoral.
 *
 * `orientationLittoral` = cap vers lequel on regarde depuis la plage face à la mer.
 * `directionVentDeg` = provenance du vent (convention météo).
 *
 * Si le vent vient de la direction du large, il souffle vers la plage : onshore.
 * S'il vient de la direction opposée, il souffle vers le large : offshore, la
 * situation la plus risquée en kite.
 *
 * Renvoie null quand l'orientation du littoral est inconnue : on préfère ne pas
 * évaluer la direction plutôt que d'annoncer un onshore là où le vent sort.
 */
export function analyserDirection(
  directionVentDeg: number,
  orientationLittoral: number | null,
  estLagune: boolean,
): AnalyseDirection | null {
  if (orientationLittoral === null) return null

  const ecart = ecartAngulaire(directionVentDeg, orientationLittoral)

  let orientation: OrientationVent
  if (ecart <= 22.5) orientation = 'onshore'
  else if (ecart <= 67.5) orientation = 'side-onshore'
  else if (ecart <= 112.5) orientation = 'side-shore'
  else if (ecart <= 157.5) orientation = 'side-offshore'
  else orientation = 'offshore'

  const base = BASES[orientation]
  let score = base.score
  let commentaire = base.commentaire
  let danger = orientation === 'offshore' || orientation === 'side-offshore'

  // Sur un plan d'eau fermé, le vent de terre reste gênant mais la dérive est contenue
  if (estLagune && danger) {
    score = orientation === 'offshore' ? 0.5 : 0.7
    commentaire = 'Vent de terre, mais plan d’eau fermé : la dérive reste contenue.'
    danger = false
  }

  return { orientation, label: base.label, ecartDeg: ecart, score, commentaire, danger }
}
