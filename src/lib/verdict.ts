import type { Profil } from '../types/profile'
import type { Spot } from '../types/spot'
import type { AnalyseConditions, Critere } from './scoring'
import type { ConditionsHoraires } from '../services/weather'

export type NiveauVerdict = 'excellent' | 'bon' | 'correct' | 'moyen' | 'mauvais'
export type TonVerdict = 'go' | 'mitige' | 'stop'

export interface Verdict {
  niveau: NiveauVerdict
  ton: TonVerdict
  titre: string
  /** Le conseil rédigé, adressé au rider */
  phrase: string
}

const SEUILS: { min: number; niveau: NiveauVerdict; ton: TonVerdict; titre: string }[] = [
  { min: 8.2, niveau: 'excellent', ton: 'go', titre: 'Va kiter' },
  { min: 6.8, niveau: 'bon', ton: 'go', titre: 'Bonnes conditions' },
  { min: 5.2, niveau: 'correct', ton: 'mitige', titre: 'Conditions correctes' },
  { min: 3.8, niveau: 'moyen', ton: 'mitige', titre: 'Conditions moyennes' },
  { min: 0, niveau: 'mauvais', ton: 'stop', titre: 'Pas aujourd’hui' },
]

/**
 * Rédige la recommandation en langage naturel.
 * Le principe : ouvrir sur la décision, la justifier par le facteur qui domine
 * réellement l'analyse, puis donner la consigne matériel.
 */
export function construireVerdict(
  analyse: AnalyseConditions,
  profil: Profil,
  spot: Spot,
  actuel: ConditionsHoraires,
): Verdict {
  const palier = SEUILS.find((s) => analyse.scoreGlobal >= s.min) ?? SEUILS[SEUILS.length - 1]
  const vent = Math.round(actuel.ventNoeuds)
  const voile = analyse.voile

  // Les situations bloquantes court-circuitent la nuance : ce sont des avertissements
  if (analyse.limitation === 'vent-de-terre') {
    return {
      niveau: 'mauvais',
      ton: 'stop',
      titre: analyse.direction.orientation === 'offshore' ? 'Ne navigue pas' : 'Prudence',
      phrase:
        analyse.direction.orientation === 'offshore'
          ? `Le vent souffle de la terre vers le large à ${spot.name}. Même avec ${vent} nœuds, tu dériverais au large sans pouvoir remonter. C'est le seul cas où on te dit clairement non.`
          : `À ${spot.name}, le vent sort vers le large. Techniquement navigable, mais uniquement accompagné et en restant près du bord.`,
    }
  }

  if (analyse.limitation === 'tempete') {
    return {
      niveau: 'mauvais',
      ton: 'stop',
      titre: 'Reste à terre',
      phrase: `${vent} nœuds, c'est de la tempête. Le matériel comme le corps prennent des risques disproportionnés. Ça ne se navigue pas.`,
    }
  }

  if (analyse.limitation === 'vent-fort-pour-niveau') {
    return {
      niveau: 'mauvais',
      ton: 'stop',
      titre: 'Trop fort pour toi',
      phrase: `${vent} nœuds ${describeDirection(analyse)}, c'est au-dessus de ta plage de ${profil.niveau} (jusqu'à ~${analyse.plageVent.maxi} nds). Les riders confirmés vont s'y régaler, mais pour toi ce serait subir la session plus que la piloter.`,
    }
  }

  const phrases: string[] = []
  const critereFaible = trouverMaillonFaible(analyse.criteres)

  switch (palier.niveau) {
    case 'excellent':
      phrases.push(
        `Journée à ne pas rater. ${vent} nœuds ${describeDirection(analyse)}, c'est exactement ce qu'on attend de ${spot.name}.`,
      )
      break
    case 'bon':
      phrases.push(
        `Ça vaut le déplacement. ${vent} nœuds ${describeDirection(analyse)}, tu devrais passer une bonne session.`,
      )
      break
    case 'correct':
      phrases.push(
        `Ça peut marcher, sans plus. ${vent} nœuds ${describeDirection(analyse)}, mais ce ne sont pas les meilleures conditions du mois.`,
      )
      break
    case 'moyen':
      phrases.push(
        `Franchement, c'est limite. ${vent} nœuds ${describeDirection(analyse)} : tu risques de te battre plus que de t'amuser.`,
      )
      break
    case 'mauvais':
      phrases.push(
        vent < 10
          ? `Il n'y a pas de vent. ${vent} nœuds, ça ne suffit pas pour tenir en l'air.`
          : `Ce n'est pas le bon jour. ${vent} nœuds ${describeDirection(analyse)}, mais les conditions ne suivent pas.`,
      )
      break
  }

  // Le maillon faible n'est mentionné que s'il pèse vraiment sur la note
  if (critereFaible && critereFaible.score < 0.55 && palier.niveau !== 'mauvais') {
    phrases.push(RAISONS[critereFaible.cle](critereFaible))
  }

  if (voile.tailleRetenue) {
    const accroche =
      palier.ton === 'go'
        ? `Prends ta ${voile.tailleRetenue} m².`
        : `Si tu y vas quand même, pars sur ta ${voile.tailleRetenue} m².`
    phrases.push(accroche)
  } else if (voile.tailleIdeale && vent >= 8) {
    phrases.push(
      `Aucune voile de ton quiver ne colle : il te faudrait plutôt du ${voile.tailleIdeale.toFixed(0)} m².`,
    )
  }

  return {
    niveau: palier.niveau,
    ton: palier.ton,
    titre: palier.titre,
    phrase: phrases.join(' '),
  }
}

function describeDirection(analyse: AnalyseConditions): string {
  const label = analyse.direction.label.toLowerCase()
  if (analyse.direction.score >= 0.9) return `en ${label}`
  if (analyse.direction.score >= 0.5) return `en ${label}`
  return `en ${label}`
}

function trouverMaillonFaible(criteres: Critere[]): Critere | null {
  const trie = [...criteres].sort((a, b) => a.score - b.score)
  return trie[0] ?? null
}

const RAISONS: Record<Critere['cle'], (c: Critere) => string> = {
  vent: () => 'Le point faible, c’est la force du vent.',
  direction: (c) => `Le bémol vient de l’orientation : ${c.valeur.toLowerCase()} sur ce spot.`,
  regularite: () => 'Attends-toi à un vent irrégulier, avec des molles à gérer.',
  materiel: (c) => c.commentaire,
  confort: () => 'Habille-toi en conséquence, il ne fera pas chaud.',
}
