import { useState } from 'react'
import { NIVEAUX, VALEURS_DEPART, type NiveauRider, type Profil } from '../types/profile'

interface Props {
  /** true à la toute première ouverture : on explique en une phrase */
  premier: boolean
  onCreer: (champs: Partial<Omit<Profil, 'id'>> & { nom: string }) => void
  onAnnuler?: () => void
}

/** Formulaire minimal : prénom, poids, niveau. Le matériel se règle plus tard. */
export function CreationProfil({ premier, onCreer, onAnnuler }: Props) {
  const [nom, setNom] = useState('')
  const [poids, setPoids] = useState(VALEURS_DEPART.poids)
  const [niveau, setNiveau] = useState<NiveauRider>(VALEURS_DEPART.niveau)

  const nomValide = nom.trim().length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (nomValide) onCreer({ nom: nom.trim(), poids, niveau })
      }}
      className="w-full"
    >
      {premier && (
        <p className="mb-5 text-[14px] leading-relaxed text-muted">
          KiteSpot adapte son analyse à ton poids et à ton niveau. Crée ton profil pour commencer.
        </p>
      )}

      <label className="mb-4 block">
        <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-muted">PRÉNOM</span>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ton prénom"
          autoFocus
          className="w-full rounded-lg border border-line bg-surface/60 px-3 py-2.5 text-[15px] text-foam outline-none placeholder:text-dim focus:border-foam/40"
        />
      </label>

      <div className="mb-4">
        <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-muted">POIDS</span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={35}
            max={120}
            value={poids}
            onChange={(e) => setPoids(Number(e.target.value))}
            className="flex-1 accent-[var(--verdict)]"
          />
          <span className="tabular w-14 shrink-0 text-right font-mono text-[15px] text-foam">
            {poids} kg
          </span>
        </div>
      </div>

      <div className="mb-6">
        <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-muted">NIVEAU</span>
        <div className="grid grid-cols-2 gap-1.5">
          {NIVEAUX.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNiveau(n)}
              aria-pressed={n === niveau}
              className={`rounded-lg border px-2 py-2 text-[13px] transition-colors ${
                n === niveau ? 'border-foam/40 bg-raised text-foam' : 'border-line text-muted hover:text-foam'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!nomValide}
          className="flex-1 rounded-xl px-5 py-3 text-[14px] font-medium text-abyss transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--verdict)' }}
        >
          Créer le profil
        </button>
        {onAnnuler && (
          <button
            type="button"
            onClick={onAnnuler}
            className="rounded-xl border border-line px-4 py-3 text-[14px] text-muted transition-colors hover:text-foam"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}
