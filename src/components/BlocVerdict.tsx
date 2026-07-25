import { useEffect, useState } from 'react'
import type { AnalyseConditions } from '../lib/scoring'
import type { Verdict } from '../lib/verdict'
import type { ConditionsHoraires } from '../services/weather'
import type { Lieu } from '../types/lieu'
import { CadranVent } from './CadranVent'
import { degresVersCardinal } from '../lib/direction'

interface Props {
  lieu: Lieu
  analyse: AnalyseConditions
  verdict: Verdict
  conditions: ConditionsHoraires
  /** null = maintenant, sinon on projette sur une heure de prévision */
  heureProjetee: string | null
}

// Le score monte progressivement : on lit la valeur finale, pas une apparition brutale
function useScoreAnime(cible: number) {
  const [valeur, setValeur] = useState(cible)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValeur(cible)
      return
    }
    let frame = 0
    const depart = performance.now()
    const initial = 0
    const boucle = (t: number) => {
      const p = Math.min(1, (t - depart) / 850)
      setValeur(initial + (cible - initial) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) frame = requestAnimationFrame(boucle)
    }
    frame = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(frame)
  }, [cible])

  return valeur
}

export function BlocVerdict({ lieu, analyse, verdict, conditions, heureProjetee }: Props) {
  const score = useScoreAnime(analyse.scoreGlobal)

  const heureLisible = heureProjetee
    ? new Date(heureProjetee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null

  const voile = analyse.voile

  return (
    <section>
      {heureLisible && (
        <p className="mb-3 inline-flex rounded-full border border-line bg-surface/70 px-3 py-1 font-mono text-[11px] tracking-wide text-muted">
          PROJECTION À {heureLisible}
        </p>
      )}

      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <p className="monte font-mono text-[11px] tracking-[0.28em] text-muted">VERDICT KITESPOT</p>

          <h2
            className="monte mt-2 font-display text-[clamp(2.4rem,7vw,3.9rem)] leading-[0.95] font-bold tracking-tight"
            style={{ color: 'var(--verdict)', animationDelay: '80ms' }}
          >
            {verdict.titre}
          </h2>
          <p className="monte mt-1 text-[14px] text-muted" style={{ animationDelay: '140ms' }}>
            {verdict.sousTitre}
          </p>

          <div className="monte mt-5 flex items-baseline gap-3" style={{ animationDelay: '200ms' }}>
            <span className="tabular font-mono text-4xl font-medium text-foam">{score.toFixed(1)}</span>
            <span className="font-mono text-sm text-dim">/ 10</span>
            <div className="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${score * 10}%`, background: 'var(--verdict)' }}
              />
            </div>
          </div>

          {/* Les quatre chiffres qui décident. Rien d'autre. */}
          <dl className="monte mt-7 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4" style={{ animationDelay: '280ms' }}>
            <Lecture
              icone="💨"
              valeur={String(Math.round(conditions.ventNoeuds))}
              unite="nds"
              detail={`rafales ${Math.round(conditions.rafalesNoeuds)}`}
            />
            <Lecture
              icone="🧭"
              valeur={degresVersCardinal(conditions.directionDeg)}
              unite={analyse.direction ? analyse.direction.label.toLowerCase() : 'non évaluée'}
            />
            <Lecture
              icone="🪁"
              valeur={voile.tailleRetenue ? String(voile.tailleRetenue) : voile.tailleIdeale ? `~${voile.tailleIdeale.toFixed(0)}` : '—'}
              unite="m²"
              detail={voile.tailleRetenue ? 'dans ton quiver' : 'estimation'}
            />
            <Lecture icone="🌡️" valeur={`${Math.round(conditions.temperatureC)}°`} unite="air" />
          </dl>
        </div>

        <div className="monte" style={{ animationDelay: '160ms' }}>
          <CadranVent
            directionDeg={conditions.directionDeg}
            orientationLittoral={lieu.orientation}
            ventNoeuds={conditions.ventNoeuds}
            rafalesNoeuds={conditions.rafalesNoeuds}
            analyse={analyse.direction}
          />
        </div>
      </div>

      {analyse.alertes.length > 0 && (
        <ul className="monte mt-7 space-y-2" style={{ animationDelay: '380ms' }}>
          {analyse.alertes.map((alerte) => (
            <li
              key={alerte}
              className="flex gap-2.5 rounded-lg border border-line/60 bg-surface/50 px-3.5 py-2.5 text-[13px] leading-snug text-foam/80"
            >
              <span aria-hidden className="text-warn">▲</span>
              {alerte}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Lecture({
  icone,
  valeur,
  unite,
  detail,
}: {
  icone: string
  valeur: string
  unite: string
  detail?: string
}) {
  return (
    <div className="min-w-0">
      <span aria-hidden className="text-[13px] opacity-70">
        {icone}
      </span>
      <dd className="mt-0.5 min-w-0">
        <span className="tabular font-mono text-2xl text-foam">{valeur}</span>
        <span className="ml-1 font-mono text-[11px] text-muted">{unite}</span>
      </dd>
      {detail && <dt className="mt-0.5 truncate font-mono text-[10px] text-dim">{detail}</dt>}
    </div>
  )
}
