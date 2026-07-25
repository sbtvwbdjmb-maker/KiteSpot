import type { AnalyseSurf } from './surf'
import type { TonVerdict, Verdict } from './verdict'

/**
 * Seuils du verdict surf, sur 10. Ordre décroissant : le premier palier atteint gagne.
 * Séparés de ceux du kite : on peut durcir le surf sans toucher au kite.
 */
export const SEUILS_VERDICT_SURF: {
  min: number
  titre: string
  sousTitre: string
  ton: TonVerdict
}[] = [
  { min: 8.2, titre: 'Va surfer', sousTitre: 'Très bonnes conditions', ton: 'go' },
  { min: 6.8, titre: 'Bonnes conditions', sousTitre: 'Ça vaut le déplacement', ton: 'go' },
  { min: 5.2, titre: 'Conditions correctes', sousTitre: 'Ça peut fonctionner', ton: 'mitige' },
  { min: 3.8, titre: 'Conditions moyennes', sousTitre: 'Pas idéal', ton: 'mitige' },
  { min: 2.5, titre: 'Pas idéal', sousTitre: 'Conditions peu favorables', ton: 'stop' },
  { min: 0, titre: 'Évite aujourd’hui', sousTitre: 'Conditions défavorables', ton: 'stop' },
]

export function construireVerdictSurf(analyse: AnalyseSurf): Verdict | null {
  if (analyse.scoreGlobal === null) return null

  // La taille prime : au-dessus de la plage du surfeur, c'est un avertissement
  const tropGros = analyse.criteres.find((c) => c.cle === 'vent' && c.score === 0)
  if (tropGros && parseFloat(tropGros.valeur) >= analyse.plageVague.maxi) {
    return {
      titre: 'Trop gros pour toi',
      sousTitre: `Au-dessus de ta plage (~${analyse.plageVague.maxi} m)`,
      ton: 'stop',
    }
  }
  if (tropGros && parseFloat(tropGros.valeur) <= analyse.plageVague.mini) {
    return { titre: 'Pas de vagues', sousTitre: 'Trop petit pour surfer', ton: 'stop' }
  }

  const palier =
    SEUILS_VERDICT_SURF.find((s) => analyse.scoreGlobal! >= s.min) ??
    SEUILS_VERDICT_SURF[SEUILS_VERDICT_SURF.length - 1]
  return { titre: palier.titre, sousTitre: palier.sousTitre, ton: palier.ton }
}

/** Score horaire surf, pour la timeline et le meilleur créneau */
export type ScoreurHoraireSurf = (heure: string) => number | null
