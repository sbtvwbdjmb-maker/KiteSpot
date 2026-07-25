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
import type { Profil } from '../src/types/profile'
import type { MeteoSpot } from '../src/services/weather'

const spots = spotsData as Spot[]
const get = (id: string) => {
  const s = spots.find((x) => x.id === id)
  if (!s) throw new Error(`spot introuvable: ${id}`)
  return s
}

let echecs = 0
function verifie(nom: string, obtenu: string, attendu: string) {
  const ok = obtenu === attendu
  if (!ok) echecs++
  console.log(`${ok ? '  ok  ' : ' ECHEC'} ${nom}`)
  if (!ok) console.log(`         obtenu=${obtenu} attendu=${attendu}`)
}

console.log('\n=== 1. DIRECTION DU VENT RELATIVE AU SPOT ===')
verifie(
  'Tarifa Los Lances / Levante (E) = side-offshore',
  analyserDirection(90, get('tarifa-los-lances')).orientation,
  'side-offshore',
)
verifie(
  'Tarifa Los Lances / Poniente (O) = side-onshore',
  analyserDirection(270, get('tarifa-los-lances')).orientation,
  'side-onshore',
)
verifie(
  'Hyeres Almanarre / Mistral (NO) = side-onshore',
  analyserDirection(315, get('hyeres-almanarre')).orientation,
  'side-onshore',
)
verifie(
  'Praia do Carvalhal / Nortada (N) = side-shore',
  analyserDirection(350, get('praia-do-carvalhal')).orientation,
  'side-shore',
)
const coussoules = analyserDirection(315, get('leucate-les-coussoules'))
verifie('Leucate Coussoules / Tramontane = side-offshore', coussoules.orientation, 'side-offshore')
verifie('Leucate Coussoules / danger neutralisé (lagune)', String(coussoules.danger), 'false')
const lacanauEst = analyserDirection(90, get('lacanau-ocean'))
verifie('Lacanau / vent d Est = offshore', lacanauEst.orientation, 'offshore')
verifie('Lacanau / vent d Est = danger', String(lacanauEst.danger), 'true')

console.log('\n=== 2. TAILLE DE VOILE (ancrage : 10 m² à 20 nds pour 75 kg) ===')
const profilRef: Profil = {
  id: 'ref', nom: 'Ref', poids: 75, niveau: 'intermédiaire',
  pratique: 'freeride', quiver: [7, 9, 12], preference: 'normal',
}
for (const vent of [12, 16, 20, 25, 30]) {
  const r = recommanderVoile(vent, profilRef)
  console.log(
    `  ${String(vent).padStart(2)} nds / 75 kg -> théorique ${r.tailleIdeale?.toFixed(1)} m² | quiver ${r.tailleRetenue ?? '—'} m² (${r.adequation})`,
  )
}
console.log('  -- effet du poids à 20 nœuds, gros quiver --')
for (const poids of [55, 75, 95]) {
  const r = recommanderVoile(20, { ...profilRef, poids, quiver: [5, 7, 9, 10, 12, 14] })
  console.log(`  ${poids} kg -> théorique ${r.tailleIdeale?.toFixed(1)} m² | retenu ${r.tailleRetenue} m²`)
}

console.log('\n=== 3. SCÉNARIOS COMPLETS ===')
const faireMeteo = (v: number, rafales: number, dir: number, temp: number): MeteoSpot => ({
  actuel: {
    heure: '2026-07-25T14:00', ventNoeuds: v, rafalesNoeuds: rafales, directionDeg: dir,
    temperatureC: temp, precipitationMm: 0, couvertureNuageusePct: 20,
  },
  previsions: [],
  leverSoleil: '2026-07-25T06:30',
  coucherSoleil: '2026-07-25T20:50',
})
const marine = { temperatureEauC: 19, hauteurVaguesM: 0.8 }

const scenarios = [
  { nom: 'Carvalhal, nortada 18 nds établie', spot: 'praia-do-carvalhal', v: 18, g: 21, dir: 350, t: 24, profil: profilRef },
  { nom: 'Carvalhal, 6 nds (pas de vent)', spot: 'praia-do-carvalhal', v: 6, g: 9, dir: 350, t: 24, profil: profilRef },
  { nom: 'Lacanau, 20 nds mais vent de terre', spot: 'lacanau-ocean', v: 20, g: 24, dir: 90, t: 22, profil: profilRef },
  { nom: 'Almanarre, mistral 26 nds rafaleux', spot: 'hyeres-almanarre', v: 26, g: 38, dir: 315, t: 21, profil: profilRef },
  { nom: 'Almanarre, même vent mais DÉBUTANT', spot: 'hyeres-almanarre', v: 26, g: 38, dir: 315, t: 21, profil: { ...profilRef, niveau: 'débutant' as const } },
  { nom: 'Lagoa Albufeira, 15 nds, débutant', spot: 'lagoa-de-albufeira', v: 15, g: 17, dir: 320, t: 23, profil: { ...profilRef, niveau: 'débutant' as const, quiver: [9, 12] } },
]

for (const s of scenarios) {
  const spot = get(s.spot)
  const m = faireMeteo(s.v, s.g, s.dir, s.t)
  const a = analyserConditions(m, marine, spot, s.profil)
  const v = construireVerdict(a, s.profil, spot, m.actuel)
  console.log(`\n  ▸ ${s.nom}`)
  console.log(`    ${a.scoreGlobal.toFixed(1)}/10 — ${v.titre.toUpperCase()} [${v.ton}]`)
  console.log(`    « ${v.phrase} »`)
  console.log(`    ${a.criteres.map((c) => `${c.label} ${(c.score * 10).toFixed(0)}/10`).join(' · ')}`)
  if (a.alertes.length) console.log(`    ⚠ ${a.alertes.join(' | ')}`)
}

console.log(`\n${echecs === 0 ? '✓ TOUTES LES ASSERTIONS PASSENT' : `✗ ${echecs} ASSERTION(S) EN ÉCHEC`}\n`)
process.exit(echecs === 0 ? 0 : 1)
