import { useMemo, useState } from 'react'
import { Modale } from './Modale'
import type { Spot } from '../types/spot'
import { formaterDistance } from '../lib/geo'

interface Props {
  spots: Spot[]
  spotActifId: string
  favoris: string[]
  distances: Record<string, number>
  positionConnue: boolean
  onSelectionner: (spot: Spot) => void
  onBasculerFavori: (spotId: string) => void
  onUtiliserMaPosition: () => void
  onFermer: () => void
}

/** Minuscules sans accents, pour que « hyeres » retrouve « Hyères » */
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function SelecteurSpot({
  spots,
  spotActifId,
  favoris,
  distances,
  positionConnue,
  onSelectionner,
  onBasculerFavori,
  onUtiliserMaPosition,
  onFermer,
}: Props) {
  const [requete, setRequete] = useState('')

  const resultats = useMemo(() => {
    const q = normaliser(requete.trim())
    const filtres = q
      ? spots.filter((s) =>
          [s.name, s.locality, s.region, s.country].some((champ) => normaliser(champ).includes(q)),
        )
      : spots

    // Sans recherche, on classe par distance quand on connaît la position,
    // sinon on remonte les spots les plus discrets pour aider à les découvrir.
    return [...filtres].sort((a, b) => {
      if (positionConnue && !q) {
        return (distances[a.id] ?? Infinity) - (distances[b.id] ?? Infinity)
      }
      return a.popularite - b.popularite || a.name.localeCompare(b.name)
    })
  }, [requete, spots, distances, positionConnue])

  return (
    <Modale titre="Choisir un spot" onFermer={onFermer}>
      <button
        type="button"
        onClick={() => {
          onUtiliserMaPosition()
          onFermer()
        }}
        className="mb-4 w-full rounded-xl border border-line bg-surface/60 px-4 py-3 text-left text-[14px] text-foam transition-colors hover:bg-raised"
      >
        <span className="font-medium">Utiliser ma position</span>
        <span className="mt-0.5 block text-[12px] text-dim">
          Détecte le spot navigable le plus proche de toi
        </span>
      </button>

      <input
        type="search"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Chercher un spot, une ville, un pays…"
        className="w-full rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-[14px] text-foam outline-none placeholder:text-dim focus:border-foam/40"
      />

      <p className="mt-3 mb-2 font-mono text-[10px] tracking-[0.18em] text-dim">
        {requete
          ? `${resultats.length} RÉSULTAT${resultats.length > 1 ? 'S' : ''}`
          : positionConnue
            ? 'LES PLUS PROCHES'
            : 'SPOTS LES PLUS DISCRETS D’ABORD'}
      </p>

      <ul className="space-y-1">
        {resultats.map((spot) => {
          const estFavori = favoris.includes(spot.id)
          const distance = distances[spot.id]
          return (
            <li key={spot.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onSelectionner(spot)
                  onFermer()
                }}
                className={`flex-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-raised ${
                  spot.id === spotActifId ? 'bg-raised' : ''
                }`}
              >
                <span className="block text-[14px] text-foam">{spot.name}</span>
                <span className="block text-[12px] text-dim">
                  {spot.locality} · {spot.country}
                  {distance !== undefined && ` · ${formaterDistance(distance)}`}
                  {' · '}
                  {'●'.repeat(spot.popularite)}
                  <span className="text-dim/40">{'●'.repeat(5 - spot.popularite)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onBasculerFavori(spot.id)}
                aria-label={estFavori ? `Retirer ${spot.name} des favoris` : `Ajouter ${spot.name} aux favoris`}
                aria-pressed={estFavori}
                className="shrink-0 px-2 py-2 text-[15px] leading-none"
              >
                <span style={{ color: estFavori ? 'var(--color-warn)' : 'var(--color-dim)' }}>
                  {estFavori ? '★' : '☆'}
                </span>
              </button>
            </li>
          )
        })}
        {resultats.length === 0 && (
          <li className="px-3 py-6 text-center text-[13px] text-dim">
            Aucun spot ne correspond. La base couvre la France, le Portugal et l’Espagne.
          </li>
        )}
      </ul>
    </Modale>
  )
}
