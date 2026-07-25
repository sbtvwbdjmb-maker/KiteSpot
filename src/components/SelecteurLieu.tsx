import { useEffect, useMemo, useState } from 'react'
import { Modale } from './Modale'
import { useDebounce } from '../hooks/useDebounce'
import { lireCoordonnees, rechercherLieu, type ResultatLieu } from '../services/geocoding'
import { SPOTS } from '../hooks/useLieux'
import { formaterDistance } from '../lib/geo'
import type { EtatPermission } from '../hooks/useGeolocation'

interface Props {
  distances: Record<string, number>
  positionConnue: boolean
  permissionGeoloc: EtatPermission
  onChoisirResultat: (resultat: ResultatLieu) => void
  onUtiliserMaPosition: () => void
  onFermer: () => void
}

/** Minuscules sans accents, pour que « hyeres » retrouve « Hyères » */
function normaliser(texte: string): string {
  return texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function SelecteurLieu({
  distances,
  positionConnue,
  permissionGeoloc,
  onChoisirResultat,
  onUtiliserMaPosition,
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
      {permissionGeoloc === 'refusee' ? (
        // Un navigateur ne redemande jamais une permission refusée : le bouton
        // resterait sans effet. On explique où la rétablir au lieu de l'afficher.
        <div className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3">
          <p className="text-[14px] font-medium text-foam">Localisation bloquée pour ce site</p>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            Clique sur l’icône à gauche de l’adresse dans ton navigateur, autorise la position,
            puis recharge la page. En attendant, cherche ton spot ci-dessous.
          </p>
        </div>
      ) : permissionGeoloc === 'indisponible' ? (
        <div className="mb-4 rounded-xl border border-line bg-surface/40 px-4 py-3">
          <p className="text-[13px] text-muted">
            Ce navigateur ne sait pas te localiser. Cherche ton spot ci-dessous.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            onUtiliserMaPosition()
            onFermer()
          }}
          className="mb-4 w-full rounded-xl border border-line bg-surface/60 px-4 py-3 text-left text-[14px] text-foam transition-colors hover:bg-raised"
        >
          <span className="font-medium">📍 Utiliser ma position</span>
          <span className="mt-0.5 block text-[12px] text-dim">
            {permissionGeoloc === 'accordee'
              ? 'Détecte le lieu où tu te trouves'
              : 'Ton navigateur va demander l’autorisation'}
          </span>
        </button>
      )}

      <input
        type="search"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Plage, ville, adresse ou coordonnées GPS…"
        autoFocus
        className="w-full rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-[14px] text-foam outline-none placeholder:text-dim focus:border-foam/40"
      />

      {spotsCorrespondants.length > 0 && (
        <>
          <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.18em] text-dim">
            {requeteDebounced.trim() ? 'SPOTS VÉRIFIÉS' : positionConnue ? 'LES PLUS PROCHES' : 'SPOTS DISCRETS D’ABORD'}
          </p>
          <ul className="space-y-0.5">
            {spotsCorrespondants.map((spot) => (
              <li key={spot.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChoisirResultat({
                      cle: spot.id,
                      nom: spot.name,
                      localite: spot.locality,
                      pays: spot.country,
                      lat: spot.lat,
                      lon: spot.lon,
                      categorie: 'spot',
                    })
                    onFermer()
                  }}
                  className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <span className="block text-[14px] text-foam">{spot.name}</span>
                  <span className="block text-[12px] text-dim">
                    {spot.locality} · {spot.country}
                    {distances[spot.id] !== undefined && ` · ${formaterDistance(distances[spot.id])}`}
                    <span className="ml-1.5 text-go/70">orientation vérifiée</span>
                  </span>
                </button>
              </li>
            ))}
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
              <li key={lieu.cle}>
                <button
                  type="button"
                  onClick={() => {
                    onChoisirResultat(lieu)
                    onFermer()
                  }}
                  className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <span className="block text-[14px] text-foam">{lieu.nom}</span>
                  <span className="block text-[12px] text-dim">
                    {[lieu.localite, lieu.pays].filter(Boolean).join(' · ')}
                    {lieu.categorie && <span className="ml-1.5 opacity-70">{lieu.categorie}</span>}
                  </span>
                </button>
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
