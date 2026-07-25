import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  /** vitesse du vent en nœuds : elle règle la vitesse des traînées */
  ventNoeuds: number
  /** provenance du vent en degrés : elle règle leur sens */
  directionDeg: number
  className?: string
}

const NB_TRAINEES = 70
const LONGUEUR_MIN = 18
const LONGUEUR_MAX = 64

interface Trainee {
  x: number
  y: number
  longueur: number
  /** entre 0 et 1 : donne de la profondeur au champ */
  plan: number
}

/**
 * Fond animé : un champ de traînées qui file dans le sens du vent réel, à une
 * vitesse proportionnelle au vent mesuré et dans la couleur du verdict.
 *
 * L'idée d'un fond génératif plein écran vient d'un hero « Odyssey » dont le
 * shader WebGL animait un éclair. L'éclair ne veut rien dire ici, alors on
 * garde la technique et on lui fait porter l'information : à 8 nœuds le champ
 * est presque immobile, à 30 il file. C'est une lecture périphérique, jamais
 * une donnée à lire — d'où l'opacité très basse.
 *
 * Canvas 2D plutôt que WebGL : quelques dizaines de segments suffisent, et
 * l'animation s'arrête dès que l'onglet passe en arrière-plan.
 */
export function ChampVent({ ventNoeuds, directionDeg, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Refs plutôt que deps : le vent change sans jamais relancer l'animation
  const ventRef = useRef(ventNoeuds)
  const directionRef = useRef(directionDeg)
  ventRef.current = ventNoeuds
  directionRef.current = directionDeg

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let trainees: Trainee[] = []
    let frame = 0
    let largeur = 0
    let hauteur = 0

    const redimensionner = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      largeur = canvas.clientWidth
      hauteur = canvas.clientHeight
      canvas.width = largeur * dpr
      canvas.height = hauteur * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const semer = () => {
      trainees = Array.from({ length: NB_TRAINEES }, () => ({
        x: Math.random() * largeur,
        y: Math.random() * hauteur,
        longueur: LONGUEUR_MIN + Math.random() * (LONGUEUR_MAX - LONGUEUR_MIN),
        plan: 0.25 + Math.random() * 0.75,
      }))
    }

    redimensionner()
    semer()

    // La couleur suit le verdict, relue à chaque image car elle peut changer
    const couleurVerdict = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--verdict').trim() || '#2fe3a0'

    const dessiner = () => {
      ctx.clearRect(0, 0, largeur, hauteur)

      // Le vent souffle vers l'opposé de sa provenance
      const angle = ((directionRef.current + 180) * Math.PI) / 180
      const dx = Math.sin(angle)
      const dy = -Math.cos(angle)
      // 8 nœuds ≈ immobile, 35 ≈ rapide, borné pour rester lisible
      const vitesse = Math.min(3.2, Math.max(0.12, (ventRef.current - 5) / 9))
      const couleur = couleurVerdict()

      ctx.lineCap = 'round'
      for (const t of trainees) {
        if (!reduit) {
          t.x += dx * vitesse * t.plan
          t.y += dy * vitesse * t.plan
          // Réapparition de l'autre côté, sans coupure visible
          const marge = LONGUEUR_MAX
          if (t.x < -marge) t.x = largeur + marge
          if (t.x > largeur + marge) t.x = -marge
          if (t.y < -marge) t.y = hauteur + marge
          if (t.y > hauteur + marge) t.y = -marge
        }

        const l = t.longueur * t.plan
        ctx.beginPath()
        ctx.globalAlpha = 0.035 + t.plan * 0.05
        ctx.strokeStyle = couleur
        ctx.lineWidth = 0.6 + t.plan * 1.1
        ctx.moveTo(t.x, t.y)
        ctx.lineTo(t.x - dx * l, t.y - dy * l)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      frame = requestAnimationFrame(dessiner)
    }

    frame = requestAnimationFrame(dessiner)

    // On coupe l'animation dès que l'onglet n'est plus visible : rien ne
    // justifie de consommer de la batterie pour un décor qu'on ne voit pas.
    const surVisibilite = () => {
      cancelAnimationFrame(frame)
      if (document.visibilityState === 'visible') frame = requestAnimationFrame(dessiner)
    }
    const surRedimension = () => {
      redimensionner()
      semer()
    }

    document.addEventListener('visibilitychange', surVisibilite)
    window.addEventListener('resize', surRedimension)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', surVisibilite)
      window.removeEventListener('resize', surRedimension)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 h-full w-full', className)}
    />
  )
}
