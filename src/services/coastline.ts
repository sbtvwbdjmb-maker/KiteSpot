const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'

const NB_SECTEURS = 16
const RAYON_KM = 3

/**
 * Garde-fous calibrés sur des spots dont l'orientation est connue et vérifiée.
 * Un littoral droit occupe un arc de mer d'environ un demi-cercle (8 secteurs) ;
 * au-delà, on a affaire à une île, un tombolo ou une presqu'île, et le milieu
 * de l'arc ne veut plus rien dire.
 */
const ARC_MINI = 3
const ARC_MAXI = 8
/** Au-delà, le point est quasi entouré d'eau : île ou plaine au niveau de la mer */
const SECTEURS_MER_MAXI = 12
/** L'arc principal doit dominer, sinon deux plans d'eau s'opposent (isthme) */
const PART_ARC_MINI = 0.6

export interface OrientationDeduite {
  /** cap vers le large, ou null si le relief ne permet pas de conclure */
  orientation: number | null
  secteursMer: number
  /** taille de l'arc de mer retenu, en secteurs de 22,5° */
  arc: number
}

function couronne(lat0: number, lon0: number) {
  const lats: number[] = []
  const lons: number[] = []
  for (let i = 0; i < NB_SECTEURS; i++) {
    const a = (i * (360 / NB_SECTEURS) * Math.PI) / 180
    const dLat = (RAYON_KM / 111.32) * Math.cos(a)
    const dLon = (RAYON_KM / (111.32 * Math.cos((lat0 * Math.PI) / 180))) * Math.sin(a)
    lats.push(Number((lat0 + dLat).toFixed(4)))
    lons.push(Number((lon0 + dLon).toFixed(4)))
  }
  return { lats, lons }
}

/** Plus long enchaînement circulaire de secteurs « mer » */
function plusGrandArc(secteurs: number[]): { debut: number; longueur: number } | null {
  const presents = new Set(secteurs)
  if (presents.size === 0 || presents.size === NB_SECTEURS) return null

  let meilleur: { debut: number; longueur: number } | null = null
  for (const debut of secteurs) {
    // On ne repart que du premier secteur d'un arc
    if (presents.has((debut - 1 + NB_SECTEURS) % NB_SECTEURS)) continue
    let longueur = 0
    while (presents.has((debut + longueur) % NB_SECTEURS) && longueur < NB_SECTEURS) longueur++
    if (!meilleur || longueur > meilleur.longueur) meilleur = { debut, longueur }
  }
  return meilleur
}

/**
 * Déduit l'orientation du littoral en échantillonnant l'altitude sur une
 * couronne autour du point : les secteurs à altitude nulle sont de l'eau, et le
 * cap vers le large est le milieu du plus grand arc de mer contigu.
 *
 * On prend le plus grand arc plutôt que la moyenne de tous les secteurs marins
 * parce qu'un plan d'eau parasite au niveau de la mer — les rizières de
 * Comporta, un étang littoral — fausse la moyenne alors qu'il ne perturbe pas
 * l'arc principal.
 *
 * Fiable sur un littoral ouvert (écart d'une dizaine de degrés face aux relevés
 * vérifiés à la main), la méthode ne sait pas trancher sur les géographies à
 * double exposition : elle refuse alors de conclure. Elle reste faillible sur
 * une presqu'île comme Tarifa, d'où l'étiquetage « estimée » et le réglage manuel.
 */
export async function deduireOrientation(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<OrientationDeduite> {
  const echec: OrientationDeduite = { orientation: null, secteursMer: 0, arc: 0 }

  const { lats, lons } = couronne(lat, lon)
  const url = new URL(ELEVATION_URL)
  url.searchParams.set('latitude', lats.join(','))
  url.searchParams.set('longitude', lons.join(','))

  try {
    const res = await fetch(url.toString(), { signal })
    if (!res.ok) return echec
    const data = await res.json()
    const altitudes: (number | null)[] = data.elevation ?? []

    const secteursMer = altitudes
      .map((alt, i) => ({ alt, i }))
      .filter(({ alt }) => typeof alt === 'number' && alt <= 0)
      .map(({ i }) => i)

    // Aucun plan d'eau, ou point quasi entouré d'eau : on ne conclut pas
    if (secteursMer.length === 0 || secteursMer.length >= SECTEURS_MER_MAXI) {
      return { ...echec, secteursMer: secteursMer.length }
    }

    const arc = plusGrandArc(secteursMer)
    if (!arc) return { ...echec, secteursMer: secteursMer.length }

    const partDominante = arc.longueur / secteursMer.length
    if (
      arc.longueur < ARC_MINI ||
      arc.longueur > ARC_MAXI ||
      partDominante < PART_ARC_MINI
    ) {
      return { orientation: null, secteursMer: secteursMer.length, arc: arc.longueur }
    }

    const milieu = (arc.debut + (arc.longueur - 1) / 2) % NB_SECTEURS
    const cap = (milieu * (360 / NB_SECTEURS)) % 360
    return {
      orientation: Math.round(cap),
      secteursMer: secteursMer.length,
      arc: arc.longueur,
    }
  } catch {
    return echec
  }
}
