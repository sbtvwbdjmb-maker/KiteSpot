import type { CleIcone } from '@/lib/sport'
import { cn } from '@/lib/utils'

const EMOJI: Record<CleIcone, string> = {
  vent: '💨',
  direction: '🧭',
  voile: '🪁',
  temperature: '🌡️',
  vague: '🌊',
  periode: '⏱️',
}

interface Props {
  nom: CleIcone
  className?: string
}

/** Pictogramme d'une lecture. */
export function Pictogramme({ nom, className }: Props) {
  return (
    <span aria-hidden className={cn('text-[20px] leading-none', className)}>
      {EMOJI[nom]}
    </span>
  )
}
