import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SPORTS, type Sport } from '@/lib/sport'

const EMOJI_SPORT = { kite: '\ud83e\ude81', surf: '\ud83c\udfc4' } as const

interface Props {
  actif: Sport
  onChanger: (sport: Sport) => void
  className?: string
}

/** Bascule Kite / Surf. Le curseur glisse d'un onglet à l'autre. */
export function NavSport({ actif, onChanger, className }: Props) {
  const reduit = useReducedMotion()

  return (
    <div
      role="tablist"
      aria-label="Sport"
      className={cn(
        'inline-flex rounded-full bg-foam/[0.05] p-1 shadow-[inset_0_1px_2px_rgb(22_40_54/0.08)]',
        className,
      )}
    >
      {SPORTS.map((sport) => {
        const estActif = sport.id === actif
        return (
          <button
            key={sport.id}
            type="button"
            role="tab"
            aria-selected={estActif}
            onClick={() => onChanger(sport.id)}
            className="relative rounded-full px-4 py-1.5 text-[13px] transition-colors"
          >
            {estActif && (
              <motion.span
                layoutId="curseur-sport"
                transition={reduit ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgb(22_40_54/0.18)]"
              />
            )}
            <span
              className={cn(
                'relative z-10 inline-flex items-center gap-1.5',
                estActif ? 'text-foam' : 'text-muted',
              )}
            >
              <span aria-hidden>{EMOJI_SPORT[sport.id]}</span>
              {sport.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
