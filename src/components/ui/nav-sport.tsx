import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SPORTS, type Sport } from '@/lib/sport'

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
        'inline-flex rounded-full border border-line bg-surface/50 p-1',
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
                className="absolute inset-0 rounded-full bg-raised"
              />
            )}
            <span className={cn('relative z-10', estActif ? 'text-foam' : 'text-muted')}>
              <span aria-hidden className="mr-1.5">
                {sport.icone}
              </span>
              {sport.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
