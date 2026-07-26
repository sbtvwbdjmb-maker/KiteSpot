import { useEffect, useRef } from 'react'
import type { Sport } from '@/lib/sport'

interface Props {
  sport: Sport
}

/**
 * Fond d'ambiance propre au sport, tout au fond de la page (sous le champ de
 * vent et sous les cartes) : une photo de kite en rubrique Kite, une vidéo de
 * vague en rubrique Surf. La couche est tamisée et fondue par `.fond-voile`
 * pour rester discrète ; on la remonte à chaque bascule pour un fondu.
 *
 * En Surf, la vidéo joue en boucle, muette, en lecture inline. Elle se met en
 * pause quand l'onglet passe en arrière-plan, et cède la place à son poster
 * fixe si l'utilisateur a demandé à réduire les animations.
 */
export function FondSport({ sport }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduit =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') void video.play().catch(() => {})
      else video.pause()
    }
    document.addEventListener('visibilitychange', surVisibilite)
    return () => document.removeEventListener('visibilitychange', surVisibilite)
  }, [sport])

  return (
    <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" aria-hidden>
      <div key={sport} className="fond-apparait absolute inset-0">
        {sport === 'surf' && !reduit ? (
          <video
            ref={videoRef}
            className="fond-media"
            src="/fond-surf.mp4"
            poster="/fond-surf.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        ) : (
          <img
            className="fond-media"
            src={sport === 'surf' ? '/fond-surf.jpg' : '/fond-kite.jpg'}
            alt=""
          />
        )}
        <div className="fond-voile" />
      </div>
    </div>
  )
}
