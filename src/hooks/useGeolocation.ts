import { useCallback, useEffect, useState } from 'react'

export type EtatPermission = 'inconnue' | 'accordee' | 'a-demander' | 'refusee' | 'indisponible'

interface EtatGeoloc {
  statut: 'idle' | 'chargement' | 'succes' | 'erreur'
  erreur?: string
  permission: EtatPermission
}

/**
 * Géolocalisation du navigateur.
 *
 * Point important : on ne déclenche jamais la demande de permission tout seul
 * au chargement. Un navigateur ne redemande pas une permission refusée, donc
 * une demande non sollicitée que l'utilisateur écarte condamne définitivement
 * le bouton « Utiliser ma position ». On interroge donc d'abord l'API
 * Permissions, et on ne localise d'office que si l'accord est déjà donné.
 */
export function useGeolocation() {
  const [etat, setEtat] = useState<EtatGeoloc>({ statut: 'idle', permission: 'inconnue' })

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setEtat((e) => ({ ...e, permission: 'indisponible' }))
      return
    }
    if (!navigator.permissions?.query) {
      // Safari ancien : pas d'API Permissions, on laissera l'utilisateur cliquer
      setEtat((e) => ({ ...e, permission: 'a-demander' }))
      return
    }

    let annule = false
    const lire = (s: PermissionState) =>
      setEtat((e) => ({
        ...e,
        permission: s === 'granted' ? 'accordee' : s === 'denied' ? 'refusee' : 'a-demander',
      }))

    void navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (annule) return
        lire(s.state)
        // La permission peut changer pendant la session, depuis la barre d'adresse
        s.addEventListener('change', () => lire(s.state))
      })
      .catch(() => {
        if (!annule) setEtat((e) => ({ ...e, permission: 'a-demander' }))
      })

    return () => {
      annule = true
    }
  }, [])

  const localiser = useCallback((): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const message = 'Ce navigateur ne sait pas te localiser. Cherche ton spot à la main.'
        setEtat((e) => ({ ...e, statut: 'erreur', erreur: message, permission: 'indisponible' }))
        reject(new Error(message))
        return
      }

      setEtat((e) => ({ ...e, statut: 'chargement', erreur: undefined }))

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEtat({ statut: 'succes', permission: 'accordee' })
          resolve({ lat: position.coords.latitude, lon: position.coords.longitude })
        },
        (err) => {
          let message: string
          let permission: EtatPermission = 'a-demander'
          if (err.code === err.PERMISSION_DENIED) {
            permission = 'refusee'
            message =
              'Localisation bloquée pour ce site. Autorise-la depuis l’icône à gauche de l’adresse, puis réessaie.'
          } else if (err.code === err.TIMEOUT) {
            message = 'La localisation a mis trop de temps. Réessaie ou cherche ton spot.'
          } else {
            message = 'Position introuvable. Cherche ton spot à la main.'
          }
          setEtat({ statut: 'erreur', erreur: message, permission })
          reject(new Error(message))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 2 * 60 * 1000 },
      )
    })
  }, [])

  return { ...etat, localiser }
}
