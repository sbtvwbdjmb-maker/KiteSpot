/**
 * Géocodage via Photon (photon.komoot.io), moteur de recherche open source
 * adossé aux données OpenStreetMap.
 *
 * Choisi après comparaison : le géocodeur d'Open-Meteo ne référence que des
 * localités peuplées et ne trouve pas « Praia do Carvalhal ». Photon trouve les
 * plages, lieux-dits et adresses, gère la recherche inverse, ne demande pas de
 * clé et autorise les requêtes navigateur (CORS ouvert).
 *
 * Usage : gratuit, sans clé, « fair use » — l'usage intensif est bridé.
 * Données © contributeurs OpenStreetMap (ODbL).
 */
const PHOTON_SEARCH = 'https://photon.komoot.io/api/'
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse'

export interface ResultatLieu {
  cle: string
  nom: string
  localite: string
  pays: string
  lat: number
  lon: number
  /** catégorie OSM (beach, village, city…), sert à prioriser les plages */
  categorie: string
}

interface PhotonFeature {
  properties: {
    osm_id?: number
    osm_key?: string
    osm_value?: string
    name?: string
    street?: string
    district?: string
    city?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
  }
  geometry: { coordinates: [number, number] }
}

/** Les lieux qui intéressent un kiteur remontent en premier */
const CATEGORIES_PRIORITAIRES = new Set([
  'beach',
  'bay',
  'strait',
  'water',
  'coastline',
  'marina',
  'reservoir',
])

function construireLocalite(p: PhotonFeature['properties']): string {
  return [p.district, p.city ?? p.county, p.state]
    .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i)
    .slice(0, 2)
    .join(', ')
}

function convertir(f: PhotonFeature, index: number): ResultatLieu | null {
  const p = f.properties
  const nom = p.name ?? p.street ?? p.city ?? p.district
  if (!nom) return null
  const [lon, lat] = f.geometry.coordinates
  return {
    cle: `${p.osm_id ?? index}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
    nom,
    localite: construireLocalite(p),
    pays: p.country ?? '',
    lat,
    lon,
    categorie: p.osm_value ?? p.osm_key ?? '',
  }
}

/**
 * Reconnaît des coordonnées GPS saisies directement.
 * Accepte « 38.30, -8.78 », « 38.30 -8.78 », « 38.30/-8.78 ».
 */
export function lireCoordonnees(saisie: string): { lat: number; lon: number } | null {
  const m = saisie
    .trim()
    .match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;/\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1].replace(',', '.'))
  const lon = Number(m[2].replace(',', '.'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

export async function rechercherLieu(
  requete: string,
  signal?: AbortSignal,
): Promise<ResultatLieu[]> {
  const q = requete.trim()
  if (q.length < 2) return []

  const url = new URL(PHOTON_SEARCH)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '12')
  url.searchParams.set('lang', 'fr')

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error('Le service de recherche de lieux est indisponible')
  const data = await res.json()

  const lieux = (data.features as PhotonFeature[])
    .map(convertir)
    .filter((l): l is ResultatLieu => l !== null)

  // Plages et plans d'eau d'abord : c'est ce qu'on cherche en kite
  return lieux.sort((a, b) => {
    const pa = CATEGORIES_PRIORITAIRES.has(a.categorie) ? 0 : 1
    const pb = CATEGORIES_PRIORITAIRES.has(b.categorie) ? 0 : 1
    return pa - pb
  })
}

/** Recherche inverse : donne un nom lisible à la position GPS du navigateur */
export async function nommerPosition(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ResultatLieu | null> {
  const url = new URL(PHOTON_REVERSE)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('limit', '1')
  url.searchParams.set('lang', 'fr')

  try {
    const res = await fetch(url.toString(), { signal })
    if (!res.ok) return null
    const data = await res.json()
    const feature = (data.features as PhotonFeature[])[0]
    return feature ? convertir(feature, 0) : null
  } catch {
    return null
  }
}
