/**
 * Échelle de couleur commune au kite et au surf.
 * Une heure n'est jamais colorée à la main : sa couleur sort du score calculé
 * pour cette heure, avec le profil sélectionné. Seuls ces seuils décident.
 */
export const SEUILS_COULEUR = [
  { min: 8, cle: 'excellent', variable: 'var(--color-go)', libelle: 'Très bonnes conditions' },
  { min: 6, cle: 'correct', variable: 'var(--color-warn)', libelle: 'Conditions correctes' },
  { min: 4, cle: 'faible', variable: 'var(--color-orange)', libelle: 'Conditions peu favorables' },
  { min: 0, cle: 'mauvais', variable: 'var(--color-stop)', libelle: 'Mauvaises conditions' },
] as const

export type CleCouleur = (typeof SEUILS_COULEUR)[number]['cle']

export function paletteScore(score: number) {
  return SEUILS_COULEUR.find((s) => score >= s.min) ?? SEUILS_COULEUR[SEUILS_COULEUR.length - 1]
}

/** Couleur CSS d'un score sur 10. `null` = donnée indisponible, gris neutre. */
export function couleurScore(score: number | null): string {
  if (score === null) return 'var(--color-dim)'
  return paletteScore(score).variable
}
