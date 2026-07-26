import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  titre: string
  onFermer: () => void
  children: ReactNode
}

/** Panneau modal simple : fermeture au clic extérieur, à Échap, focus piégé à l'ouverture */
export function Modale({ titre, onFermer, children }: Props) {
  const panneauRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', surTouche)
    panneauRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.body.style.overflow = overflow
    }
  }, [onFermer])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-abyss/55 p-0 backdrop-blur-md sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFermer()
      }}
    >
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        tabIndex={-1}
        className="verre monte flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-b-none sm:rounded-b-[var(--rayon-l)]"
      >
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="font-mono text-[11px] tracking-[0.22em] text-muted">{titre.toUpperCase()}</h2>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-md px-2 py-1 text-lg leading-none text-dim transition-colors hover:text-foam"
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
