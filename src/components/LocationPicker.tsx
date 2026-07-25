import { useEffect, useRef, useState } from 'react'
import { useGeolocation } from '../hooks/useGeolocation'
import { useDebounce } from '../hooks/useDebounce'
import { rechercherVille, type VilleResultat } from '../services/geocoding'
import type { Localisation } from '../types/location'

interface Props {
  onLocationSelected: (loc: Localisation) => void
}

export function LocationPicker({ onLocationSelected }: Props) {
  const { statut, erreur, localiser } = useGeolocation()
  const [requete, setRequete] = useState('')
  const [resultats, setResultats] = useState<VilleResultat[]>([])
  const [rechercheEnCours, setRechercheEnCours] = useState(false)
  const [rechercheErreur, setRechercheErreur] = useState<string | null>(null)
  const [menuOuvert, setMenuOuvert] = useState(false)
  const requeteDebounced = useDebounce(requete, 350)
  const conteneurRef = useRef<HTMLDivElement>(null)
  // Évite de relancer une recherche (et de rouvrir le menu) juste après une sélection
  const ignorerProchaineRecherche = useRef(false)

  useEffect(() => {
    let annule = false
    if (ignorerProchaineRecherche.current) {
      ignorerProchaineRecherche.current = false
      return
    }
    if (requeteDebounced.trim().length < 2) {
      setResultats([])
      return
    }
    setRechercheEnCours(true)
    setRechercheErreur(null)
    rechercherVille(requeteDebounced)
      .then((res) => {
        if (!annule) {
          setResultats(res)
          setMenuOuvert(true)
        }
      })
      .catch(() => {
        if (!annule) setRechercheErreur('Recherche impossible, réessayez')
      })
      .finally(() => {
        if (!annule) setRechercheEnCours(false)
      })
    return () => {
      annule = true
    }
  }, [requeteDebounced])

  // Ferme le menu déroulant au clic en dehors du composant
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setMenuOuvert(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleGeoloc() {
    try {
      const { lat, lon } = await localiser()
      onLocationSelected({ lat, lon, label: 'Ma position' })
    } catch {
      // l'erreur est déjà exposée via le hook useGeolocation
    }
  }

  function handleSelectVille(ville: VilleResultat) {
    const label = ville.region ? `${ville.nom}, ${ville.region}` : ville.nom
    ignorerProchaineRecherche.current = true
    setRequete(ville.nom)
    setResultats([])
    setMenuOuvert(false)
    onLocationSelected({ lat: ville.lat, lon: ville.lon, label })
  }

  return (
    <div ref={conteneurRef} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <button
        type="button"
        onClick={handleGeoloc}
        disabled={statut === 'chargement'}
        className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {statut === 'chargement' ? 'Localisation…' : '📍 Ma position'}
      </button>

      <div className="relative flex-1">
        <input
          type="text"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          onFocus={() => resultats.length > 0 && setMenuOuvert(true)}
          placeholder="Ou tapez une ville (ex : Hyères)"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
        {menuOuvert && (rechercheEnCours || resultats.length > 0 || rechercheErreur) && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {rechercheEnCours && <li className="px-4 py-2 text-sm text-slate-400">Recherche…</li>}
            {rechercheErreur && <li className="px-4 py-2 text-sm text-red-500">{rechercheErreur}</li>}
            {!rechercheEnCours &&
              resultats.map((ville) => (
                <li key={ville.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectVille(ville)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-sky-50"
                  >
                    <span className="font-medium text-slate-800">{ville.nom}</span>
                    <span className="ml-1 text-slate-400">
                      {[ville.region, ville.pays].filter(Boolean).join(', ')}
                    </span>
                  </button>
                </li>
              ))}
            {!rechercheEnCours && !rechercheErreur && resultats.length === 0 && (
              <li className="px-4 py-2 text-sm text-slate-400">Aucune ville trouvée</li>
            )}
          </ul>
        )}
      </div>

      {erreur && statut === 'erreur' && <p className="text-sm text-red-500 sm:self-center">{erreur}</p>}
    </div>
  )
}
