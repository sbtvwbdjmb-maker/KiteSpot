import { useEffect, useRef } from 'react'
import type { Sport } from '@/lib/sport'

interface Props {
  sport: Sport
}

/**
 * Fond d'ambiance par sport.
 * - `video` : plan animé (optionnel). Absent = fond photo fixe.
 * - `poster` : image fixe — poster de la vidéo, ou photo de fond à part entière.
 * - `position` : object-position, la bande de l'image à privilégier.
 * - `vitesse` : ralentit la lecture (< 1) pour l'esprit posé de la vidéo.
 *
 * Les deux sports ont une photo fixe (plus légère qu'une vidéo, et le halo de
 * lisibilité + le voile clair du haut la font bien passer sous le verdict) :
 * - Kite : coucher de soleil doré, kite au-dessus des vagues. En portrait, on
 *   cale le cadrage un peu vers le haut (`50% 32%`) pour garder le grand kite
 *   et le ciel dans la bande visible sur les écrans larges.
 * - Surf : surfeur sur une vague bleue, en paysage. Cadrage un peu vers le haut
 *   (`50% 42%`) pour garder le surfeur et la crête, sans trop montrer l'écume
 *   du bas.
 */
const FONDS: Record<Sport, { video?: string; poster: string; position?: string; vitesse?: number }> =
  {
    surf: { poster: '/fond-surf-photo.jpg', position: '50% 42%' },
    kite: { poster: '/fond-kite-photo.jpg', position: '50% 32%' },
  }

/**
 * Fond d'ambiance propre au sport, tout au fond de la page (sous le champ de
 * vent et sous les cartes) : une vidéo de kitesurf en rubrique Kite, une vidéo
 * de vague en rubrique Surf. On la remonte à chaque bascule pour un fondu.
 *
 * La vidéo joue en boucle, muette, en lecture inline. Elle se met en pause
 * quand l'onglet passe en arrière-plan, et cède la place à son poster fixe si
 * l'utilisateur a demandé à réduire les animations.
 */
export function FondSport({ sport }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduit =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const fond = FONDS[sport]
  // Le zoom `--kite` recadrait le kiteur de la vidéo ; la photo se pose telle
  // quelle, en plan large.
  const utiliseVideo = !reduit && !!fond.video
  const mediaClass = 'fond-media'

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // playbackRate est remis à 1 quand la source (re)charge : on le réaffirme
    const appliquerVitesse = () => {
      video.playbackRate = fond.vitesse ?? 1
    }
    appliquerVitesse()
    video.addEventListener('loadedmetadata', appliquerVitesse)
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') void video.play().catch(() => {})
      else video.pause()
    }
    document.addEventListener('visibilitychange', surVisibilite)
    return () => {
      video.removeEventListener('loadedmetadata', appliquerVitesse)
      document.removeEventListener('visibilitychange', surVisibilite)
    }
    // `fond` (donc sa vitesse) est entièrement déterminé par `sport`
  }, [sport])

  return (
    <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" aria-hidden>
      <div key={sport} className="fond-apparait absolute inset-0">
        {!utiliseVideo ? (
          <img
            className={mediaClass}
            src={fond.poster}
            alt=""
            style={{ objectPosition: fond.position }}
          />
        ) : (
          <video
            ref={videoRef}
            className={mediaClass}
            src={fond.video}
            poster={fond.poster}
            style={{ objectPosition: fond.position }}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        )}
        {/* Voile clair en haut : éclaircit la bande où se lit le verdict, en
            fondu total (pas de bord), sans toucher le bas de l'image. */}
        <div className="fond-voile" />
      </div>
    </div>
  )
}
