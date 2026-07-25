import type { NiveauRequis, TypeSpot } from './spot'

/** D'où vient l'orientation du littoral d'un lieu — jamais inventée, toujours tracée */
export type SourceOrientation =
  /** vérifiée à la main dans spots.json */
  | 'curatee'
  /** déduite du relief autour du point via l'API d'élévation Open-Meteo */
  | 'estimee'
  /** corrigée par l'utilisateur */
  | 'manuelle'
  /** littoral trop complexe ou lieu intérieur : on n'évalue pas la direction */
  | 'inconnue'

/**
 * Un lieu analysable. Il vient soit de la base curatée, soit d'une recherche
 * libre. Les champs curatés sont optionnels : un lieu cherché n'a pas de
 * description d'accès ni de niveau requis, et on ne prétend pas en avoir.
 */
export interface Lieu {
  /** id de spot curaté, ou « geo:lat,lon » pour un lieu cherché */
  id: string
  nom: string
  localite: string
  pays: string
  lat: number
  lon: number
  orientation: number | null
  sourceOrientation: SourceOrientation
  /** true si le plan d'eau est fermé (lagune) : la dérive au large y est contenue */
  estLagune: boolean

  // Renseignements curatés, présents uniquement pour les spots de la base
  type?: TypeSpot[]
  niveau?: NiveauRequis
  popularite?: 1 | 2 | 3 | 4 | 5
  maree?: boolean
  acces?: string
  notes?: string
}

export function estSpotCurate(lieu: Lieu): boolean {
  return lieu.sourceOrientation === 'curatee' || lieu.acces !== undefined
}
