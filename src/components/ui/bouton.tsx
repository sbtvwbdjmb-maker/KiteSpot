import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variante = 'principal' | 'secondaire' | 'discret'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  children: ReactNode
}

/**
 * Bouton pilule. La variante principale prend la couleur du verdict courant :
 * l'action principale porte donc la même information que le reste de l'écran.
 */
const STYLES: Record<Variante, string> = {
  principal: 'text-abyss font-medium hover:brightness-110 active:brightness-95',
  secondaire: 'border border-line text-foam hover:bg-surface',
  discret: 'border border-line bg-surface/50 text-muted hover:text-foam',
}

export function Bouton({ variante = 'secondaire', className, children, ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full transition-all',
        'disabled:cursor-not-allowed disabled:opacity-40',
        STYLES[variante],
        className,
      )}
      style={variante === 'principal' ? { background: 'var(--verdict)' } : undefined}
      {...props}
    >
      {children}
    </button>
  )
}
