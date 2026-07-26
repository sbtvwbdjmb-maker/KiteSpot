import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { AnalyseSport } from '../lib/sport'
import type { Lieu } from '../types/lieu'
import { CadranVent } from './CadranVent'
import { analyserDirection } from '../lib/direction'
import { Pictogramme } from '@/components/ui/pictogramme'
import { TriangleAlert } from 'lucide-react'

interface Props {
  lieu: Lieu
  analyse: AnalyseSport
  ventNoeuds: number
  rafalesNoeuds: number
  /** null = maintenant, sinon on projette sur une heure de prévision */
  heureProjetee: string | null
}

// Le score monte progressivement : on lit la valeur finale, pas une apparition brutale
function useScoreAnime(cible: number | null) {
  const [valeur, setValeur] = useState(cible ?? 0)

  useEffect(() => {
    if (cible === null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValeur(cible)
      return
    }
    let frame = 0
    const depart = performance.now()
    const boucle = (t: number) => {
      const p = Math.min(1, (t - depart) / 800)
      setValeur(cible * (1 - Math.pow(1 - p, 3)))
      if (p < 1) frame = requestAnimationFrame(boucle)
    }
    frame = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(frame)
  }, [cible])

  return valeur
}

export function BlocVerdict({ lieu, analyse, ventNoeuds, rafalesNoeuds, heureProjetee }: Props) {
  const score = useScoreAnime(analyse.scoreGlobal)
  const reduit = useReducedMotion()
  const anim = reduit ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

  const heureLisible = heureProjetee
    ? new Date(heureProjetee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null

  // Le cadran montre le vent face au littoral, quel que soit le sport
  const directionVent = analyserDirection(analyse.directionVentDeg, lieu.orientation, lieu.estLagune)

  return (
    <section>
      {heureLisible && (
        <p className="mb-3 inline-flex rounded-full border border-line bg-surface/70 px-3 py-1 font-mono text-[11px] tracking-wide text-muted">
          PROJECTION À {heureLisible}
        </p>
      )}

      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <p className="font-mono text-[11px] tracking-[0.28em] text-muted">
            VERDICT {analyse.sport === 'kite' ? 'KITE' : 'SURF'}
          </p>

          {/* Sans donnée exploitable, on le dit au lieu de noter au jugé */}
          {analyse.scoreGlobal === null || !analyse.verdict ? (
            <div className="mt-3 rounded-xl border border-line bg-surface/50 p-4">
              <p className="font-display text-[1.35rem] leading-tight font-bold text-muted">
                Donnée indisponible
              </p>
              <p className="mt-1.5 max-w-prose text-[13px] leading-snug text-dim">
                {analyse.indisponible}
              </p>
            </div>
          ) : (
            <>
              <motion.h2
                {...anim}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="mt-2 font-display text-[clamp(2.4rem,7vw,3.9rem)] leading-[0.95] font-bold tracking-tight"
                style={{ color: 'var(--verdict)' }}
              >
                {analyse.verdict.titre}
              </motion.h2>
              <p className="mt-1 text-[14px] text-muted">{analyse.verdict.sousTitre}</p>

              <div className="mt-5 flex items-baseline gap-3">
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
            </>
          )}

          {analyse.lectures.length > 0 && (
            <motion.dl
              {...anim}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4"
            >
              {analyse.lectures.map((lecture) => {
                // Un jugement se lit en toutes lettres : on le compose en
                // linéale, alors qu'une mesure garde la chasse fixe.
                const estJugement = !/[\d~]/.test(lecture.valeur)
                return (
                  <div key={lecture.icone + lecture.unite} className="min-w-0">
                    <Pictogramme nom={lecture.icone} className="text-dim" />
                    <dd className="mt-1.5 min-w-0">
                      <span
                        className={
                          estJugement
                            ? 'font-display text-xl leading-tight font-semibold text-foam'
                            : 'tabular font-mono text-2xl text-foam'
                        }
                      >
                        {lecture.valeur}
                      </span>
                      {!estJugement && (
                        <span className="ml-1 font-mono text-[11px] text-muted">{lecture.unite}</span>
                      )}
                    </dd>
                    {/* Sous le jugement, la mesure qui l'a produit reste lisible */}
                    <dt className="mt-0.5 truncate font-mono text-[10px] text-dim">
                      {estJugement ? (lecture.detail ?? lecture.unite) : lecture.detail}
                    </dt>
                  </div>
                )
              })}
            </motion.dl>
          )}
        </div>

        <div>
          <CadranVent
            directionDeg={analyse.directionVentDeg}
            orientationLittoral={lieu.orientation}
            ventNoeuds={ventNoeuds}
            rafalesNoeuds={rafalesNoeuds}
            analyse={directionVent}
            directionHouleDeg={analyse.directionHouleDeg}
          />
        </div>
      </div>

      {analyse.alertes.length > 0 && (
        <ul className="mt-8 space-y-2.5 border-l border-line/70 pl-4">
          {analyse.alertes.map((alerte) => (
            <li key={alerte} className="flex gap-2.5 text-[13px] leading-snug text-muted">
              <TriangleAlert
                aria-hidden
                strokeWidth={1.5}
                className="mt-px h-[15px] w-[15px] shrink-0 text-warn"
              />
              {alerte}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
