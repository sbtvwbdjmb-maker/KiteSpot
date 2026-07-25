import { useCallback, useState } from 'react'

interface EtatGeoloc {
  statut: 'idle' | 'chargement' | 'succes' | 'erreur'
  erreur?: string
}

// Encapsule l'API de géolocalisation du navigateur dans un hook simple à utiliser
export function useGeolocation() {
  const [etat, setEtat] = useState<EtatGeoloc>({ statut: 'idle' })

  const localiser = useCallback((): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const message = "La géolocalisation n'est pas disponible sur ce navigateur"
        setEtat({ statut: 'erreur', erreur: message })
        reject(new Error(message))
        return
      }

      setEtat({ statut: 'chargement' })

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEtat({ statut: 'succes' })
          resolve({ lat: position.coords.latitude, lon: position.coords.longitude })
        },
        (err) => {
          const message =
            err.code === err.PERMISSION_DENIED
              ? 'Localisation refusée : choisis ton spot à la main.'
              : 'Position introuvable : choisis ton spot à la main.'
          setEtat({ statut: 'erreur', erreur: message })
          reject(new Error(message))
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
      )
    })
  }, [])

  return { ...etat, localiser }
}
