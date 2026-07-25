export type TypeSpot = 'plat' | 'vague' | 'lagune' | 'chop'

export type NiveauRequis = 'débutant' | 'intermédiaire' | 'confirmé'

export interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  region: string
  type: TypeSpot[]
  niveau: NiveauRequis
  /** 1 = spot secret/méconnu, 5 = spot ultra connu */
  popularite: 1 | 2 | 3 | 4 | 5
  acces: string
  notes: string
}
