/**
 * Contrôle quels spots reçoivent un score surf et pourquoi les autres non.
 * Sert à vérifier que la règle « pas de houle en plan d'eau fermé » écarte
 * les bons spots, sans bloquer des spots de surf légitimes.
 *
 * Lancer avec : npm run verif:surf
 */
import spotsData from '../src/data/spots.json'
import { fetchMeteo } from '../src/services/weather'
import { fetchMarine } from '../src/services/marine'
import { analyserSurf } from '../src/lib/surf'
import type { Spot } from '../src/types/spot'
import type { Lieu } from '../src/types/lieu'
import type { Profil } from '../src/types/profile'

const spots = spotsData as Spot[]
const profil: Profil = {
  id: 'p', nom: 'Test', poids: 75, niveau: 'intermédiaire',
  pratique: 'freeride', quiver: [], preference: 'normal',
}

function versLieu(s: Spot): Lieu {
  return {
    id: s.id, nom: s.name, localite: s.locality, pays: s.country, lat: s.lat, lon: s.lon,
    orientation: s.orientation, sourceOrientation: 'curatee', estLagune: s.type.includes('lagune'),
    type: s.type, niveau: s.niveau, popularite: s.popularite, maree: s.maree,
    acces: s.acces, notes: s.notes,
  }
}

async function main() {
  const notes: string[] = []
  const lagunes: string[] = []
  const sansModele: string[] = []

  console.log(`\n${'spot'.padEnd(34)} ${'maille'.padStart(8)}  résultat surf\n${'-'.repeat(80)}`)

  for (const s of spots) {
    const lieu = versLieu(s)
    const [meteo, marine] = await Promise.all([
      fetchMeteo(s.lat, s.lon),
      fetchMarine(s.lat, s.lon),
    ])
    const a = analyserSurf(meteo.actuel, marine.actuel, lieu, profil, {
      mailleLointaine: marine.mailleLointaine,
      horsCouverture: marine.horsCouverture,
      distanceMailleKm: marine.distanceMailleKm,
    })

    const maille = marine.distanceMailleKm !== null ? `${marine.distanceMailleKm.toFixed(1)}km` : '—'
    let resultat: string
    if (a.scoreGlobal !== null) {
      resultat = `${a.scoreGlobal.toFixed(1)}/10`
      notes.push(s.name)
      if (marine.mailleLointaine) resultat += '  (lecture approximative)'
    } else if (lieu.estLagune) {
      resultat = 'écarté — plan d’eau fermé'
      lagunes.push(s.name)
    } else {
      resultat = 'écarté — hors modèle'
      sansModele.push(s.name)
    }
    console.log(`${s.name.slice(0, 34).padEnd(34)} ${maille.padStart(8)}  ${resultat}`)
    await new Promise((r) => setTimeout(r, 120))
  }

  console.log(
    `\n  ${notes.length} spots notés · ${lagunes.length} écartés (plan d'eau fermé) · ` +
      `${sansModele.length} écartés (hors modèle)\n`,
  )
  if (lagunes.length) console.log(`  Plans d'eau fermés : ${lagunes.join(', ')}\n`)
  if (sansModele.length) console.log(`  Hors modèle : ${sansModele.join(', ')}\n`)
}

void main()
