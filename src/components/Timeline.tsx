import { useMemo, useRef } from 'react'
import type { ConditionsHoraires } from '../services/weather'
import type { Spot } from '../types/spot'
import type { Profil } from '../types/profile'
import { scoreHoraire, type Creneau } from '../lib/scoring'
import { recommanderVoile } from '../lib/voile'

interface Props {
  previsions: ConditionsHoraires[]
  spot: Spot
  profil: Profil
  creneau: Creneau | null
  heureSelectionnee: string | null
  onSelectionner: (heure: string | null) => void
  coucherSoleil: string
}

function couleurScore(score: number): string {
  if (score >= 6.8) return 'var(--color-go)'
  if (score >= 3.8) return 'var(--color-warn)'
  return 'var(--color-stop)'
}

/**
 * Timeline des prochaines heures : chaque barre porte le vent, sa couleur porte
 * le score, et la voile conseillée change avec le vent. Le meilleur créneau est
 * surligné pour répondre directement à « quand y aller ? ».
 */
export function Timeline({
  previsions,
  spot,
  profil,
  creneau,
  heureSelectionnee,
  onSelectionner,
  coucherSoleil,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null)

  const heures = useMemo(() => {
    const maintenant = Date.now() - 60 * 60 * 1000
    return previsions
      .filter((h) => new Date(h.heure).getTime() >= maintenant)
      .slice(0, 24)
      .map((h) => {
        const score = scoreHoraire(h, spot, profil)
        const voile = recommanderVoile(h.ventNoeuds, profil)
        // On n'affiche une voile que si elle est réellement exploitable :
        // proposer une taille par vent nul induirait en erreur.
        const exploitable = voile.adequation === 'ideale' || voile.adequation === 'acceptable'
        return { ...h, score, voile: exploitable ? voile.tailleRetenue : null }
      })
  }, [previsions, spot, profil])

  const ventMax = Math.max(18, ...heures.map((h) => h.rafalesNoeuds))
  const debutCreneau = creneau ? new Date(creneau.debut).getTime() : null
  const finCreneau = creneau ? new Date(creneau.fin).getTime() : null
  const coucher = new Date(coucherSoleil).getTime()

  if (heures.length === 0) return null

  return (
    <section className="rounded-2xl border border-line/70 bg-surface/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted">PROCHAINES HEURES</h3>
        {creneau ? (
          <p className="text-[13px] text-foam/80">
            <span className="font-mono text-[11px] tracking-wide" style={{ color: 'var(--color-go)' }}>
              MEILLEUR CRÉNEAU
            </span>{' '}
            <span className="tabular font-mono">
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

      <div ref={railRef} className="rail -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {heures.map((h) => {
          const t = new Date(h.heure).getTime()
          const dansCreneau = debutCreneau !== null && finCreneau !== null && t >= debutCreneau && t <= finCreneau
          const estSelection = heureSelectionnee === h.heure
          const apresCoucher = t > coucher
          const hauteur = Math.max(8, (h.ventNoeuds / ventMax) * 100)
          const hauteurRafale = Math.max(hauteur, (h.rafalesNoeuds / ventMax) * 100)

          return (
            <button
              key={h.heure}
              type="button"
              onClick={() => onSelectionner(estSelection ? null : h.heure)}
              aria-pressed={estSelection}
              className={`group relative flex w-[3.15rem] shrink-0 flex-col items-center gap-2 rounded-xl border px-1 pt-2 pb-2.5 transition-colors ${
                estSelection
                  ? 'border-foam/40 bg-raised'
                  : dansCreneau
                    ? 'border-transparent bg-go/10'
                    : 'border-transparent hover:bg-raised/60'
              }`}
              title={`${Math.round(h.ventNoeuds)} nds, rafales ${Math.round(h.rafalesNoeuds)} nds — score ${h.score.toFixed(1)}/10`}
            >
              <span className={`tabular font-mono text-[10px] ${apresCoucher ? 'text-dim/60' : 'text-muted'}`}>
                {new Date(h.heure).toLocaleTimeString('fr-FR', { hour: '2-digit' })}
              </span>

              <span className="relative flex h-24 w-full items-end justify-center">
                {/* Rafale en fantôme derrière le vent moyen */}
                <span
                  className="absolute bottom-0 w-3 rounded-full opacity-25"
                  style={{ height: `${hauteurRafale}%`, background: couleurScore(h.score) }}
                />
                <span
                  className="absolute bottom-0 w-3 rounded-full transition-[height] duration-500"
                  style={{ height: `${hauteur}%`, background: couleurScore(h.score) }}
                />
              </span>

              <span className="tabular font-mono text-[12px] text-foam">{Math.round(h.ventNoeuds)}</span>
              <span className="tabular font-mono text-[10px] text-dim">
                {h.voile ? `${h.voile}m` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-[12px] text-dim">
        Barre pleine : vent moyen · halo : rafales · couleur : score pour ton profil. Touche une heure pour
        projeter le verdict.
      </p>
    </section>
  )
}
