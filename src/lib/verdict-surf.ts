import type { AnalyseSurf } from './surf'
import type { TonVerdict, Verdict } from './verdict'

/**
 * Seuils du verdict surf, sur 10. Ordre décroissant : le premier palier atteint gagne.
 * Alignés sur les bandes de SEUILS_COULEUR comme ceux du kite, pour que le mot
 * et la couleur concordent. Séparés du kite : on peut durcir l'un sans l'autre.
 */
export const SEUILS_VERDICT_SURF: {
  min: number
  titre: string
  sousTitre: string
  ton: TonVerdict
}[] = [
  // bande verte : 8 et plus
  { min: 9, titre: 'Va surfer', sousTitre: 'Conditions exceptionnelles', ton: 'go' },
  { min: 8, titre: 'Très bonnes conditions', sousTitre: 'Ça vaut le déplacement', ton: 'go' },
  // bande jaune : 6 à 8
  { min: 6, titre: 'Conditions correctes', sousTitre: 'Ça peut fonctionner', ton: 'mitige' },
  // bande orange : 4 à 6
  { min: 4, titre: 'Conditions moyennes', sousTitre: 'Pas idéal', ton: 'mitige' },
  // bande rouge : moins de 4
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
