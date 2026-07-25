/**
 * Vérification du moteur d'analyse sur des cas réels connus des kiteurs.
 * On contrôle que le raisonnement automatique retrouve ce qu'un rider
 * expérimenté dirait du spot dans ces conditions.
 *
 * Lancer avec : npm run verif
 */
import spotsData from '../src/data/spots.json'
import { analyserDirection } from '../src/lib/direction'
import { recommanderVoile } from '../src/lib/voile'
import { analyserConditions } from '../src/lib/scoring'
import { construireVerdict } from '../src/lib/verdict'
import type { Spot } from '../src/types/spot'
import type { Lieu } from '../src/types/lieu'
import type { Profil } from '../src/types/profile'
import type { ConditionsHoraires } from '../src/services/weather'

const spots = spotsData as Spot[]

function lieuDeSpot(id: string): Lieu {
  const s = spots.find((x) => x.id === id)
  if (!s) throw new Error(`spot introuvable: ${id}`)
  return {
    id: s.id, nom: s.name, localite: s.locality, pays: s.country,
    lat: s.lat, lon: s.lon, orientation: s.orientation, sourceOrientation: 'curatee',
    estLagune: s.type.includes('lagune'), type: s.type, niveau: s.niveau,
    popularite: s.popularite, maree: s.maree, acces: s.acces, notes: s.notes,
  }
}

let echecs = 0
function verifie(nom: string, obtenu: string, attendu: string) {
  const ok = obtenu === attendu
  if (!ok) echecs++
  console.log(`${ok ? '  ok  ' : ' ECHEC'} ${nom}`)
  if (!ok) console.log(`         obtenu=${obtenu} attendu=${attendu}`)
}

console.log('\n=== 1. DIRECTION DU VENT RELATIVE AU LITTORAL ===')
const orient = (id: string) => lieuDeSpot(id).orientation!
const lagune = (id: string) => lieuDeSpot(id).estLagune

verifie('Tarifa Los Lances / Levante (E) = side-offshore',
  analyserDirection(90, orient('tarifa-los-lances'), lagune('tarifa-los-lances'))!.orientation, 'side-offshore')
verifie('Tarifa Los Lances / Poniente (O) = side-onshore',
  analyserDirection(270, orient('tarifa-los-lances'), lagune('tarifa-los-lances'))!.orientation, 'side-onshore')
verifie('Almanarre / Mistral (NO) = side-onshore',
  analyserDirection(315, orient('hyeres-almanarre'), lagune('hyeres-almanarre'))!.orientation, 'side-onshore')
verifie('Carvalhal / Nortada (N) = side-shore',
  analyserDirection(350, orient('praia-do-carvalhal'), lagune('praia-do-carvalhal'))!.orientation, 'side-shore')

const coussoules = analyserDirection(315, orient('leucate-les-coussoules'), lagune('leucate-les-coussoules'))!
verifie('Leucate Coussoules / Tramontane = side-offshore', coussoules.orientation, 'side-offshore')
verifie('Leucate Coussoules / danger neutralisé (lagune)', String(coussoules.danger), 'false')

const lacanauEst = analyserDirection(90, orient('lacanau-ocean'), lagune('lacanau-ocean'))!
verifie('Lacanau / vent d Est = offshore', lacanauEst.orientation, 'offshore')
verifie('Lacanau / vent d Est = danger', String(lacanauEst.danger), 'true')

verifie('Orientation inconnue => pas d analyse de direction',
  String(analyserDirection(90, null, false)), 'null')

console.log('\n=== 2. TAILLE DE VOILE (ancrage : 10 m² à 20 nds pour 75 kg) ===')
const profilRef: Profil = {
  id: 'ref', nom: 'Ref', poids: 75, niveau: 'intermédiaire',
  pratique: 'freeride', quiver: [7, 9, 12], preference: 'normal',
}
for (const vent of [12, 16, 20, 25, 30]) {
  const r = recommanderVoile(vent, profilRef)
  console.log(`  ${String(vent).padStart(2)} nds / 75 kg -> théorique ${r.tailleIdeale?.toFixed(1)} m² | quiver ${r.tailleRetenue ?? '—'} m² (${r.adequation})`)
}
const sansQuiver = recommanderVoile(20, { ...profilRef, quiver: [] })
verifie('Quiver vide => adequation inconnue (on ne prétend rien)', sansQuiver.adequation, 'inconnue')
verifie('Quiver vide => aucune taille retenue', String(sansQuiver.tailleRetenue), 'null')

