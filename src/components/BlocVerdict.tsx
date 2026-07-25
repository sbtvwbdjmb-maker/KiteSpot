import { useEffect, useState } from 'react'
import type { AnalyseConditions } from '../lib/scoring'
import type { Verdict } from '../lib/verdict'
import type { ConditionsHoraires } from '../services/weather'
import type { DonneesMarines } from '../services/marine'
import type { Spot } from '../types/spot'
import { CadranVent } from './CadranVent'
import { degresVersCardinal } from '../lib/direction'

interface Props {
  spot: Spot
  analyse: AnalyseConditions
  verdict: Verdict
  conditions: ConditionsHoraires
  marine: DonneesMarines
  /** null = maintenant, sinon on projette sur une heure de prévision */
  heureProjetee: string | null
}

// Le score monte progressivement : on lit la valeur finale, pas une apparition brutale
function useScoreAnime(cible: number) {
  const [valeur, setValeur] = useState(0)

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduit) {
      setValeur(cible)
      return
    }
    let frame = 0
    const depart = performance.now()
    const duree = 850
    const boucle = (t: number) => {
      const p = Math.min(1, (t - depart) / duree)
      // easing out cubic
      setValeur(cible * (1 - Math.pow(1 - p, 3)))
      if (p < 1) frame = requestAnimationFrame(boucle)
    }
    frame = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(frame)
  }, [cible])

  return valeur
}

export function BlocVerdict({ spot, analyse, verdict, conditions, marine, heureProjetee }: Props) {
  const score = useScoreAnime(analyse.scoreGlobal)

  const heureLisible = heureProjetee
    ? new Date(heureProjetee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <section className="relative">
      {heureLisible && (
        <p className="monte mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 font-mono text-[11px] tracking-wide text-muted">
          PROJECTION À {heureLisible}
        </p>
      )}

      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Colonne décision — toujours en premier : sur mobile, la réponse doit
            être lisible sans défiler, le cadran ne fait que la justifier. */}
        <div>
          <p
            className="monte font-mono text-[11px] tracking-[0.28em] text-muted"
            style={{ animationDelay: '60ms' }}
          >
            VERDICT KITESPOT
          </p>

          <h2
            className="monte mt-2 font-display text-[clamp(2.4rem,7vw,3.9rem)] leading-[0.95] font-bold tracking-tight"
            style={{ color: 'var(--verdict)', animationDelay: '120ms' }}
          >
            {verdict.titre}
          </h2>

          <div className="monte mt-4 flex items-baseline gap-3" style={{ animationDelay: '200ms' }}>
            <span className="tabular font-mono text-4xl font-medium text-foam">
              {score.toFixed(1)}
            </span>
            <span className="font-mono text-sm text-dim">/ 10</span>
            <div className="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${score * 10}%`, background: 'var(--verdict)' }}
              />
            </div>
          </div>

          <p
            className="monte mt-5 max-w-prose text-[1.02rem] leading-relaxed text-foam/85"
            style={{ animationDelay: '280ms' }}
          >
            {verdict.phrase}
          </p>

          {/* Bandeau de lecture : chaque valeur mesurée en mono */}
          <dl
            className="monte mt-6 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4"
            style={{ animationDelay: '360ms' }}
          >
            <Lecture label="VENT" valeur={`${Math.round(conditions.ventNoeuds)}`} unite="nds" />
            <Lecture
              label="DIRECTION"
              valeur={degresVersCardinal(conditions.directionDeg)}
              unite={analyse.direction.label.toLowerCase()}
            />
            <Lecture
              label="VOILE"
              valeur={analyse.voile.tailleRetenue ? `${analyse.voile.tailleRetenue}` : '—'}
              unite={analyse.voile.tailleRetenue ? 'm²' : 'aucune'}
              estime
            />
            <Lecture
              label="AIR / EAU"
              valeur={`${Math.round(conditions.temperatureC)}°`}
              unite={marine.temperatureEauC !== null ? `eau ${Math.round(marine.temperatureEauC)}°` : 'eau n.c.'}
            />
          </dl>
        </div>

        {/* Colonne cadran */}
        <div className="monte" style={{ animationDelay: '160ms' }}>
          <CadranVent
            directionDeg={conditions.directionDeg}
            orientationSpot={spot.orientation}
            ventNoeuds={conditions.ventNoeuds}
            rafalesNoeuds={conditions.rafalesNoeuds}
            analyse={analyse.direction}
          />
          <p className="mt-3 text-center">
            <span
              className="font-mono text-[11px] tracking-[0.18em]"
              style={{
                color:
                  analyse.direction.score >= 0.8
                    ? 'var(--color-go)'
                    : analyse.direction.score >= 0.45
                      ? 'var(--color-warn)'
                      : 'var(--color-stop)',
              }}
            >
              {analyse.direction.label.toUpperCase()}
            </span>
          </p>
          <p className="mx-auto mt-1.5 max-w-[19rem] text-center text-[13px] leading-snug text-muted">
            {analyse.direction.commentaire}
          </p>
        </div>
      </div>

      {analyse.alertes.length > 0 && (
        <ul className="monte mt-7 space-y-2" style={{ animationDelay: '440ms' }}>
          {analyse.alertes.map((alerte) => (
            <li
              key={alerte}
              className="flex gap-2.5 rounded-lg border border-line/60 bg-surface/50 px-3.5 py-2.5 text-[13px] leading-snug text-foam/80"
            >
              <span aria-hidden className="text-warn">
                ▲
              </span>
              {alerte}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Lecture({
  label,
  valeur,
  unite,
  estime,
}: {
  label: string
  valeur: string
  unite: string
  estime?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] tracking-[0.16em] text-dim">
        {label}
        {estime && <span className="ml-1 text-[9px] text-dim/70">est.</span>}
      </dt>
      <dd className="mt-1 min-w-0">
        <span className="tabular font-mono text-xl text-foam">{valeur}</span>
        {/* L'unité passe sous la valeur : « side-offshore » ne déborde plus sur la colonne suivante */}
        <span className="block truncate font-mono text-[11px] text-muted">{unite}</span>
      </dd>
    </div>
  )
}
