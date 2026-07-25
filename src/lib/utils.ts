import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Fusionne des classes Tailwind en résolvant les conflits :
 * la dernière classe d'une même famille l'emporte.
 * Convention shadcn, utilisée par les composants de `components/ui`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
