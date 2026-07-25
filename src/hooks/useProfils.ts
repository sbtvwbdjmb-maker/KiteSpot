import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { PROFIL_PAR_DEFAUT, type Profil } from '../types/profile'

interface EtatProfils {
  profils: Profil[]
  actifId: string
}

function creerIdentifiant(): string {
  return `p_${Math.random().toString(36).slice(2, 9)}`
}

const ETAT_INITIAL: EtatProfils = (() => {
  const premier: Profil = { ...PROFIL_PAR_DEFAUT, id: creerIdentifiant() }
  return { profils: [premier], actifId: premier.id }
})()

export function useProfils() {
  const [etat, setEtat] = useLocalStorage<EtatProfils>('kitespot.profils.v1', ETAT_INITIAL)

  const profilActif = useMemo(
    () => etat.profils.find((p) => p.id === etat.actifId) ?? etat.profils[0],
    [etat],
  )

  const selectionner = useCallback(
    (id: string) => setEtat((e) => ({ ...e, actifId: id })),
    [setEtat],
  )

  const modifier = useCallback(
    (id: string, champs: Partial<Omit<Profil, 'id'>>) =>
      setEtat((e) => ({
        ...e,
        profils: e.profils.map((p) => (p.id === id ? { ...p, ...champs } : p)),
      })),
    [setEtat],
  )

  const ajouter = useCallback(
    (nom: string) => {
      const nouveau: Profil = { ...PROFIL_PAR_DEFAUT, id: creerIdentifiant(), nom }
      setEtat((e) => ({ profils: [...e.profils, nouveau], actifId: nouveau.id }))
      return nouveau
    },
    [setEtat],
  )

  const supprimer = useCallback(
    (id: string) =>
      setEtat((e) => {
        // On garde toujours au moins un profil pour ne jamais se retrouver sans reco
        if (e.profils.length <= 1) return e
        const restants = e.profils.filter((p) => p.id !== id)
        return {
          profils: restants,
          actifId: e.actifId === id ? restants[0].id : e.actifId,
        }
      }),
    [setEtat],
  )

  return { profils: etat.profils, profilActif, selectionner, modifier, ajouter, supprimer }
}
