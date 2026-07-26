import { useEffect, useMemo, useState } from 'react'
import { Modale } from './Modale'
import { useDebounce } from '../hooks/useDebounce'
import { lireCoordonnees, rechercherLieu, type ResultatLieu } from '../services/geocoding'
import { SPOTS, idResultat } from '../hooks/useLieux'
import { formaterDistance } from '../lib/geo'
import type { Lieu } from '../types/lieu'

interface Props {
  distances: Record<string, number>
  positionConnue: boolean
  favoris: Lieu[]
  onChoisirResultat: (resultat: ResultatLieu) => void
  /** Choix d'un favori déjà résolu : inutile de le re-géocoder */
  onChoisirLieu: (lieu: Lieu) => void
  onRetirerFavori: (id: string) => void
  estFavori: (id: string) => boolean
  /** Like/unlike depuis les résultats de recherche, sans les sélectionner */
  onBasculerFavori: (resultat: ResultatLieu) => void
  onFermer: () => void
}

/** Cœur à liker, réutilisé sur chaque résultat de recherche */
function BoutonCoeur({ actif, nom, onClick }: { actif: boolean; nom: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      aria-label={actif ? `Retirer ${nom} de mes spots favoris` : `Ajouter ${nom} à mes spots favoris`}
      title={actif ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={`shrink-0 rounded-full px-2.5 py-2 text-[16px] leading-none transition-colors ${
        actif ? 'text-stop hover:bg-stop/10' : 'text-dim hover:bg-raised hover:text-foam'
      }`}
    >
      {actif ? '♥' : '♡'}
    </button>
  )
}

/** Minuscules sans accents, pour que « hyeres » retrouve « Hyères » */
function normaliser(texte: string): string {
  return texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function SelecteurLieu({
  distances,
  positionConnue,
  favoris,
  onChoisirResultat,
  onChoisirLieu,
  onRetirerFavori,
  estFavori,
  onBasculerFavori,
  onFermer,
}: Props) {
  const [requete, setRequete] = useState('')
  const [resultats, setResultats] = useState<ResultatLieu[]>([])
  const [recherche, setRecherche] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const requeteDebounced = useDebounce(requete, 320)

  // Les spots vérifiés qui correspondent : ils passent devant les résultats OSM
  const spotsCorrespondants = useMemo(() => {
    const q = normaliser(requeteDebounced.trim())
    const base = q
      ? SPOTS.filter((s) =>
          [s.name, s.locality, s.region, s.country].some((c) => normaliser(c).includes(q)),
        )
      : [...SPOTS].sort((a, b) =>
          positionConnue
            ? (distances[a.id] ?? Infinity) - (distances[b.id] ?? Infinity)
            : a.popularite - b.popularite || a.name.localeCompare(b.name),
        )
    return base.slice(0, q ? 5 : 8)
  }, [requeteDebounced, distances, positionConnue])

  useEffect(() => {
    const q = requeteDebounced.trim()
    if (q.length < 2) {
      setResultats([])
      setErreur(null)
      return
    }

    // Des coordonnées saisies directement court-circuitent le géocodeur
    const coords = lireCoordonnees(q)
    if (coords) {
      setResultats([
        {
          cle: 'coords',
          nom: `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`,
          localite: 'Coordonnées GPS',
          pays: '',
          lat: coords.lat,
          lon: coords.lon,
          categorie: 'coords',
        },
      ])
      return
    }

    const controleur = new AbortController()
    setRecherche(true)
    setErreur(null)
    rechercherLieu(q, controleur.signal)
      .then(setResultats)
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setErreur('Recherche indisponible, réessaie dans un instant.')
      })
      .finally(() => setRecherche(false))

    return () => controleur.abort()
  }, [requeteDebounced])

  return (
    <Modale titre="Choisir un spot" onFermer={onFermer}>
      <input
        type="search"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Plage, ville, adresse ou coordonnées GPS…"
        autoFocus
        className="w-full rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-[14px] text-foam outline-none placeholder:text-dim focus:border-foam/40"
      />

      {!requeteDebounced.trim() && favoris.length > 0 && (
        <>
          <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.18em] text-dim">MES SPOTS FAVORIS</p>
          <ul className="space-y-0.5">
            {favoris.map((favori) => (
              <li key={favori.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onChoisirLieu(favori)
                    onFermer()
                  }}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <span className="block truncate text-[14px] text-foam">{favori.nom}</span>
                  <span className="block truncate text-[12px] text-dim">
                    {[favori.localite, favori.pays].filter(Boolean).join(' · ')}
                    {distances[favori.id] !== undefined && ` · ${formaterDistance(distances[favori.id])}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRetirerFavori(favori.id)}
                  aria-label={`Retirer ${favori.nom} de mes spots favoris`}
                  title="Retirer des favoris"
                  className="shrink-0 rounded-full px-2.5 py-2 text-[15px] leading-none text-dim transition-colors hover:bg-raised hover:text-stop"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {spotsCorrespondants.length > 0 && (
        <>
          <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.18em] text-dim">
            {requeteDebounced.trim() ? 'SPOTS VÉRIFIÉS' : positionConnue ? 'LES PLUS PROCHES' : 'SPOTS DISCRETS D’ABORD'}
          </p>
          <ul className="space-y-0.5">
            {spotsCorrespondants.map((spot) => {
              const resultat: ResultatLieu = {
                cle: spot.id,
                nom: spot.name,
                localite: spot.locality,
                pays: spot.country,
                lat: spot.lat,
                lon: spot.lon,
                categorie: 'spot',
              }
              return (
                <li key={spot.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onChoisirResultat(resultat)
                      onFermer()
                    }}
                    className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-raised"
                  >
                    <span className="block text-[14px] text-foam">{spot.name}</span>
                    <span className="block text-[12px] text-dim">
                      {spot.locality} · {spot.country}
                      {distances[spot.id] !== undefined && ` · ${formaterDistance(distances[spot.id])}`}
                      <span className="ml-1.5 text-go/70">orientation vérifiée</span>
                    </span>
                  </button>
                  <BoutonCoeur
                    actif={estFavori(idResultat(resultat))}
                    nom={spot.name}
                    onClick={() => onBasculerFavori(resultat)}
                  />
                </li>
              )
            })}
          </ul>
        </>
      )}

      {requeteDebounced.trim().length >= 2 && (
        <>
          <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.18em] text-dim">
            TOUS LES LIEUX {recherche && <span className="pulse-douce">· recherche…</span>}
          </p>
          {erreur && <p className="px-3 py-2 text-[13px] text-stop">{erreur}</p>}
          <ul className="space-y-0.5">
            {resultats.map((lieu) => (
              <li key={lieu.cle} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onChoisirResultat(lieu)
                    onFermer()
                  }}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <span className="block text-[14px] text-foam">{lieu.nom}</span>
                  <span className="block text-[12px] text-dim">
                    {[lieu.localite, lieu.pays].filter(Boolean).join(' · ')}
                    {lieu.categorie && <span className="ml-1.5 opacity-70">{lieu.categorie}</span>}
                  </span>
                </button>
                {lieu.categorie !== 'coords' && (
                  <BoutonCoeur
                    actif={estFavori(idResultat(lieu))}
                    nom={lieu.nom}
                    onClick={() => onBasculerFavori(lieu)}
                  />
                )}
              </li>
            ))}
            {!recherche && !erreur && resultats.length === 0 && (
              <li className="px-3 py-4 text-[13px] text-dim">Aucun lieu trouvé pour cette recherche.</li>
            )}
          </ul>
          <p className="mt-3 px-1 text-[11px] leading-snug text-dim">
            Recherche fournie par Photon / OpenStreetMap. Pour un lieu hors base vérifiée, KiteSpot
            déduit l’orientation du littoral depuis le relief — et te le dit.
          </p>
        </>
      )}
    </Modale>
  )
}
