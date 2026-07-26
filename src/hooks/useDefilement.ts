import { useEffect, useState } from 'react'

/**
 * true dès que la page a défilé au-delà du seuil.
 *
 * Sert à faire rétracter la barre flottante : en haut de page elle est ample,
 * puis elle se resserre pour rendre la place au contenu — sans jamais
 * disparaître, puisqu'elle porte la bascule Kite/Surf.
 *
 * Une marge sépare le seuil d'ouverture de celui de fermeture : sans elle, la
 * barre se met à clignoter quand on s'arrête pile sur la limite.
 */
export function useDefilement(seuil = 48, marge = 16): boolean {
  const [defile, setDefile] = useState(false)

  useEffect(() => {
    let attente = false

    const mesurer = () => {
      attente = false
      const y = window.scrollY
      setDefile((actuel) => (actuel ? y > seuil - marge : y > seuil))
    }

    const surDefilement = () => {
      if (attente) return
      attente = true
      requestAnimationFrame(mesurer)
    }

    mesurer()
    window.addEventListener('scroll', surDefilement, { passive: true })
    return () => window.removeEventListener('scroll', surDefilement)
  }, [seuil, marge])

  return defile
}
