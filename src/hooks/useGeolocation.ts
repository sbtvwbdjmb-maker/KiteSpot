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

      // Les navigateurs interdisent la géolocalisation hors contexte sécurisé
      // (https, ou localhost). En réseau local sur http — l'IP du téléphone
      // pendant le développement, typiquement — l'appel échoue aussitôt en
      // PERMISSION_DENIED. On le dit clairement plutôt que d'inviter à
      // « autoriser » une permission qui n'existe pas dans ce cas.
      if (!window.isSecureContext) {
        const message =
          'La localisation exige une connexion sécurisée (https). Sur le réseau local en http, le navigateur la bloque — ouvre KiteSpot en https, ou cherche ton spot à la main.'
        setEtat((e) => ({ ...e, statut: 'erreur', erreur: message, permission: 'indisponible' }))
        reject(new Error(message))
        return
      }

      setEtat((e) => ({ ...e, statut: 'chargement', erreur: undefined }))

      const succes = (position: GeolocationPosition) => {
        setEtat({ statut: 'succes', permission: 'accordee' })
        resolve({ lat: position.coords.latitude, lon: position.coords.longitude })
      }

      const echec = (err: GeolocationPositionError) => {
        let message: string
        let permission: EtatPermission = 'a-demander'
        if (err.code === err.PERMISSION_DENIED) {
          permission = 'refusee'
          message =
            'Localisation bloquée pour ce site. Autorise-la depuis l’icône à gauche de l’adresse, puis réessaie.'
        } else if (err.code === err.TIMEOUT) {
          message = 'La localisation a mis trop de temps. Réessaie ou cherche ton spot.'
        } else {
          // POSITION_UNAVAILABLE : sur un ordinateur, c'est presque toujours le
          // Service de localisation coupé au niveau du système ou du navigateur.
          message =
            'Position introuvable. Vérifie que le service de localisation est activé (sur Mac : Réglages → Confidentialité), ou cherche ton spot à la main.'
        }
        setEtat({ statut: 'erreur', erreur: message, permission })
        reject(new Error(message))
      }

      // On tente d'abord la haute précision (GPS sur mobile). Si le fournisseur
      // haute précision échoue — fréquent sur un poste sans GPS, qui répond alors
      // POSITION_UNAVAILABLE ou TIMEOUT —, on retente une fois en basse précision
      // (WiFi / IP), largement suffisant pour trouver le spot le plus proche.
      navigator.geolocation.getCurrentPosition(succes, (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          echec(err)
          return
        }
        navigator.geolocation.getCurrentPosition(succes, echec, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000,
        })
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 2 * 60 * 1000 })
    })
  }, [])

  return { ...etat, localiser }
}
