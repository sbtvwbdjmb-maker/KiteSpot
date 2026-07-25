/**
 * Contrôle que les résumés journaliers et les couleurs de la timeline sortent
 * bien de données réelles et varient d'un jour à l'autre.
 *
 * Lancer avec : npm run verif:jours -- [idSpot] [niveau]
 */
import spotsData from '../src/data/spots.json'
import { fetchMeteo } from '../src/services/weather'
import { fetchMarine } from '../src/services/marine'
import { resumerJours } from '../src/lib/jours'
import { scoreHorairePourSport, type Sport } from '../src/lib/sport'
import { paletteScore } from '../src/lib/couleurs'
import type { Spot } from '../src/types/spot'
import type { Lieu } from '../src/types/lieu'
import type { NiveauRider, Profil } from '../src/types/profile'

const idSpot = process.argv[2] ?? 'praia-do-carvalhal'
const niveau = (process.argv[3] ?? 'intermédiaire') as NiveauRider

const spots = spotsData as Spot[]
const s = spots.find((x) => x.id === idSpot)
if (!s) throw new Error(`spot introuvable: ${idSpot}`)

const lieu: Lieu = {
  id: s.id, nom: s.name, localite: s.locality, pays: s.country, lat: s.lat, lon: s.lon,
  orientation: s.orientation, sourceOrientation: 'curatee', estLagune: s.type.includes('lagune'),
  type: s.type, niveau: s.niveau, popularite: s.popularite, maree: s.maree,
  acces: s.acces, notes: s.notes,
}
const profil: Profil = {
  id: 'p', nom: 'Test', poids: 75, niveau, pratique: 'freeride', quiver: [], preference: 'normal',
}

const PASTILLE: Record<string, string> = {
  excellent: '🟢', correct: '🟡', faible: '🟠', mauvais: '🔴',
}
const pastille = (score: number | null) => (score === null ? '⚪' : PASTILLE[paletteScore(score).cle])

async function main() {
  console.log(`\nSpot : ${s!.name} — profil ${niveau}\n`)

  const [meteo, marine] = await Promise.all([
    fetchMeteo(s!.lat, s!.lon),
    fetchMarine(s!.lat, s!.lon),
  ])

  console.log(
    `Couverture marine : ${marine.horsCouverture ? 'HORS COUVERTURE' : 'ok'}` +
      ` | maille à ${marine.distanceMailleKm?.toFixed(1) ?? '—'} km` +
      `${marine.mailleEloignee ? ' (ÉLOIGNÉE → pas de score surf)' : ''}`,
  )
  console.log(`Jours de prévision reçus : ${meteo.jours.length}`)

  for (const sport of ['kite', 'surf'] as Sport[]) {
    console.log(`\n=== ${sport.toUpperCase()} — meilleur score par jour ===`)
    const jours = resumerJours(meteo, marine, lieu, profil, sport)
    for (const j of jours) {
      const h = j.meilleureHeure ? `${new Date(j.meilleureHeure).getHours()}h` : '—'
      const note = j.meilleurScore === null ? 'indisponible' : `${j.meilleurScore.toFixed(1)}/10`
      console.log(`  ${pastille(j.meilleurScore)} ${j.label.padEnd(9)} ${note.padStart(12)}  pic à ${h}`)
    }

    // Détail horaire du premier jour : c'est ce que colore la timeline
    const jour1 = jours[0]
    const ligne = jour1.heures
      .filter((h) => {
        const t = new Date(h.heure).getTime()
        return t >= new Date(jour1.leverSoleil).getTime() && t <= new Date(jour1.coucherSoleil).getTime()
      })
      .map((h) => {
        const sc = scoreHorairePourSport(sport, h, marine, lieu, profil)
        return `${new Date(h.heure).getHours()}h${pastille(sc)}`
      })
    console.log(`  aujourd'hui : ${ligne.join(' ')}`)
  }
  console.log()
}

void main()
