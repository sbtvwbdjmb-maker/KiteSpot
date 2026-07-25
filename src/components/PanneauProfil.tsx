import { useState } from 'react'
import { Modale } from './Modale'
import {
  TAILLES_VOILES,
  type Pratique,
  type PreferencePuissance,
  type NiveauRider,
  type Profil,
} from '../types/profile'

interface Props {
  profils: Profil[]
  profilActif: Profil
  onSelectionner: (id: string) => void
  onModifier: (id: string, champs: Partial<Omit<Profil, 'id'>>) => void
  onAjouter: (nom: string) => void
  onSupprimer: (id: string) => void
  onFermer: () => void
}

const NIVEAUX: NiveauRider[] = ['débutant', 'intermédiaire', 'confirmé']
const PRATIQUES: Pratique[] = ['freeride', 'freestyle', 'wave']
const PREFERENCES: PreferencePuissance[] = ['tranquille', 'normal', 'puissant']

export function PanneauProfil({
  profils,
  profilActif,
  onSelectionner,
  onModifier,
  onAjouter,
  onSupprimer,
  onFermer,
}: Props) {
  const [nouveauNom, setNouveauNom] = useState('')
  const p = profilActif

  function basculerVoile(taille: number) {
    const present = p.quiver.includes(taille)
    const quiver = present ? p.quiver.filter((t) => t !== taille) : [...p.quiver, taille].sort((a, b) => a - b)
    onModifier(p.id, { quiver })
  }

  return (
    <Modale titre="Profil du rider" onFermer={onFermer}>
      {/* Sélection du profil actif */}
      <div className="mb-5 flex flex-wrap gap-2">
        {profils.map((profil) => (
          <button
            key={profil.id}
            type="button"
            onClick={() => onSelectionner(profil.id)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
              profil.id === p.id
                ? 'border-foam/40 bg-raised text-foam'
                : 'border-line text-muted hover:text-foam'
            }`}
          >
            {profil.nom}
          </button>
        ))}
      </div>

      <Champ label="Nom">
        <input
          type="text"
          value={p.nom}
          onChange={(e) => onModifier(p.id, { nom: e.target.value })}
          className="w-full rounded-lg border border-line bg-surface/60 px-3 py-2 text-[14px] text-foam outline-none focus:border-foam/40"
        />
      </Champ>

      <Champ label="Poids" indice="Influence directement la taille de voile conseillée">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={35}
            max={120}
            step={1}
            value={p.poids}
            onChange={(e) => onModifier(p.id, { poids: Number(e.target.value) })}
            className="flex-1 accent-[var(--verdict)]"
          />
          <span className="tabular w-14 shrink-0 text-right font-mono text-[14px] text-foam">
            {p.poids} kg
          </span>
        </div>
      </Champ>

      <Champ label="Niveau" indice="Définit ta plage de vent exploitable">
        <Segments
          options={NIVEAUX}
          valeur={p.niveau}
          onChange={(niveau) => onModifier(p.id, { niveau })}
        />
      </Champ>

      <Champ label="Pratique">
        <Segments
          options={PRATIQUES}
          valeur={p.pratique}
          onChange={(pratique) => onModifier(p.id, { pratique })}
        />
      </Champ>

      <Champ label="Préférence" indice="Sous-toilé ou bien chargé, selon ton goût">
        <Segments
          options={PREFERENCES}
          valeur={p.preference}
          onChange={(preference) => onModifier(p.id, { preference })}
        />
      </Champ>

      <Champ label="Mon matériel" indice="Les voiles que tu possèdes réellement">
        <div className="flex flex-wrap gap-1.5">
          {TAILLES_VOILES.map((taille) => {
            const possede = p.quiver.includes(taille)
            return (
              <button
                key={taille}
                type="button"
                onClick={() => basculerVoile(taille)}
                aria-pressed={possede}
                className={`tabular rounded-lg border px-2.5 py-1.5 font-mono text-[13px] transition-colors ${
                  possede
                    ? 'border-foam/40 bg-raised text-foam'
                    : 'border-line text-dim hover:text-muted'
                }`}
              >
                {taille}
              </button>
            )
          })}
        </div>
        {p.quiver.length === 0 && (
          <p className="mt-2 text-[12px]" style={{ color: 'var(--color-warn)' }}>
            Sans matériel renseigné, KiteSpot ne peut pas conseiller de voile.
          </p>
        )}
      </Champ>

      {/* Gestion des profils */}
      <div className="mt-6 border-t border-line/70 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nouveauNom.trim()) {
                onAjouter(nouveauNom.trim())
                setNouveauNom('')
              }
            }}
            placeholder="Nouveau profil (ex : Papa)"
            className="flex-1 rounded-lg border border-line bg-surface/60 px-3 py-2 text-[13px] text-foam outline-none placeholder:text-dim focus:border-foam/40"
          />
          <button
            type="button"
            disabled={!nouveauNom.trim()}
            onClick={() => {
              onAjouter(nouveauNom.trim())
              setNouveauNom('')
            }}
            className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-foam transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
          >
            Créer
          </button>
        </div>

        {profils.length > 1 && (
          <button
            type="button"
            onClick={() => onSupprimer(p.id)}
            className="mt-3 text-[12px] text-dim transition-colors hover:text-stop"
          >
            Supprimer le profil « {p.nom} »
          </button>
        )}
      </div>
    </Modale>
  )
}

function Champ({
  label,
  indice,
  children,
}: {
  label: string
  indice?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted">{label.toUpperCase()}</p>
      {children}
      {indice && <p className="mt-1.5 text-[12px] text-dim">{indice}</p>}
    </div>
  )
}

function Segments<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: T[]
  valeur: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={option === valeur}
          className={`flex-1 rounded-lg border px-2 py-2 text-[13px] transition-colors ${
            option === valeur
              ? 'border-foam/40 bg-raised text-foam'
              : 'border-line text-muted hover:text-foam'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
