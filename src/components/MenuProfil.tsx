import { useEffect, useRef } from 'react'
import type { Profil } from '../types/profile'

interface Props {
  profils: Profil[]
  profilActif: Profil
  onSelectionner: (id: string) => void
  onAjouter: () => void
  onModifier: () => void
  onFermer: () => void
}

/** Menu déroulant du bouton profil : changer, ajouter, modifier */
export function MenuProfil({
  profils,
  profilActif,
  onSelectionner,
  onAjouter,
  onModifier,
  onFermer,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const surClicExterieur = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer()
    }
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('mousedown', surClicExterieur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClicExterieur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [onFermer])

  const autres = profils.filter((p) => p.id !== profilActif.id)

  return (
    <div
      ref={ref}
      className="verre monte absolute top-full right-0 z-40 mt-2 w-60 overflow-hidden"
    >
      <div className="border-b border-foam/[0.08] px-4 py-3">
        <p className="text-[14px] font-medium text-foam">{profilActif.nom}</p>
        <p className="tabular font-mono text-[11px] text-dim">
          {profilActif.poids} kg · {profilActif.niveau}
        </p>
      </div>

      {autres.length > 0 && (
        <div className="border-b border-foam/[0.08] py-1">
          <p className="px-4 py-1.5 font-mono text-[10px] tracking-[0.16em] text-dim">AUTRES PROFILS</p>
          {autres.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelectionner(p.id)
                onFermer()
              }}
              className="block w-full px-4 py-2 text-left text-[13px] text-muted transition-colors hover:bg-foam/[0.05] hover:text-foam"
            >
              {p.nom}
              <span className="tabular ml-2 font-mono text-[11px] text-dim">{p.poids} kg</span>
            </button>
          ))}
        </div>
      )}

      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onModifier()
            onFermer()
          }}
          className="block w-full px-4 py-2 text-left text-[13px] text-muted transition-colors hover:bg-foam/[0.05] hover:text-foam"
        >
          Modifier « {profilActif.nom} »
        </button>
        <button
          type="button"
          onClick={() => {
            onAjouter()
            onFermer()
          }}
          className="block w-full px-4 py-2 text-left text-[13px] text-muted transition-colors hover:bg-foam/[0.05] hover:text-foam"
        >
          + Ajouter un profil
        </button>
      </div>
    </div>
  )
}
