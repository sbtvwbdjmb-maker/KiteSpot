import type { Profil } from '../types/profile'

export type Adequation = 'ideale' | 'acceptable' | 'limite' | 'aucune'

export interface RecoVoile {
  /** Taille théorique calculée, en m² (non arrondie aux tailles du commerce) */
  tailleIdeale: number | null
  /** Taille effectivement retenue dans le quiver du rider */
  tailleRetenue: number | null
  adequation: Adequation
  message: string
}

/**
 * Table de référence pour un rider de 75 kg, freeride, en twintip.
 * Ancrée sur la pratique courante (10 m² à 20 nœuds pour 75 kg), puis
 * interpolée linéairement et mise à l'échelle du poids du rider.
 * C'est une estimation indicative, pas une vérité : le ressenti dépend
 * aussi de la planche, du modèle de voile et de l'état de la mer.
 */
const REFERENCE_75KG: { vent: number; taille: number }[] = [
  { vent: 8, taille: 21 },
  { vent: 10, taille: 18 },
  { vent: 12, taille: 16 },
  { vent: 14, taille: 14 },
  { vent: 16, taille: 12.5 },
  { vent: 18, taille: 11 },
  { vent: 20, taille: 10 },
  { vent: 23, taille: 9 },
  { vent: 26, taille: 8 },
  { vent: 30, taille: 7 },
  { vent: 35, taille: 6 },
  { vent: 40, taille: 5 },
]

const VENT_MINI_NAVIGABLE = 8
const VENT_MAXI_NAVIGABLE = 42

function tailleReference(ventNoeuds: number): number {
  const table = REFERENCE_75KG
  if (ventNoeuds <= table[0].vent) return table[0].taille
  const dernier = table[table.length - 1]
  if (ventNoeuds >= dernier.vent) return dernier.taille

  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i]
    const b = table[i + 1]
    if (ventNoeuds >= a.vent && ventNoeuds <= b.vent) {
      const ratio = (ventNoeuds - a.vent) / (b.vent - a.vent)
      return a.taille + ratio * (b.taille - a.taille)
    }
  }
  return dernier.taille
}

// Coefficients d'ajustement selon le style et les préférences du rider
function coefficientProfil(profil: Profil): number {
  const parPratique = { freeride: 1, freestyle: 0.95, wave: 0.9 }
  const parPreference = { tranquille: 0.92, normal: 1, puissant: 1.08 }
  // Un débutant est plus à l'aise légèrement sous-toilé : moins de traction à gérer
  const parNiveau = { débutant: 0.95, intermédiaire: 1, confirmé: 1 }
  return parPratique[profil.pratique] * parPreference[profil.preference] * parNiveau[profil.niveau]
}

export function recommanderVoile(ventNoeuds: number, profil: Profil): RecoVoile {
  if (ventNoeuds < VENT_MINI_NAVIGABLE) {
    return {
      tailleIdeale: null,
      tailleRetenue: null,
      adequation: 'aucune',
      message: 'Trop peu de vent pour naviguer, quelle que soit la voile.',
    }
  }
  if (ventNoeuds > VENT_MAXI_NAVIGABLE) {
    return {
      tailleIdeale: null,
      tailleRetenue: null,
      adequation: 'aucune',
      message: 'Vent de tempête : au-delà de la plage de navigation raisonnable.',
    }
  }

  const ideale = tailleReference(ventNoeuds) * (profil.poids / 75) * coefficientProfil(profil)

  const quiver = [...profil.quiver].sort((a, b) => a - b)
  if (quiver.length === 0) {
    return {
      tailleIdeale: ideale,
      tailleRetenue: null,
      adequation: 'aucune',
      message: `Renseigne ton matériel pour avoir une reco. Il te faudrait environ ${ideale.toFixed(1)} m².`,
    }
  }

  // On retient la voile du quiver la plus proche de la taille théorique
  const retenue = quiver.reduce((meilleure, taille) =>
    Math.abs(taille - ideale) < Math.abs(meilleure - ideale) ? taille : meilleure,
  )
  const ecartRelatif = (retenue - ideale) / ideale

  let adequation: Adequation
  if (Math.abs(ecartRelatif) <= 0.12) adequation = 'ideale'
  else if (Math.abs(ecartRelatif) <= 0.25) adequation = 'acceptable'
  else if (Math.abs(ecartRelatif) <= 0.42) adequation = 'limite'
  else adequation = 'aucune'

  const sousToile = ecartRelatif < 0
  const messages: Record<Adequation, string> = {
    ideale: `Avec ${Math.round(ventNoeuds)} nœuds et ${profil.poids} kg, ta ${retenue} m² tombe juste.`,
    acceptable: sousToile
      ? `Ta ${retenue} m² passe, tu seras un peu léger mais ça marche.`
      : `Ta ${retenue} m² passe, tu seras un peu chargé : garde du débordement.`,
    limite: sousToile
      ? `Ta ${retenue} m² est petite pour ces conditions, il faudra pomper pour partir.`
      : `Ta ${retenue} m² est grosse pour ces conditions, tu risques d'être surtoilé.`,
    aucune: sousToile
      ? 'Le vent est trop faible pour ton quiver actuel.'
      : 'Le vent est trop fort pour ton quiver actuel.',
  }

  return {
    tailleIdeale: ideale,
    tailleRetenue: adequation === 'aucune' ? null : retenue,
    adequation,
    message: messages[adequation],
  }
}
