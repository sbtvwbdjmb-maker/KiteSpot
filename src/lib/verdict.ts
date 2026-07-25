import type { AnalyseConditions } from './scoring'

export type TonVerdict = 'go' | 'mitige' | 'stop'

export interface Verdict {
  titre: string
  /** une ligne, jamais plus : le sous-titre doit se lire d'un coup d'œil */
  sousTitre: string
  ton: TonVerdict
}

/**
 * Seuils du verdict, sur 10. Ordre décroissant : le premier palier atteint gagne.
 *
 * Ils sont alignés sur les bandes de couleur de SEUILS_COULEUR (8 / 6 / 4) :
 * chaque libellé tient entièrement dans une bande, si bien que le mot et la
 * couleur ne peuvent jamais se contredire entre le verdict et la timeline.
 * C'est le seul endroit à modifier pour rendre KiteSpot plus ou moins sévère.
 */
export const SEUILS_VERDICT: { min: number; titre: string; sousTitre: string; ton: TonVerdict }[] = [
  // bande verte : 8 et plus
  { min: 9, titre: 'Va kiter', sousTitre: 'Conditions exceptionnelles', ton: 'go' },
  { min: 8, titre: 'Très bonnes conditions', sousTitre: 'Ça vaut le déplacement', ton: 'go' },
  // bande jaune : 6 à 8
  { min: 6, titre: 'Conditions correctes', sousTitre: 'Ça peut fonctionner', ton: 'mitige' },
  // bande orange : 4 à 6
  { min: 4, titre: 'Conditions moyennes', sousTitre: 'Pas idéal', ton: 'mitige' },
  // bande rouge : moins de 4
  { min: 2.5, titre: 'Pas idéal', sousTitre: 'Conditions peu favorables', ton: 'stop' },
  { min: 0, titre: 'Évite aujourd’hui', sousTitre: 'Conditions défavorables', ton: 'stop' },
]

/**
 * Traduit la note en verdict. Les situations bloquantes court-circuitent les
 * seuils : ce sont des consignes de sécurité, pas des nuances de qualité.
 */
export function construireVerdict(analyse: AnalyseConditions): Verdict {
  switch (analyse.limitation) {
    case 'vent-de-terre':
      return analyse.direction?.orientation === 'offshore'
        ? { titre: 'Ne navigue pas', sousTitre: 'Vent de terre vers le large', ton: 'stop' }
        : { titre: 'Prudence', sousTitre: 'Vent sortant, reste près du bord', ton: 'stop' }
    case 'tempete':
      return { titre: 'Reste à terre', sousTitre: 'Vent de tempête', ton: 'stop' }
    case 'vent-fort-pour-niveau':
      return {
        titre: 'Trop fort pour toi',
        sousTitre: `Au-dessus de ta plage (~${analyse.plageVent.maxi} nds)`,
        ton: 'stop',
      }
    case 'vent-faible':
      return { titre: 'Pas assez de vent', sousTitre: `Il en faut ${analyse.plageVent.mini}+ nds`, ton: 'stop' }
  }

  const palier =
    SEUILS_VERDICT.find((s) => analyse.scoreGlobal >= s.min) ?? SEUILS_VERDICT[SEUILS_VERDICT.length - 1]
  return { titre: palier.titre, sousTitre: palier.sousTitre, ton: palier.ton }
}
