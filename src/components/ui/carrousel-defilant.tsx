import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  className?: string
  /** Largeur des dégradés qui masquent les bords, en pixels */
  largeurFondu?: number
}

/**
 * Rail horizontal à défilement, avec dégradés latéraux qui font disparaître
 * le contenu sur les bords au lieu de le couper net.
 *
 * Repris du carrousel PulseFit, mais avec deux différences : le défilement
 * reste piloté par l'utilisateur (une animation infinie rendrait les données
 * illisibles) et les dégradés utilisent le fond sombre de KiteSpot.
 */
export function CarrouselDefilant({ children, className, largeurFondu = 48 }: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const reduit = useReducedMotion()

  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10"
        style={{
          width: largeurFondu,
          background: 'linear-gradient(90deg, var(--color-abyss) 0%, transparent 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10"
        style={{
          width: largeurFondu,
          background: 'linear-gradient(270deg, var(--color-abyss) 0%, transparent 100%)',
        }}
      />

      <motion.div
        ref={railRef}
        initial={reduit ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="rail flex gap-1 overflow-x-auto px-2 pb-1"
      >
        {children}
      </motion.div>
    </div>
  )
}
