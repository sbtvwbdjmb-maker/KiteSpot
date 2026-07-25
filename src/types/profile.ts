export type NiveauRider = 'débutant' | 'intermédiaire' | 'confirmé'
export type Pratique = 'freeride' | 'freestyle' | 'wave'
export type PreferencePuissance = 'tranquille' | 'normal' | 'puissant'

export interface Profil {
  id: string
  nom: string
  /** en kilogrammes */
  poids: number
  niveau: NiveauRider
  pratique: Pratique
  /** tailles de voiles possédées, en m² */
  quiver: number[]
  preference: PreferencePuissance
}

export const TAILLES_VOILES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17] as const

export const PROFIL_PAR_DEFAUT: Omit<Profil, 'id'> = {
  nom: 'Moi',
  poids: 75,
  niveau: 'intermédiaire',
  pratique: 'freeride',
  quiver: [7, 9, 12],
  preference: 'normal',
}
