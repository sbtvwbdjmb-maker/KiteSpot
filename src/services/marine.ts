const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine'

export interface DonneesMarines {
  temperatureEauC: number | null
  hauteurVaguesM: number | null
}

/**
 * Température de l'eau et hauteur de houle via l'API marine d'Open-Meteo.
 * Ce modèle ne couvre pas tous les plans d'eau (lagunes, étangs intérieurs) :
 * en cas d'absence de donnée on renvoie null plutôt que d'inventer une valeur,
 * et l'interface masque simplement l'information.
 */
export async function fetchMarine(lat: number, lon: number): Promise<DonneesMarines> {
  const url = new URL(MARINE_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'sea_surface_temperature,wave_height')
  url.searchParams.set('timezone', 'auto')

  try {
    const res = await fetch(url.toString())
    if (!res.ok) return { temperatureEauC: null, hauteurVaguesM: null }
    const data = await res.json()
    const courant = data?.current
    return {
      temperatureEauC: typeof courant?.sea_surface_temperature === 'number'
        ? courant.sea_surface_temperature
        : null,
      hauteurVaguesM: typeof courant?.wave_height === 'number' ? courant.wave_height : null,
    }
  } catch {
    return { temperatureEauC: null, hauteurVaguesM: null }
  }
}
