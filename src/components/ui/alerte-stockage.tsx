import { useState } from 'react'

/**
 * Bandeau affiché uniquement quand le navigateur empêche la sauvegarde locale
 * (navigation privée, données de site bloquées…). Sans lui, l'app oublie les
 * réglages au rafraîchissement sans rien dire : ce message explique pourquoi,
 * plutôt que de laisser le rider croire à un bug.
 */
export function AlerteStockage() {
  const [ferme, setFerme] = useState(false)
  if (ferme) return null

  return (
    <div
      role="alert"
      className="verre-leger monte relative z-30 mx-auto mt-3 flex max-w-2xl items-start gap-3 px-4 py-3"
    >
      <span aria-hidden className="mt-px shrink-0 text-warn">
        ▲
      </span>
      <p className="text-[13px] leading-snug text-foam/90">
        Ton navigateur empêche la sauvegarde locale (navigation privée ou données de site bloquées).
        Tes réglages tiennent le temps de la visite, mais seront oubliés au rafraîchissement. Ouvre
        KiteSpot dans une fenêtre normale pour les conserver.
      </p>
      <button
        type="button"
        onClick={() => setFerme(true)}
        aria-label="Fermer"
        className="-mr-1 shrink-0 rounded-md px-1.5 text-dim transition-colors hover:text-foam"
      >
        ✕
      </button>
    </div>
  )
}
