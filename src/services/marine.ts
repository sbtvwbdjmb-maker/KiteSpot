import { distanceKm } from '../lib/geo'

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine'

/**
 * Le modèle de houle travaille sur une grille de plusieurs kilomètres : tout
 * point de la côte est forcément recalé au large, c'est normal et la donnée
 * reste représentative. Mesuré sur les 44 spots de la base : la médiane est
 * autour de 4 km, et des spots de référence comme Lacanau tombent à 8,5 km.
 *
 * Ce n'est donc pas la distance qui trahit une mauvaise masse d'eau — c'est
 * la nature du plan d'eau (voir le traitement des lagunes dans surf.ts).
 * Ce seuil ne sert plus qu'à signaler une donnée franchement lointaine,
 * sans pour autant refuser de la lire.
 */
const DISTANCE_MAILLE_LOINTAINE_KM = 25

/** Un instant de conditions marines, tel que fourni par le modèle */
export interface ConditionsMarines {
  heure: string
  hauteurVaguesM: number | null
  periodeVaguesS: number | null
  directionVaguesDeg: number | null
  hauteurHouleM: number | null
  periodeHouleS: number | null
  directionHouleDeg: number | null
  hauteurVaguesVentM: number | null
  /** hauteur d'eau par rapport au niveau moyen : la marée */
  niveauMerM: number | null
}

export interface DonneesMarines {
  /** null quand le modèle marin ne couvre pas ce point */
  actuel: ConditionsMarines | null
  previsions: ConditionsMarines[]
  temperatureEauC: number | null
  /** distance entre le point demandé et la maille réellement utilisée */
  distanceMailleKm: number | null
  /** true si la maille est franchement lointaine : donnée à prendre avec recul */
  mailleLointaine: boolean
  /** true si le modèle marin ne couvre pas du tout ce point */
  horsCouverture: boolean
}

export const MARINE_VIDE: DonneesMarines = {
  actuel: null,
  previsions: [],
  temperatureEauC: null,
  distanceMailleKm: null,
  mailleLointaine: false,
  horsCouverture: true,
}

const CHAMPS = [
  'wave_height',
  'wave_period',
  'wave_direction',
  'swell_wave_height',
  'swell_wave_period',
  'swell_wave_direction',
  'wind_wave_height',
  'sea_level_height_msl',
] as const

function nombreOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Houle, vagues, marée et température de l'eau via l'API marine d'Open-Meteo.
 *
 * Le modèle ne couvre pas tous les plans d'eau : les valeurs manquantes
 * restent à null plutôt que d'être comblées, et l'interface affiche
 * « donnée indisponible » au lieu d'inventer.
 */
export async function fetchMarine(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<DonneesMarines> {
  const url = new URL(MARINE_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', [...CHAMPS, 'sea_surface_temperature'].join(','))
  url.searchParams.set('hourly', CHAMPS.join(','))
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('timezone', 'auto')

  try {
    const res = await fetch(url.toString(), { signal })
    if (!res.ok) return MARINE_VIDE
    const data = await res.json()

    const courant = data?.current
    const horaire = data?.hourly

    const actuel: ConditionsMarines | null = courant
      ? {
          heure: courant.time,
          hauteurVaguesM: nombreOuNull(courant.wave_height),
          periodeVaguesS: nombreOuNull(courant.wave_period),
          directionVaguesDeg: nombreOuNull(courant.wave_direction),
          hauteurHouleM: nombreOuNull(courant.swell_wave_height),
          periodeHouleS: nombreOuNull(courant.swell_wave_period),
          directionHouleDeg: nombreOuNull(courant.swell_wave_direction),
          hauteurVaguesVentM: nombreOuNull(courant.wind_wave_height),
          niveauMerM: nombreOuNull(courant.sea_level_height_msl),
        }
      : null

    const previsions: ConditionsMarines[] = Array.isArray(horaire?.time)
      ? horaire.time.map((heure: string, i: number) => ({
          heure,
          hauteurVaguesM: nombreOuNull(horaire.wave_height?.[i]),
          periodeVaguesS: nombreOuNull(horaire.wave_period?.[i]),
          directionVaguesDeg: nombreOuNull(horaire.wave_direction?.[i]),
          hauteurHouleM: nombreOuNull(horaire.swell_wave_height?.[i]),
          periodeHouleS: nombreOuNull(horaire.swell_wave_period?.[i]),
          directionHouleDeg: nombreOuNull(horaire.swell_wave_direction?.[i]),
          hauteurVaguesVentM: nombreOuNull(horaire.wind_wave_height?.[i]),
          niveauMerM: nombreOuNull(horaire.sea_level_height_msl?.[i]),
        }))
      : []

    // Le modèle recale le point demandé sur sa grille : on mesure l'écart
    const distanceMailleKm =
      typeof data?.latitude === 'number' && typeof data?.longitude === 'number'
        ? distanceKm(lat, lon, data.latitude, data.longitude)
        : null

    const horsCouverture = actuel === null || actuel.hauteurVaguesM === null

    return {
      actuel,
      previsions,
      temperatureEauC: nombreOuNull(courant?.sea_surface_temperature),
      distanceMailleKm,
      mailleLointaine:
        distanceMailleKm !== null && distanceMailleKm > DISTANCE_MAILLE_LOINTAINE_KM,
      horsCouverture,
    }
  } catch {
    return MARINE_VIDE
  }
}

/** Amplitude de marée sur la journée, en mètres. null si la donnée manque. */
export function marnageJour(previsions: ConditionsMarines[]): number | null {
  const niveaux = previsions.map((p) => p.niveauMerM).filter((n): n is number => n !== null)
  if (niveaux.length < 4) return null
  return Math.max(...niveaux) - Math.min(...niveaux)
}

/** Tendance de la marée à une heure donnée : montante, descendante ou étale */
export function tendanceMaree(
  previsions: ConditionsMarines[],
  heure: string,
): 'montante' | 'descendante' | 'etale' | null {
  const i = previsions.findIndex((p) => p.heure === heure)
  if (i < 0) return null
  const courant = previsions[i]?.niveauMerM
  const suivant = previsions[i + 1]?.niveauMerM
  if (courant === null || courant === undefined || suivant === null || suivant === undefined) {
    return null
  }
  const delta = suivant - courant
  if (Math.abs(delta) < 0.05) return 'etale'
  return delta > 0 ? 'montante' : 'descendante'
}
