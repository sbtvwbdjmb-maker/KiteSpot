const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** Une observation ou une prévision horaire, telle que fournie par Open-Meteo */
export interface ConditionsHoraires {
  heure: string
  ventNoeuds: number
  rafalesNoeuds: number
  directionDeg: number
  temperatureC: number
  precipitationMm: number
  couvertureNuageusePct: number
}

/** Lever et coucher du soleil d'une journée, indexés par date ISO (AAAA-MM-JJ) */
export interface JourSoleil {
  date: string
  leverSoleil: string
  coucherSoleil: string
}

export interface MeteoSpot {
  actuel: ConditionsHoraires
  previsions: ConditionsHoraires[]
  /** un élément par jour de prévision */
  jours: JourSoleil[]
  /** raccourcis sur le jour courant */
  leverSoleil: string
  coucherSoleil: string
}

interface ReponseOpenMeteo {
  current: {
    time: string
    wind_speed_10m: number
    wind_direction_10m: number
    wind_gusts_10m: number
    temperature_2m: number
    precipitation: number
    cloud_cover: number
  }
  hourly: {
    time: string[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    wind_gusts_10m: number[]
    temperature_2m: number[]
    precipitation: number[]
    cloud_cover: number[]
  }
  daily: {
    time: string[]
    sunrise: string[]
    sunset: string[]
  }
}

/** Récupère le vent, la température et les prévisions horaires pour un point donné */
export async function fetchMeteo(lat: number, lon: number): Promise<MeteoSpot> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set(
    'current',
    'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation,cloud_cover',
  )
  url.searchParams.set(
    'hourly',
    'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation,cloud_cover',
  )
  url.searchParams.set('daily', 'sunrise,sunset')
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('wind_speed_unit', 'kn')
  url.searchParams.set('timezone', 'auto')
  // `best_match` d'Open-Meteo est une sélection opaque qui peut mélanger
  // plusieurs fournisseurs (AROME, ICON, GFS, ECMWF) selon le point demandé,
  // avec des sauts de modèle imprévisibles d'un appel à l'autre. On fixe
  // explicitement la chaîne Météo-France (ARPEGE → AROME → AROME HD, la plus
  // fine disponible étant choisie automatiquement) : c'est le modèle de
  // référence pour le vent côtier français, celui que la plupart des riders
  // comparent sur Windguru, et un choix stable plutôt qu'un blend variable.
  // `cell_selection=sea` a été retiré : mesuré sur les spots français de la
  // base, il fait parfois basculer vers une maille bien plus grossière sans
  // bénéfice fiable ; la maille par défaut est déjà cohérente avec la côte.
  url.searchParams.set('models', 'meteofrance_seamless')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Open-Meteo a refusé la requête météo')
  const data: ReponseOpenMeteo = await res.json()

  const actuel: ConditionsHoraires = {
    heure: data.current.time,
    ventNoeuds: data.current.wind_speed_10m,
    rafalesNoeuds: data.current.wind_gusts_10m,
    directionDeg: data.current.wind_direction_10m,
    temperatureC: data.current.temperature_2m,
    precipitationMm: data.current.precipitation,
    couvertureNuageusePct: data.current.cloud_cover,
  }

  const previsions: ConditionsHoraires[] = data.hourly.time.map((heure, i) => ({
    heure,
    ventNoeuds: data.hourly.wind_speed_10m[i],
    rafalesNoeuds: data.hourly.wind_gusts_10m[i],
    directionDeg: data.hourly.wind_direction_10m[i],
    temperatureC: data.hourly.temperature_2m[i],
    precipitationMm: data.hourly.precipitation[i],
    couvertureNuageusePct: data.hourly.cloud_cover[i],
  }))

  const jours: JourSoleil[] = data.daily.time.map((date, i) => ({
    date,
    leverSoleil: data.daily.sunrise[i],
    coucherSoleil: data.daily.sunset[i],
  }))

  return {
    actuel,
    previsions,
    jours,
    leverSoleil: jours[0]?.leverSoleil,
    coucherSoleil: jours[0]?.coucherSoleil,
  }
}

export interface VentActuel {
  ventNoeuds: number
  rafalesNoeuds: number
  directionDeg: number
  temperatureC: number
}

/**
 * Version allégée : uniquement le vent instantané.
 * Utilisée pour les vignettes de spots, où charger les prévisions complètes
 * de chaque spot serait inutilement lourd.
 */
export async function fetchVentActuel(lat: number, lon: number): Promise<VentActuel> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m')
  url.searchParams.set('wind_speed_unit', 'kn')
  url.searchParams.set('timezone', 'auto')
  // Cohérent avec fetchMeteo : même chaîne Météo-France explicite pour les vignettes de spots.
  url.searchParams.set('models', 'meteofrance_seamless')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Open-Meteo a refusé la requête vent')
  const data = await res.json()
  return {
    ventNoeuds: data.current.wind_speed_10m,
    rafalesNoeuds: data.current.wind_gusts_10m,
    directionDeg: data.current.wind_direction_10m,
    temperatureC: data.current.temperature_2m,
  }
}
