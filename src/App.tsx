import { useEffect, useState } from 'react'
import { LocationPicker } from './components/LocationPicker'
import { WindConditions } from './components/WindConditions'
import { fetchVent, type DonneesVent } from './services/weather'
import type { Localisation } from './types/location'

function App() {
  const [localisation, setLocalisation] = useState<Localisation | null>(null)
  const [donneesVent, setDonneesVent] = useState<DonneesVent | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!localisation) return

    let annule = false
    setChargement(true)
    setErreur(null)

    fetchVent(localisation.lat, localisation.lon)
      .then((data) => {
        if (!annule) setDonneesVent(data)
      })
      .catch(() => {
        if (!annule) setErreur('Impossible de récupérer la météo pour ce lieu')
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })

    return () => {
      annule = true
    }
  }, [localisation])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-xl font-bold text-sky-700">🪁 KiteSpot</h1>
        <p className="text-sm text-slate-500">Conditions de vent gratuites &amp; découverte de spots</p>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <LocationPicker onLocationSelected={setLocalisation} />

        {localisation && (
          <WindConditions
            donnees={donneesVent}
            chargement={chargement}
            erreur={erreur}
            label={localisation.label}
          />
        )}

        {!localisation && (
          <p className="mt-8 text-center text-sm text-slate-400">
            Partagez votre position ou recherchez une ville pour voir les conditions de vent.
          </p>
        )}
      </main>
    </div>
  )
}

export default App
