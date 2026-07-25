import { useMemo } from 'react'
import type { ConditionsHoraires } from '../services/weather'
import type { Lieu } from '../types/lieu'
import type { Profil } from '../types/profile'
import { scoreHoraire, type Creneau } from '../lib/scoring'

interface Props {
  previsions: ConditionsHoraires[]
  lieu: Lieu
  profil: Profil
  creneau: Creneau | null
  heureSelectionnee: string | null
  onSelectionner: (heure: string | null) => void
  coucherSoleil: string
}

/** Trois niveaux seulement : on doit lire la journée d'un coup d'œil. */
function couleurScore(score: number): string {
  if (score >= 6.8) return 'var(--color-go)'
  if (score >= 3.8) return 'var(--color-warn)'
  return 'var(--color-stop)'
}

export function Timeline({
  previsions,
  lieu,
  profil,
  creneau,
  heureSelectionnee,
  onSelectionner,
  coucherSoleil,
}: Props) {
  const heures = useMemo(() => {
    const depuis = Date.now() - 3600_000
    return previsions
      .filter((h) => new Date(h.heure).getTime() >= depuis)
      .slice(0, 18)
      .map((h) => ({ ...h, score: scoreHoraire(h, lieu, profil) }))
  }, [previsions, lieu, profil])

  if (heures.length === 0) return null

  const ventMax = Math.max(18, ...heures.map((h) => h.ventNoeuds))
  const debutCreneau = creneau ? new Date(creneau.debut).getTime() : null
  const finCreneau = creneau ? new Date(creneau.fin).getTime() : null
  const coucher = new Date(coucherSoleil).getTime()

  return (
    <section className="rounded-2xl border border-line/70 bg-surface/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted">AUJOURD’HUI</h3>
        {creneau ? (
          <p className="text-[13px]">
            <span className="font-mono text-[11px] tracking-wide" style={{ color: 'var(--color-go)' }}>
              MEILLEUR CRÉNEAU
            </span>{' '}
            <span className="tabular font-mono text-foam">
              {new Date(creneau.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {new Date(new Date(creneau.fin).getTime() + 3600_000).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        ) : (
          <p className="text-[13px] text-dim">Aucun créneau exploitable d’ici ce soir</p>
        )}
      </div>

      <div className="rail -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {heures.map((h) => {
          const t = new Date(h.heure).getTime()
          const dansCreneau = debutCreneau !== null && finCreneau !== null && t >= debutCreneau && t <= finCreneau
          const selectionnee = heureSelectionnee === h.heure
          const apresCoucher = t > coucher
          const couleur = couleurScore(h.score)

          return (
            <button
              key={h.heure}
              type="button"
              onClick={() => onSelectionner(selectionnee ? null : h.heure)}
              aria-pressed={selectionnee}
              aria-label={`${new Date(h.heure).toLocaleTimeString('fr-FR', { hour: '2-digit' })} — ${Math.round(h.ventNoeuds)} nœuds, score ${h.score.toFixed(1)} sur 10`}
              className={`flex w-[2.9rem] shrink-0 flex-col items-center gap-2 rounded-xl border px-1 py-2.5 transition-colors ${
                selectionnee
                  ? 'border-foam/45 bg-raised'
                  : dansCreneau
                    ? 'border-transparent bg-go/10'
                    : 'border-transparent hover:bg-raised/60'
              } ${apresCoucher ? 'opacity-45' : ''}`}
            >
              <span className="tabular font-mono text-[10px] text-muted">
                {new Date(h.heure).toLocaleTimeString('fr-FR', { hour: '2-digit' })}
              </span>

              {/* La pastille porte la qualité, la barre porte la force */}
              <span
                className="h-2.5 w-2.5 rounded-full transition-colors"
                style={{ background: couleur }}
              />

              <span className="flex h-12 w-full items-end justify-center">
                <span
                  className="w-1.5 rounded-full transition-[height] duration-500"
                  style={{
                    height: `${Math.max(10, (h.ventNoeuds / ventMax) * 100)}%`,
                    background: couleur,
                    opacity: 0.55,
                  }}
                />
              </span>

              <span className="tabular font-mono text-[12px] text-foam">{Math.round(h.ventNoeuds)}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-[12px] text-dim">
        Touche une heure pour voir le verdict à ce moment-là.
      </p>
    </section>
  )
}
