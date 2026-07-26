import { useState } from 'react'
import type { Critere } from '../lib/scoring'

interface Props {
  criteres: Critere[]
}

function couleur(score: number): string {
  if (score >= 0.7) return 'var(--color-go)'
  if (score >= 0.4) return 'var(--color-warn)'
  return 'var(--color-stop)'
}

/** Le détail du raisonnement : chaque critère, sa note et pourquoi */
export function Criteres({ criteres }: Props) {
  const [ouvert, setOuvert] = useState<string | null>(null)

  return (
    <section className="verre p-4 sm:p-5">
      <h3 className="mb-4 font-mono text-[11px] tracking-[0.22em] text-muted">DÉTAIL DU CALCUL</h3>

      <ul className="space-y-1">
        {criteres.map((c) => {
          const estOuvert = ouvert === c.cle
          return (
            <li key={c.cle}>
              <button
                type="button"
                onClick={() => setOuvert(estOuvert ? null : c.cle)}
                aria-expanded={estOuvert}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-foam/[0.05]"
              >
                <span className="w-[6.5rem] shrink-0 text-[13px] text-foam/90">{c.label}</span>

                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-deep">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${c.score * 100}%`, background: couleur(c.score) }}
                  />
                </span>

                <span className="tabular w-11 shrink-0 text-right font-mono text-[12px] text-muted">
                  {(c.score * 10).toFixed(1)}
                </span>
                <span className="tabular hidden w-24 shrink-0 text-right font-mono text-[12px] text-dim sm:block">
                  {c.valeur}
                </span>
                <span
                  aria-hidden
                  className={`shrink-0 text-dim transition-transform ${estOuvert ? 'rotate-90' : ''}`}
                >
                  ›
                </span>
              </button>

              {estOuvert && (
                <p className="monte px-2 pb-3 text-[13px] leading-relaxed text-muted">
                  <span className="tabular font-mono text-dim sm:hidden">{c.valeur} — </span>
                  {c.commentaire}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
