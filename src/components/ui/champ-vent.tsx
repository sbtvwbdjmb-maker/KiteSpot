import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'

interface Props {
  /** vitesse du vent en nœuds : elle règle l'intensité et la vitesse du flux */
  ventNoeuds: number
  /** provenance du vent en degrés (convention météo) : elle règle le sens du flux */
  directionDeg: number
  className?: string
}

/**
 * Fond animé plein écran, rendu en WebGL (three.js).
 *
 * Un shader plein cadre peint un ciel clair et y fait courir un champ de
 * filaments de vent : du bruit fractal étiré dans le sens du vent réel, qui
 * défile à une vitesse proportionnelle au vent mesuré et se teinte très
 * légèrement de la couleur du verdict. À 8 nœuds le champ est presque immobile,
 * à 30 il file franchement — la visualisation *est* la donnée, pas un décor.
 *
 * Un seul quad et un fragment shader : le coût GPU est constant quelle que
 * soit la densité apparente des filaments, et l'animation s'arrête dès que
 * l'onglet passe en arrière-plan.
 */
export function ChampVent({ ventNoeuds, directionDeg, className }: Props) {
  const conteneurRef = useRef<HTMLDivElement>(null)
  // Refs plutôt que deps : le vent change sans jamais relancer la scène
  const ventRef = useRef(ventNoeuds)
  const directionRef = useRef(directionDeg)
  ventRef.current = ventNoeuds
  directionRef.current = directionDeg

  useEffect(() => {
    const conteneur = conteneurRef.current
    if (!conteneur) return

    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    conteneur.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uWindDir: { value: new THREE.Vector2(0, 1) },
      uSpeed: { value: 0.05 },
      uIntensity: { value: 0.18 },
      uColor: { value: new THREE.Color('#2f9e63') },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime;
        uniform vec2  uRes;
        uniform vec2  uWindDir;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform vec3  uColor;

        // Bruit de valeur 2D + fbm, la base des filaments
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 5; i++) {
            v += amp * noise(p);
            p *= 2.02;
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          // Coordonnées centrées, isotropes (mise à l'échelle par le petit côté)
          vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

          // Repère aligné sur le vent : x le long du vent, y en travers
          vec2 dir = normalize(uWindDir + 1e-5);
          vec2 perp = vec2(-dir.y, dir.x);
          vec2 P = vec2(dot(p, dir), dot(p, perp));

          // Léger serpentement transversal pour que les filaments ne soient
          // pas de parfaites droites
          P.y += (fbm(vec2(P.x * 0.35 - uTime * uSpeed * 0.5, 7.0)) - 0.5) * 0.6;

          // Deux couches étirées le long du vent, défilant à des vitesses
          // légèrement différentes : ça donne de la profondeur au flux
          vec2 q1 = vec2(P.x * 0.13 - uTime * uSpeed, P.y * 1.8);
          vec2 q2 = vec2(P.x * 0.085 - uTime * uSpeed * 0.62 + 19.0, P.y * 2.7 + 4.0);
          float f1 = fbm(q1 * 3.0);
          float f2 = fbm(q2 * 3.0);
          // Fondus larges : des voiles diffus plutôt que des rayures franches
          float streak = smoothstep(0.5, 1.02, f1) * 0.7
                       + smoothstep(0.56, 1.06, f2) * 0.42;

          // Transparent : seuls les filaments sont peints, pour passer par-dessus
          // le fond média sans le masquer. Blancs vaporeux, teintés d'un soupçon
          // de verdict ; l'opacité porte l'intensité du vent.
          vec3 souffle = mix(vec3(1.0), uColor, 0.30);
          float alpha = streak * uIntensity;

          gl_FragColor = vec4(souffle, clamp(alpha, 0.0, 1.0));
        }
      `,
    })

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(quad)

    // Lecture de la valeur calculée de --verdict à chaque image
    const lireVerdict = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--verdict').trim()
      if (v) uniforms.uColor.value.set(v)
    }

    const redimensionner = () => {
      const l = conteneur.clientWidth
      const h = conteneur.clientHeight
      renderer.setSize(l, h, false)
      const dpr = renderer.getPixelRatio()
      uniforms.uRes.value.set(l * dpr, h * dpr)
    }
    redimensionner()

    let frame = 0
    let precedent = performance.now()

    const dessiner = (maintenant: number) => {
      const dt = Math.min(0.05, (maintenant - precedent) / 1000)
      precedent = maintenant

      // Le vent souffle vers l'opposé de sa provenance (bearing = dir + 180)
      const bearing = ((directionRef.current + 180) * Math.PI) / 180
      // Repère écran, y vers le haut ≈ nord en haut
      uniforms.uWindDir.value.set(Math.sin(bearing), Math.cos(bearing))

      const kt = ventRef.current
      uniforms.uSpeed.value = Math.min(0.24, Math.max(0.012, (kt - 2) * 0.0085))
      // Opacité des filaments : plus présente quand ça souffle, sans jamais
      // noyer le fond média ni le contenu
      uniforms.uIntensity.value = Math.min(0.3, 0.14 + kt * 0.005)
      lireVerdict()

      if (!reduit) uniforms.uTime.value += dt
      renderer.render(scene, camera)
      frame = requestAnimationFrame(dessiner)
    }
    frame = requestAnimationFrame(dessiner)

    const surVisibilite = () => {
      cancelAnimationFrame(frame)
      if (document.visibilityState === 'visible') {
        precedent = performance.now()
        frame = requestAnimationFrame(dessiner)
      }
    }
    const surRedimension = () => redimensionner()

    document.addEventListener('visibilitychange', surVisibilite)
    window.addEventListener('resize', surRedimension)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', surVisibilite)
      window.removeEventListener('resize', surRedimension)
      quad.geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === conteneur) conteneur.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={conteneurRef}
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 -z-10 h-full w-full', className)}
    />
  )
}
