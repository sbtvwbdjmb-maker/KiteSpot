import type { Spot } from '../types/spot'
import type { ApercuSpot } from '../hooks/useApercuSpots'
import { formaterDistance } from '../lib/geo'

interface Props {
  spots: Spot[]
  spotActifId: string
  apercus: Record<string, ApercuSpot>
  distances: Record<string, number>
  favoris: string[]
  onSelectionner: (spot: Spot) => void
  onBasculerFavori: (spotId: string) => void
  titre: string
}

function couleurScore(score: number): string {
  if (score >= 6.8) return 'var(--color-go)'
  if (score >= 3.8) return 'var(--color-warn)'
  return 'var(--color-stop)'
}

/** Rail horizontal de spots avec leurs conditions du moment */
export function RailSpots({
  spots,
  spotActifId,
  apercus,
  distances,
  favoris,
  onSelectionner,
  onBasculerFavori,
  titre,
}: Props) {
  if (spots.length === 0) return null

  return (
    <section>
      <h3 className="mb-3 font-mono text-[11px] tracking-[0.22em] text-muted">{titre}</h3>

      <div className="rail -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {spots.map((spot) => {
          const apercu = apercus[spot.id]
          const actif = spot.id === spotActifId
          const estFavori = favoris.includes(spot.id)
          const distance = distances[spot.id]

          return (
            <article
              key={spot.id}
              className={`relative flex w-[15.5rem] shrink-0 flex-col rounded-2xl border p-4 transition-colors ${
                actif ? 'border-foam/35 bg-raised' : 'border-line/70 bg-surface/40 hover:bg-surface/70'
              }`}
            >
              <button
                type="button"
                onClick={() => onBasculerFavori(spot.id)}
                aria-label={estFavori ? `Retirer ${spot.name} des favoris` : `Ajouter ${spot.name} aux favoris`}
                aria-pressed={estFavori}
                className="absolute top-3 right-3 text-[15px] leading-none transition-opacity hover:opacity-80"
              >
                <span style={{ color: estFavori ? 'var(--color-warn)' : 'var(--color-dim)' }}>
                  {estFavori ? '★' : '☆'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectionner(spot)}
                className="flex flex-1 flex-col items-start text-left"
              >
                <h4 className="pr-6 font-display text-[15px] leading-tight font-semibold text-foam">
                  {spot.name}
                </h4>
                <p className="mt-0.5 text-[12px] text-dim">
                  {spot.locality} · {spot.country}
                  {distance !== undefined && ` · ${formaterDistance(distance)}`}
                </p>

                <div className="mt-3 flex items-center gap-2.5">
                  {apercu ? (
                    <>
                      <span
                        className="tabular rounded-md px-2 py-1 font-mono text-[13px] font-medium"
                        style={{
                          color: couleurScore(apercu.score),
                          background: `color-mix(in oklab, ${couleurScore(apercu.score)} 14%, transparent)`,
                        }}
                      >
                        {apercu.score.toFixed(1)}
                      </span>
                      <span className="tabular font-mono text-[13px] text-foam/80">
                        {Math.round(apercu.ventNoeuds)} nds
                      </span>
                      <span className="font-mono text-[11px] text-dim">
                        {apercu.voile ? `${apercu.voile} m²` : '—'}
                      </span>
                    </>
                  ) : (
                    <span className="pulse-douce font-mono text-[12px] text-dim">chargement…</span>
                  )}
                </div>

                <p className="mt-2 font-mono text-[11px] text-dim">
                  {apercu ? apercu.directionLabel : spot.type.join(' · ')}
                </p>
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
