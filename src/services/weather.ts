const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

export interface ConditionsVent {
  heure: string
  vitesseNoeuds: number
  directionDeg: number
  rafalesNoeuds: number
}

export interface DonneesVent {
  actuel: ConditionsVent
  previsions: ConditionsVent[]
}

interface ReponseOpenMeteo {
  current: {
    time: string
    wind_speed_10m: number
    wind_direction_10m: number
    wind_gusts_10m: number
  }
  hourly?: {
    time: string[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    wind_gusts_10m: number[]
  }
}

// Récupère le vent actuel + prévisions horaires (en nœuds) pour un point donné
export async function fetchVent(lat: number, lon: number, avecPrevisions = true): Promise<DonneesVent> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m')
  if (avecPrevisions) {
    url.searchParams.set('hourly', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m')
    url.searchParams.set('forecast_days', '2')
  }
  url.searchParams.set('wind_speed_unit', 'kn')
  url.searchParams.set('timezone', 'auto')

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error('Erreur lors de la récupération de la météo')
  }
  const data: ReponseOpenMeteo = await res.json()

  const actuel: ConditionsVent = {
    heure: data.current.time,
    vitesseNoeuds: data.current.wind_speed_10m,
    directionDeg: data.current.wind_direction_10m,
    rafalesNoeuds: data.current.wind_gusts_10m,
  }

  const previsions: ConditionsVent[] = data.hourly
    ? data.hourly.time.map((heure, i) => ({
        heure,
        vitesseNoeuds: data.hourly!.wind_speed_10m[i],
        directionDeg: data.hourly!.wind_direction_10m[i],
        rafalesNoeuds: data.hourly!.wind_gusts_10m[i],
      }))
    : []

  return { actuel, previsions }
}

// Convertit une direction en degrés (météo : direction d'où vient le vent) en point cardinal
export function degresVersCardinal(deg: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
  const index = Math.round(deg / 22.5) % 16
  return points[index]
}
