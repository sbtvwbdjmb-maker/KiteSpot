import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Bouton } from '@/components/ui/bouton'
import { CarrouselDefilant } from '@/components/ui/carrousel-defilant'
import type { Spot } from '@/types/spot'

interface Action {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface Props {
  titre: string
  sousTitre: string
  actionPrincipale?: Action
  actionSecondaire?: Action
  /** Message d'état (géolocalisation refusée, etc.) — jamais un argument marketing */
  note?: string
  /** Spots réels de la base vérifiée, proposés à la découverte */
  spots?: Spot[]
  onChoisirSpot?: (spot: Spot) => void
  className?: string
}

const APPARITION = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}
const RESSORT = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }

/**
 * Écran d'accueil, quand aucun spot n'est encore sélectionné.
 *
 * Structure inspirée d'un hero classique (titre, sous-titre, deux actions,
 * carrousel), transposée à l'identité sombre de KiteSpot. Le carrousel montre
 * de vrais spots de la base plutôt que des visuels décoratifs : ici, la
 * découverte de spots méconnus est la fonctionnalité, pas un argument de vente.
 */
export function HeroAccueil({
  titre,
  sousTitre,
  actionPrincipale,
  actionSecondaire,
  note,
  spots = [],
  onChoisirSpot,
  className,
}: Props) {
  const reduit = useReducedMotion()
  const anim = reduit ? {} : APPARITION

  return (
    <section
      className={cn('flex flex-1 flex-col justify-center', className)}
      aria-label="Choisir un spot"
    >
      <motion.div
        {...anim}
        transition={RESSORT}
        className="mx-auto flex max-w-2xl flex-col items-center px-2 text-center"
      >
        <h1 className="font-display text-[clamp(1.9rem,6vw,3.2rem)] leading-[1.05] font-bold tracking-tight text-foam">
          {titre}
        </h1>

        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">{sousTitre}</p>

        {(actionPrincipale || actionSecondaire) && (
          <motion.div
            {...anim}
            transition={{ ...RESSORT, delay: 0.12 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            {actionPrincipale && (
              <Bouton
                variante="principal"
                onClick={actionPrincipale.onClick}
                disabled={actionPrincipale.disabled}
                className="px-6 py-3.5 text-[15px]"
              >
                {actionPrincipale.label}
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d="M7 10H13M13 10L10 7M13 10L10 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Bouton>
            )}
            {actionSecondaire && (
              <Bouton variante="secondaire" onClick={actionSecondaire.onClick} className="px-6 py-3.5 text-[15px]">
                {actionSecondaire.label}
              </Bouton>
            )}
          </motion.div>
        )}

        {note && (
          <motion.p
            {...anim}
            transition={{ ...RESSORT, delay: 0.2 }}
            className="mt-5 text-[13px] text-dim"
          >
            {note}
          </motion.p>
        )}
      </motion.div>

      {spots.length > 0 && (
        <motion.div {...anim} transition={{ ...RESSORT, delay: 0.28 }} className="mt-14">
          <p className="mb-3 px-2 font-mono text-[10px] tracking-[0.22em] text-dim">
            SPOTS VÉRIFIÉS · LES PLUS DISCRETS D’ABORD
          </p>

          <CarrouselDefilant>
            {spots.map((spot) => (
              <motion.button
                key={spot.id}
                type="button"
                onClick={() => onChoisirSpot?.(spot)}
                whileHover={reduit ? undefined : { y: -4 }}
                transition={{ duration: 0.25 }}
                className="group flex w-[13.5rem] shrink-0 flex-col justify-between rounded-2xl border border-line/70 bg-surface/40 p-4 text-left transition-colors hover:border-foam/30 hover:bg-surface/70"
                style={{ minHeight: '8.5rem' }}
              >
                <div>
                  <h3 className="font-display text-[15px] leading-tight font-semibold text-foam">
                    {spot.name}
                  </h3>
                  <p className="mt-1 text-[12px] text-dim">
                    {spot.locality} · {spot.country}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-wide text-muted">
                    {spot.type.join(' · ')}
                  </span>
                  {/* Discrétion du spot : 1 point = confidentiel, 5 = ultra connu */}
                  <span className="font-mono text-[10px] text-dim" title={`Popularité ${spot.popularite}/5`}>
                    {'●'.repeat(spot.popularite)}
                    <span className="opacity-30">{'●'.repeat(5 - spot.popularite)}</span>
                  </span>
                </div>
              </motion.button>
            ))}
          </CarrouselDefilant>
        </motion.div>
      )}
    </section>
  )
}