console.log('\n=== 3. SCÉNARIOS COMPLETS ===')
const marine = { temperatureEauC: 19, hauteurVaguesM: 0.8 }
const cond = (v: number, g: number, dir: number, t: number): ConditionsHoraires => ({
  heure: '2026-07-25T14:00', ventNoeuds: v, rafalesNoeuds: g, directionDeg: dir,
  temperatureC: t, precipitationMm: 0, couvertureNuageusePct: 20,
})

const lieuInconnu: Lieu = {
  id: 'geo:1,1', nom: 'Lieu cherché', localite: 'Quelque part', pays: '',
  lat: 1, lon: 1, orientation: null, sourceOrientation: 'inconnue', estLagune: false,
}

const scenarios: { nom: string; lieu: Lieu; v: number; g: number; dir: number; t: number; profil: Profil }[] = [
  { nom: 'Carvalhal, nortada 18 nds', lieu: lieuDeSpot('praia-do-carvalhal'), v: 18, g: 21, dir: 350, t: 24, profil: profilRef },
  { nom: 'Carvalhal, 6 nds (pas de vent)', lieu: lieuDeSpot('praia-do-carvalhal'), v: 6, g: 9, dir: 350, t: 24, profil: profilRef },
  { nom: 'Lacanau, 20 nds mais vent de terre', lieu: lieuDeSpot('lacanau-ocean'), v: 20, g: 24, dir: 90, t: 22, profil: profilRef },
  { nom: 'Almanarre, mistral 26 nds', lieu: lieuDeSpot('hyeres-almanarre'), v: 26, g: 38, dir: 315, t: 21, profil: profilRef },
  { nom: 'Almanarre, meme vent / DEBUTANT', lieu: lieuDeSpot('hyeres-almanarre'), v: 26, g: 38, dir: 315, t: 21, profil: { ...profilRef, niveau: 'débutant' } },
  { nom: 'Almanarre, meme vent / EXPERT', lieu: lieuDeSpot('hyeres-almanarre'), v: 26, g: 38, dir: 315, t: 21, profil: { ...profilRef, niveau: 'expert' } },
  { nom: 'Lieu cherche, orientation inconnue, 18 nds', lieu: lieuInconnu, v: 18, g: 21, dir: 350, t: 24, profil: profilRef },
  { nom: 'Sans quiver renseigne, 18 nds', lieu: lieuDeSpot('praia-do-carvalhal'), v: 18, g: 21, dir: 350, t: 24, profil: { ...profilRef, quiver: [] } },
]

for (const s of scenarios) {
  const c = cond(s.v, s.g, s.dir, s.t)
  const a = analyserConditions(c, marine, s.lieu, s.profil)
  const v = construireVerdict(a)
  console.log(`\n  ▸ ${s.nom}`)
  console.log(`    ${a.scoreGlobal.toFixed(1)}/10 — ${v.titre.toUpperCase()} · ${v.sousTitre} [${v.ton}]`)
  console.log(`    ${a.criteres.map((cr) => `${cr.label} ${(cr.score * 10).toFixed(0)}`).join(' · ')}`)
  if (a.alertes.length) console.log(`    ⚠ ${a.alertes.join(' | ')}`)
}

// Le vent de terre doit rester bloquant quels que soient les autres critères
const lacanau = analyserConditions(cond(20, 24, 90, 22), marine, lieuDeSpot('lacanau-ocean'), profilRef)
verifie('\nVent de terre => verdict stop', construireVerdict(lacanau).ton, 'stop')
const debutantFort = analyserConditions(cond(26, 38, 315, 21), marine, lieuDeSpot('hyeres-almanarre'), { ...profilRef, niveau: 'débutant' })
verifie('26 nds pour un debutant => verdict stop', construireVerdict(debutantFort).ton, 'stop')
const interFort = analyserConditions(cond(26, 38, 315, 21), marine, lieuDeSpot('hyeres-almanarre'), profilRef)
verifie('26 nds pour un intermediaire => verdict go', construireVerdict(interFort).ton, 'go')

console.log(`\n${echecs === 0 ? '✓ TOUTES LES ASSERTIONS PASSENT' : `✗ ${echecs} ASSERTION(S) EN ÉCHEC`}\n`)
process.exit(echecs === 0 ? 0 : 1)
