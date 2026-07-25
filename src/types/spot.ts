export type TypeSpot = 'plat' | 'vague' | 'lagune' | 'chop'

export type NiveauRequis = 'débutant' | 'intermédiaire' | 'confirmé'

export interface Spot {
  id: string
  name: string
  /** Commune / lieu-dit affiché sous le nom du spot */
  locality: string
  country: string
  region: string
  lat: number
  lon: number
  /**
   * Orientation du littoral en degrés : direction vers laquelle on regarde
   * quand on est sur la plage face à la mer (0 = nord, 90 = est).
   * Donnée curatée à la main, c'est elle qui permet de déduire
   * onshore / side-shore / offshore à partir de la direction du vent.
   */
  orientation: number
  type: TypeSpot[]
  niveau: NiveauRequis
  /** 1 = spot secret/méconnu, 5 = spot ultra connu */
  popularite: 1 | 2 | 3 | 4 | 5
  /** true si le spot est fortement dépendant de la marée */
  maree: boolean
  acces: string
  notes: string
}
