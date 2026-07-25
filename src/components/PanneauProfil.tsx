import { Modale } from './Modale'
import {
  NIVEAUX,
  PRATIQUES,
  PREFERENCES,
  TAILLES_VOILES,
  type Profil,
} from '../types/profile'

interface Props {
  profil: Profil
  peutSupprimer: boolean
  onModifier: (id: string, champs: Partial<Omit<Profil, 'id'>>) => void
  onSupprimer: (id: string) => void
  onFermer: () => void
}

export function PanneauProfil({ profil, peutSupprimer, onModifier, onSupprimer, onFermer }: Props) {
  function basculerVoile(taille: number) {
    const quiver = profil.quiver.includes(taille)
      ? profil.quiver.filter((t) => t !== taille)
      : [...profil.quiver, taille].sort((a, b) => a - b)
    onModifier(profil.id, { quiver })
  }

  return (
    <Modale titre={`Profil · ${profil.nom}`} onFermer={onFermer}>
      <Champ label="Prénom">
        <input
          type="text"
          value={profil.nom}
          onChange={(e) => onModifier(profil.id, { nom: e.target.value })}
          className="w-full rounded-lg border border-line bg-surface/60 px-3 py-2 text-[14px] text-foam outline-none focus:border-foam/40"
        />
      </Champ>

      <Champ label="Poids" indice="Influence directement la taille de voile conseillée">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={35}
            max={120}
            value={profil.poids}
            onChange={(e) => onModifier(profil.id, { poids: Number(e.target.value) })}
            className="flex-1 accent-[var(--verdict)]"
          />
          <span className="tabular w-14 shrink-0 text-right font-mono text-[14px] text-foam">
            {profil.poids} kg
          </span>
        </div>
      </Champ>

      <Champ label="Niveau" indice="Définit ta plage de vent exploitable">
        <Segments
          options={NIVEAUX}
          valeur={profil.niveau}
          colonnes={2}
          onChange={(niveau) => onModifier(profil.id, { niveau })}
        />
      </Champ>

      <Champ label="Pratique">
        <Segments
          options={PRATIQUES}
          valeur={profil.pratique}
          onChange={(pratique) => onModifier(profil.id, { pratique })}
        />
      </Champ>

      <Champ label="Préférence" indice="Sous-toilé ou bien chargé, selon ton goût">
        <Segments
          options={PREFERENCES}
          valeur={profil.preference}
          onChange={(preference) => onModifier(profil.id, { preference })}
        />
      </Champ>

      <Champ
        label="Mon matériel"
        indice={
          profil.quiver.length === 0
            ? 'Optionnel. Sans matériel renseigné, KiteSpot donne une taille théorique sans prétendre connaître tes voiles.'
            : 'Les voiles que tu possèdes réellement'
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {TAILLES_VOILES.map((taille) => {
            const possede = profil.quiver.includes(taille)
            return (
              <button
                key={taille}
                type="button"
                onClick={() => basculerVoile(taille)}
                aria-pressed={possede}
                className={`tabular rounded-lg border px-2.5 py-1.5 font-mono text-[13px] transition-colors ${
                  possede ? 'border-foam/40 bg-raised text-foam' : 'border-line text-dim hover:text-muted'
                }`}
              >
                {taille}
              </button>
            )
          })}
        </div>
      </Champ>

      {peutSupprimer && (
        <button
          type="button"
          onClick={() => {
            onSupprimer(profil.id)
            onFermer()
          }}
          className="mt-2 text-[12px] text-dim transition-colors hover:text-stop"
        >
          Supprimer ce profil
        </button>
      )}
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
      {indice && <p className="mt-1.5 text-[12px] leading-snug text-dim">{indice}</p>}
    </div>
  )
}

function Segments<T extends string>({
  options,
  valeur,
  colonnes,
  onChange,
}: {
  options: T[]
  valeur: T
  colonnes?: number
  onChange: (v: T) => void
}) {
  return (
    <div className={colonnes === 2 ? 'grid grid-cols-2 gap-1.5' : 'flex gap-1.5'}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={option === valeur}
          className={`rounded-lg border px-2 py-2 text-[13px] transition-colors ${colonnes === 2 ? '' : 'flex-1'} ${
            option === valeur ? 'border-foam/40 bg-raised text-foam' : 'border-line text-muted hover:text-foam'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
