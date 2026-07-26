import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { AnalyseDirection } from '../lib/direction'
import { degresVersCardinal } from '../lib/direction'

interface Props {
  /** provenance du vent en degrés (convention météo) */
  directionDeg: number
  /** orientation du littoral, ou null quand elle est inconnue ici */
  orientationLittoral: number | null
  ventNoeuds: number
  rafalesNoeuds: number
  analyse: AnalyseDirection | null
  /** provenance de la houle : deux crêtes bleues, affichées en surf */
  directionHouleDeg?: number | null
}

/** Inclinaison du plateau : le disque est couché en perspective (≈ 53°). */
const INCLINAISON = -0.93

/**
 * Convertit un cap boussole (0 = N, 90 = E, sens horaire) en rotation autour de
 * la normale du plateau, pour qu'un objet dont l'avant local est +Y pointe vers
 * ce cap une fois le plateau incliné.
 */
function capVersRotation(deg: number): number {
  return -(deg * Math.PI) / 180
}

/** Rapproche un angle d'une cible par le plus court chemin (gère le passage 0/2π). */
function approcherAngle(courant: number, cible: number, k: number): number {
  let d = cible - courant
  d = (((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return courant + d * k
}

/**
 * Le cadran de KiteSpot, en volume (three.js).
 *
 * Un plateau circulaire couché en perspective porte le paysage du spot : la
 * mer d'un côté, la terre de l'autre, la bande de sable et l'écume du rivage
 * entre les deux. Le plateau pivote selon l'orientation réelle du littoral, si
 * bien qu'on voit d'un coup d'œil si le vent pousse vers la plage ou vers le
 * large. Une aiguille volumétrique, dans la couleur du verdict, indique le sens
 * où le vent pousse ; deux crêtes marquent la provenance de la houle en surf.
 *
 * Toute l'information reste dessinée, jamais chiffrée : les valeurs sont déjà
 * lues dans le bandeau. Les points cardinaux restent en HTML, fixes et nets.
 */
export function CadranVent({
  directionDeg,
  orientationLittoral,
  ventNoeuds,
  rafalesNoeuds,
  analyse,
  directionHouleDeg = null,
}: Props) {
  const conteneurRef = useRef<HTMLDivElement>(null)

  // Props relues à chaque image, sans jamais relancer la scène
  const props = useRef({ directionDeg, orientationLittoral, analyse, directionHouleDeg })
  props.current = { directionDeg, orientationLittoral, analyse, directionHouleDeg }

  useEffect(() => {
    const conteneur = conteneurRef.current
    if (!conteneur) return

    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lireVar = (nom: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(nom).trim()

    const COULEURS = {
      go: new THREE.Color(lireVar('--color-go') || '#2f9e63'),
      warn: new THREE.Color(lireVar('--color-warn') || '#c78a1c'),
      stop: new THREE.Color(lireVar('--color-stop') || '#c0433c'),
      muted: new THREE.Color(lireVar('--color-muted') || '#566773'),
    }
    const couleurVerdict = (a: AnalyseDirection | null) => {
      if (!a) return COULEURS.muted
      if (a.score >= 0.8) return COULEURS.go
      if (a.score >= 0.45) return COULEURS.warn
      return COULEURS.stop
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    conteneur.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0.02, 3.75)
    camera.lookAt(0, 0.04, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const soleil = new THREE.DirectionalLight(0xffffff, 1.0)
    soleil.position.set(0.5, 1.4, 1.0)
    scene.add(soleil)

    // Racine inclinée : tout le cadran est couché en perspective
    const racine = new THREE.Group()
    racine.rotation.x = INCLINAISON
    scene.add(racine)

    // --- Plateau : paysage du spot, un seul disque, un seul shader ---------
    const paysage = new THREE.Group()
    racine.add(paysage)

    const uPaysage = {
      uTime: { value: 0 },
      uMerClair: { value: new THREE.Color('#a9dcec') },
      uMerFonce: { value: new THREE.Color('#4d9fbd') },
      uSable: { value: new THREE.Color('#ecd9ab') },
      uSableFonce: { value: new THREE.Color('#d4bb87') },
      uTerre: { value: new THREE.Color('#b7c79a') },
      uTerreFonce: { value: new THREE.Color('#93a878') },
      uEcume: { value: new THREE.Color('#f4fbfd') },
    }

    const matPaysage = new THREE.ShaderMaterial({
      uniforms: uPaysage,
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          vP = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vP;
        uniform float uTime;
        uniform vec3 uMerClair, uMerFonce, uSable, uSableFonce, uTerre, uTerreFonce, uEcume;

        float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=0.5;} return v; }

        void main() {
          float y = vP.y;
          float beach = 0.075;
          vec3 col;

          // Mer : bas-fond clair près du rivage, sombre vers le large
          float seaT = smoothstep(beach, 1.0, y);
          vec3 mer = mix(uMerClair, uMerFonce, seaT);
          float rip = sin(y*24.0 - uTime*1.5 + sin(vP.x*7.0)*0.7)
                    + 0.5*sin(y*40.0 + vP.x*4.0 - uTime*2.2);
          mer += smoothstep(0.7, 1.0, rip) * 0.06;

          // Terre : plus sombre vers l'extérieur, grain léger
          float landT = smoothstep(-beach, -1.0, y);
          vec3 terre = mix(uTerre, uTerreFonce, landT);
          terre += (fbm(vP*7.0) - 0.5) * 0.035;

          // Bande de sable
          vec3 sable = mix(uSable, uSableFonce, smoothstep(0.0, beach, abs(y)));

          if (y > beach) col = mer;
          else if (y < -beach) col = terre;
          else col = sable;

          // Écume mobile sur la ligne de rivage (y = beach)
          float ecume = smoothstep(0.03, 0.0, abs(y - beach));
          ecume *= 0.55 + 0.45 * sin(vP.x*26.0 - uTime*3.2);
          col = mix(col, uEcume, clamp(ecume, 0.0, 1.0) * 0.8);

          // Ombrage radial doux vers le bord pour asseoir le volume
          col *= 1.0 - smoothstep(0.7, 1.02, length(vP)) * 0.18;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })

    const disque = new THREE.Mesh(new THREE.CircleGeometry(1, 96), matPaysage)
    paysage.add(disque)

    // --- Couronne fixe : bezel + graduations (ne tourne pas avec le littoral) ---
    const anneau = new THREE.Group()
    racine.add(anneau)

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(1.015, 0.028, 20, 140),
      new THREE.MeshStandardMaterial({ color: 0xf3f8fc, metalness: 0.35, roughness: 0.35 }),
    )
    anneau.add(bezel)

    const encre = new THREE.Color(lireVar('--color-dim') || '#8497a3')
    const matTick = new THREE.MeshBasicMaterial({ color: encre, transparent: true, opacity: 0.7 })
    for (let i = 0; i < 36; i++) {
      const majeur = i % 3 === 0
      const long = majeur ? 0.075 : 0.04
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(majeur ? 0.012 : 0.008, long, 0.006),
        matTick,
      )
      const a = (i * 10 * Math.PI) / 180
      const rMoyen = 0.965 - long / 2
      tick.position.set(Math.sin(a) * rMoyen, Math.cos(a) * rMoyen, 0.01)
      tick.rotation.z = -a
      anneau.add(tick)
    }

    // --- Houle : deux crêtes vers la provenance (surf) ---------------------
    const houle = new THREE.Group()
    racine.add(houle)
    const matHoule = new THREE.MeshBasicMaterial({ color: 0x4d9fbd, transparent: true, opacity: 0.75 })
    const crete = (rayon: number, largeur: number, epaisseur: number) => {
      const courbe = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-largeur, rayon, 0.02),
        new THREE.Vector3(0, rayon + 0.09, 0.02),
        new THREE.Vector3(largeur, rayon, 0.02),
      )
      return new THREE.Mesh(new THREE.TubeGeometry(courbe, 24, epaisseur, 8, false), matHoule)
    }
    houle.add(crete(0.66, 0.16, 0.014))
    const crete2 = crete(0.8, 0.12, 0.011)
    ;(crete2.material as THREE.MeshBasicMaterial).opacity = 0.4
    houle.add(crete2)

    // --- Aiguille du vent : flèche volumétrique flottant au-dessus du plateau ---
    const aiguille = new THREE.Group()
    aiguille.position.z = 0.09
    racine.add(aiguille)

    const matAiguille = new THREE.MeshStandardMaterial({
      color: COULEURS.muted.clone(),
      emissive: COULEURS.muted.clone().multiplyScalar(0.22),
      metalness: 0.2,
      roughness: 0.32,
    })

    // Aiguille directionnelle : une seule pointe franche vers où le vent pousse,
    // une courte queue effilée à l'arrière pour l'équilibre visuel — jamais une
    // seconde pointe qui rendrait le sens ambigu.
    const hampe = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.02, 0.58, 20), matAiguille)
    hampe.position.y = 0.17
    aiguille.add(hampe)

    const tete = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 24), matAiguille)
    tete.position.y = 0.56
    aiguille.add(tete)

    const queue = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.004, 0.16, 16), matAiguille)
    queue.position.y = -0.16
    queue.rotation.z = Math.PI
    aiguille.add(queue)

    const moyeu = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 24, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.25 }),
    )
    aiguille.add(moyeu)

    // Angles courants, lissés vers la cible (inertie type instrument)
    let angPaysage = capVersRotation(orientationLittoral ?? 0)
    let angAiguille = capVersRotation(directionDeg + 180)
    let angHoule = capVersRotation(directionHouleDeg ?? 0)
    paysage.rotation.z = angPaysage
    aiguille.rotation.z = angAiguille
    houle.rotation.z = angHoule

    const redimensionner = () => {
      const c = Math.min(conteneur.clientWidth, conteneur.clientHeight)
      renderer.setSize(c, c, false)
    }
    redimensionner()

    let frame = 0
    let precedent = performance.now()

    const dessiner = (maintenant: number) => {
      const dt = Math.min(0.05, (maintenant - precedent) / 1000)
      precedent = maintenant
      const p = props.current
      const k = reduit ? 1 : 1 - Math.exp(-dt * 5)

      angPaysage = approcherAngle(angPaysage, capVersRotation(p.orientationLittoral ?? 0), k)
      angAiguille = approcherAngle(angAiguille, capVersRotation(p.directionDeg + 180), k)
      paysage.rotation.z = angPaysage
      // Sans orientation connue, on masque le paysage plutôt que d'inventer une côte
      disque.visible = p.orientationLittoral !== null
      aiguille.rotation.z = angAiguille

      const montrerHoule = p.directionHouleDeg !== null && p.directionHouleDeg !== undefined
      houle.visible = montrerHoule
      if (montrerHoule) {
        angHoule = approcherAngle(angHoule, capVersRotation(p.directionHouleDeg as number), k)
        houle.rotation.z = angHoule
      }

      // Couleur de l'aiguille : elle glisse vers la couleur du verdict
      const cible = couleurVerdict(p.analyse)
      matAiguille.color.lerp(cible, k)
      matAiguille.emissive.copy(matAiguille.color).multiplyScalar(0.22)

      if (!reduit) {
        uPaysage.uTime.value += dt
        // Léger flottement de l'aiguille, pour le vivant
        aiguille.position.z = 0.09 + Math.sin(maintenant * 0.0016) * 0.012
      }

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
    const observer = new ResizeObserver(redimensionner)
    observer.observe(conteneur)
    document.addEventListener('visibilitychange', surVisibilite)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', surVisibilite)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = (m as THREE.Mesh).material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else if (mat) (mat as THREE.Material).dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === conteneur) conteneur.removeChild(renderer.domElement)
    }
  }, [])

  const description = analyse
    ? `Vent de ${degresVersCardinal(directionDeg)} à ${Math.round(ventNoeuds)} nœuds, rafales ${Math.round(rafalesNoeuds)}, ${analyse.label} sur ce spot`
    : `Vent de ${degresVersCardinal(directionDeg)} à ${Math.round(ventNoeuds)} nœuds. Orientation du littoral inconnue ici.`

  return (
    <div className="halo-cadran relative mx-auto aspect-square w-full max-w-[16rem] sm:max-w-[19rem]">
      <div ref={conteneurRef} className="h-full w-full" role="img" aria-label={description} />

      {/* Points cardinaux, fixes : ils ne tournent pas avec le spot */}
      {(['N', 'E', 'S', 'O'] as const).map((point, i) => {
        const pos = [
          { top: '1%', left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', right: '2%', transform: 'translateY(-50%)' },
          { bottom: '1%', left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', left: '2%', transform: 'translateY(-50%)' },
        ][i]
        return (
          <span
            key={point}
            className="pointer-events-none absolute font-mono text-[11px] font-medium tracking-widest text-muted"
            style={pos}
          >
            {point}
          </span>
        )
      })}
    </div>
  )
}
