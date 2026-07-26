import { Compass, Thermometer, Timer, Triangle, Waves, Wind } from 'lucide-react'
import type { CleIcone } from '@/lib/sport'
import { cn } from '@/lib/utils'

const ICONES = {
  vent: Wind,
  direction: Compass,
  voile: Triangle,
  temperature: Thermometer,
  vague: Waves,
  periode: Timer,
} as const

interface Props {
  nom: CleIcone
  className?: string
}

/**
 * Pictogramme d'une lecture. Trait fin et uniforme plutôt qu'un emoji : un
 * emoji impose son propre style de couleur, change d'aspect selon le système
 * et fait « maquette ». Un trait dessiné se fond dans la typographie.
 */
export function Pictogramme({ nom, className }: Props) {
  const Icone = ICONES[nom]
  return <Icone aria-hidden strokeWidth={1.5} className={cn('h-[18px] w-[18px]', className)} />
}
