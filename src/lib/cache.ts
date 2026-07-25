interface Entree<T> {
  valeur: T
  expireA: number
}

/**
 * Cache mémoire à durée de vie, partagé par tous les appels d'un même type.
 * Il sert deux buts : rester sous les quotas d'Open-Meteo (voir README) et
 * éviter de recharger les mêmes coordonnées à chaque va-et-vient entre spots.
 * Les requêtes en vol sont mutualisées pour ne jamais lancer deux fois le même appel.
 */
export function creerCache<T>(dureeMs: number) {
  const entrees = new Map<string, Entree<T>>()
  const enVol = new Map<string, Promise<T>>()

  return {
    async resoudre(cle: string, produire: () => Promise<T>, forcer = false): Promise<T> {
      const maintenant = Date.now()

      if (!forcer) {
        const entree = entrees.get(cle)
        if (entree && entree.expireA > maintenant) return entree.valeur
        const encours = enVol.get(cle)
        if (encours) return encours
      }

      const promesse = produire()
        .then((valeur) => {
          entrees.set(cle, { valeur, expireA: Date.now() + dureeMs })
          return valeur
        })
        .finally(() => {
          enVol.delete(cle)
        })

      enVol.set(cle, promesse)
      return promesse
    },

    invalider(cle: string) {
      entrees.delete(cle)
    },
  }
}

/** Clé de cache stable pour un point : on arrondit pour regrouper les points voisins */
export function clePoint(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}
