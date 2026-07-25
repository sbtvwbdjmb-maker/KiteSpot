export type NiveauRider = 'débutant' | 'intermédiaire' | 'confirmé' | 'expert'
export type Pratique = 'freeride' | 'freestyle' | 'wave'
export type PreferencePuissance = 'tranquille' | 'normal' | 'puissant'

export interface Profil {
  id: string
  nom: string
  /** en kilogrammes */
  poids: number
  niveau: NiveauRider
  pratique: Pratique
  /** tailles de voiles possédées, en m². Vide tant que le rider ne l'a pas renseigné. */
  quiver: number[]
  preference: PreferencePuissance
}

export const NIVEAUX: NiveauRider[] = ['débutant', 'intermédiaire', 'confirmé', 'expert']
export const PRATIQUES: Pratique[] = ['freeride', 'freestyle', 'wave']
export const PREFERENCES: PreferencePuissance[] = ['tranquille', 'normal', 'puissant']

export const TAILLES_VOILES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17] as const

/**
 * Valeurs de départ du formulaire de création. Aucun profil n'existe tant que
 * le rider n'en a pas créé un : le poids et le niveau sont les siens, pas des
 * valeurs supposées.
 */
export const VALEURS_DEPART: Omit<Profil, 'id' | 'nom'> = {
  poids: 75,
  niveau: 'intermédiaire',
  pratique: 'freeride',
  quiver: [],
  preference: 'normal',
}
