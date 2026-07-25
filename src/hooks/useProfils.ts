import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { VALEURS_DEPART, type Profil } from '../types/profile'

interface EtatProfils {
  profils: Profil[]
  actifId: string | null
}

/** Aucun profil au départ : le premier est créé par le rider, rien n'est supposé. */
const ETAT_INITIAL: EtatProfils = { profils: [], actifId: null }

function creerIdentifiant(): string {
  return `p_${Math.random().toString(36).slice(2, 9)}`
}

export function useProfils() {
  const [etat, setEtat] = useLocalStorage<EtatProfils>('kitespot.profils.v2', ETAT_INITIAL)

  const profilActif = useMemo(
    () => etat.profils.find((p) => p.id === etat.actifId) ?? etat.profils[0] ?? null,
    [etat],
  )

  const selectionner = useCallback(
    (id: string) => setEtat((e) => ({ ...e, actifId: id })),
    [setEtat],
  )

  const ajouter = useCallback(
    (champs: Partial<Omit<Profil, 'id'>> & { nom: string }) => {
      const nouveau: Profil = { ...VALEURS_DEPART, ...champs, id: creerIdentifiant() }
      setEtat((e) => ({ profils: [...e.profils, nouveau], actifId: nouveau.id }))
      return nouveau
    },
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

  const supprimer = useCallback(
    (id: string) =>
      setEtat((e) => {
        const restants = e.profils.filter((p) => p.id !== id)
        return { profils: restants, actifId: e.actifId === id ? (restants[0]?.id ?? null) : e.actifId }
      }),
    [setEtat],
  )

  return { profils: etat.profils, profilActif, selectionner, ajouter, modifier, supprimer }
}
