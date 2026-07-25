const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

export interface VilleResultat {
  id: number
  nom: string
  pays: string
  region?: string
  lat: number
  lon: number
}

// Recherche une ville par son nom via l'API de géocodage gratuite d'Open-Meteo
export async function rechercherVille(query: string, count = 5): Promise<VilleResultat[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const url = new URL(GEOCODING_URL)
  url.searchParams.set('name', q)
  url.searchParams.set('count', String(count))
  url.searchParams.set('language', 'fr')
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error('Erreur lors de la recherche de ville')
  }
  const data = await res.json()

  return (data.results ?? []).map((r: {
    id: number
    name: string
    country: string
    admin1?: string
    latitude: number
    longitude: number
  }) => ({
    id: r.id,
    nom: r.name,
    pays: r.country,
    region: r.admin1,
    lat: r.latitude,
    lon: r.longitude,
  }))
}
