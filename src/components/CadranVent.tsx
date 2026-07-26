import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { AnalyseDirection } from '../lib/direction'
import { degresVersCardinal } from '../lib/direction'
import type { Sport } from '../lib/sport'

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
  /** décide l'ambiance lumineuse : le cadran s'accorde au fond de la page */
  sport: Sport
}

/** Inclinaison du plateau : le disque est couché en perspective (≈ 53°). */
const INCLINAISON = -0.93

/** Épaisseur du palet qui porte le paysage. */
const EPAISSEUR = 0.2

/** Rayon du diorama, à l'intérieur de la couronne. */
const RAYON = 0.965

/**
 * Ambiance par sport. Le fond de la page est une photo de coucher de soleil doré
 * en kite, une vague bleue en surf : le diorama s'éclaire de la même lumière,
 * sinon le cadran flotte au-dessus de la photo comme une vignette étrangère.
 */
const AMBIANCES: Record<
  Sport,
  {
    ciel: [string, string, string, string]
    lumiere: number
    intensite: number
    position: [number, number, number]
    ambiante: number
    palette: {
      merClair: string
      merFonce: string
      sable: string
      sableFonce: string
      terre: string
      terreFonce: string
      ecume: string
    }
  }
> = {
  // Coucher de soleil : soleil rasant et chaud, mer sombre piquée d'or
  kite: {
    ciel: ['#2d4d74', '#8f7fa0', '#ffc98a', '#5a4a38'],
    lumiere: 0xffc287,
    intensite: 1.35,
    position: [1.5, 0.5, 1.3],
    ambiante: 0.5,
    palette: {
      merClair: '#6f92aa',
      merFonce: '#22405c',
      sable: '#e3bf93',
      sableFonce: '#b18f64',
      terre: '#8a8a68',
      terreFonce: '#585a46',
      ecume: '#ffdfb4',
    },
  },
  // Plein jour marin : lumière haute et neutre, eau turquoise
  surf: {
    ciel: ['#3f7fb8', '#8fc0dd', '#dcecf5', '#2c5b74'],
    lumiere: 0xffffff,
    intensite: 1.5,
    position: [0.6, 1.5, 1.2],
    ambiante: 0.4,
    palette: {
      merClair: '#7fcbe4',
      merFonce: '#16688f',
      sable: '#ecd9ab',
      sableFonce: '#d4bb87',
      terre: '#b7c79a',
      terreFonce: '#93a878',
      ecume: '#f4fbfd',
    },
  },
}

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
 * Disque en grille polaire : des anneaux concentriques, assez denses pour que le
 * relief se sculpte proprement. Le disque de three.js ne conviendrait pas — ses
 * triangles rayonnent tous du centre, sans quoi déplacer les sommets.
 */
function geometrieDisque(rayon: number, anneaux: number, segments: number) {
  const positions: number[] = []
  const normales: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= anneaux; i++) {
    // Anneaux resserrés vers le bord : c'est là que la silhouette se lit
    const r = rayon * Math.pow(i / anneaux, 0.85)
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2
      positions.push(Math.cos(a) * r, Math.sin(a) * r, 0)
      normales.push(0, 0, 1)
    }
  }

  const parAnneau = segments + 1
  for (let i = 0; i < anneaux; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * parAnneau + j
      const b = a + parAnneau
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3))
  geo.setIndex(indices)
  return geo
}

/**
 * Ciel du sport, en panorama, servant de source de reflets. Peint au canvas :
 * quatre bandes (zénith, ciel haut, horizon, sol) fondues verticalement, ce qui
 * suffit à donner à l'eau et au métal la couleur de la lumière ambiante.
 */
function textureCiel(couleurs: [string, string, string, string]) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
    grad.addColorStop(0, couleurs[0])
    grad.addColorStop(0.42, couleurs[1])
    grad.addColorStop(0.52, couleurs[2])
    grad.addColorStop(1, couleurs[3])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Relief et teintes du diorama, partagés par le vertex et le fragment shader. */
const GLSL_PAYSAGE = /* glsl */ `
  uniform float uTime;
  uniform float uHouleForce;
  varying vec2 vP;
  varying float vH;

  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=0.5;} return v; }

  const float PLAGE = 0.075;
  const float K_HOULE = 9.0;

  // Cloche de haut-fond : quasi plate au large, gonfle fort en approchant du
  // bord, puis retombe à zéro pile à la plage (elle y cède la place au
  // ressac). Resserrée : peu de trains d'onde à la fois, pour qu'une seule
  // crête domine nettement plutôt qu'un motif répété. Partagée par la hauteur
  // et par le resserrement horizontal ci-dessous — les deux doivent grossir
  // au même endroit.
  float ampleurHoule(vec2 p){
    float versLarge = smoothstep(PLAGE, PLAGE + 0.08, p.y);
    float creuxLarge = 1.0 - smoothstep(PLAGE + 0.10, PLAGE + 0.42, p.y);
    return pow(versLarge * creuxLarge, 1.4);
  }
  float thetaHoule(vec2 p){
    float phase = (fbm(vec2(-p.x*1.7, p.y*1.4 - uTime*0.07)) - 0.5) * 1.6;
    return p.y*K_HOULE + phase + uTime*1.05;
  }

  /**
   * Altitude du terrain en un point du plateau. La mer ondule et enfle vers le
   * large, la plage reste plate, la terre se bombe en dune. Tout est modelé, plus
   * rien n'est peint en trompe-l'œil.
   */
  float hauteurPaysage(vec2 p){
    float y = p.y;
    float h = 0.0;

    // Mer : une houle qui enfle en s'approchant du rivage puis s'effondre dans
    // la zone de déferlement — comme une vraie vague qui se forme, pas une
    // ondulation répétée uniforme. Basse fréquence : le maillage (anneaux
    // concentriques) la capte sans la trahir en marches d'escalier ; toute
    // finesse supplémentaire reste peinte au fragment, jamais sculptée.
    //
    // La houle marche vers la plage (y décroissant), légèrement de biais vers
    // la droite de l'écran : tous les trains d'onde partagent le même sens de
    // propagation (temps et obliquité en x cohérents) pour rester crédibles.
    float mer = smoothstep(PLAGE, PLAGE + 0.10, y);
    float ampleur = ampleurHoule(p);
    float theta = thetaHoule(p);
    // Onde de Stokes poussée à l'ordre 3 : crête haute et pointue, creux large
    // et plat — vraiment la silhouette d'une vague qui se redresse, pas une
    // sinusoïde symétrique.
    float onde = cos(theta) + 0.5*cos(2.0*theta - 0.6) + 0.14*cos(3.0*theta - 1.0);
    // Elle grossit franchement en mûrissant (ampleur → 1) : un simple clapot
    // au large, une vraie paroi d'eau juste avant de casser.
    float hauteurCrete = mix(0.016, 0.095, ampleur);
    h += mer * onde * hauteurCrete * uHouleForce;

    float ridule = sin(y*29.0 - p.x*2.8 + uTime*2.0) * 0.006;
    h += mer * ridule * uHouleForce;

    // Ressac : la crête se redresse une dernière fois, haute et raide, juste
    // avant de casser sur le sable.
    float barre = smoothstep(0.05, 0.0, abs(y - PLAGE - 0.035));
    h += barre * 0.030 * (0.65 + 0.35 * sin(-p.x*13.0 - uTime*3.0)) * uHouleForce;

    // Terre : dune qui monte vers l'extérieur, bosselée
    float terre = smoothstep(-PLAGE, -PLAGE - 0.12, y);
    float dune = smoothstep(0.0, 0.62, -y - PLAGE);
    h += terre * (dune * 0.115 + (fbm(p*5.5) - 0.5) * 0.030);

    // Le bord du plateau retombe : le diorama ne déborde pas de sa couronne
    h *= 1.0 - smoothstep(0.86, 1.0, length(p));
    return h;
  }

  /**
   * Déplacement horizontal (façon vague de Gerstner) : les points du maillage
   * se resserrent juste avant la crête et s'écartent dans le creux. C'est ce
   * resserrement géométrique — pas seulement l'altitude — qui fait qu'une
   * vague semble se redresser d'un coup au lieu de simplement gonfler : la
   * silhouette elle-même devient pointue, plus seulement la lumière dessus.
   */
  float resserrementHoule(vec2 p){
    return -(0.62 / K_HOULE) * ampleurHoule(p) * sin(thetaHoule(p));
  }

  /**
   * Normale du relief, par différences finies sur la fonction d'altitude.
   *
   * La houle est désormais basse fréquence (le maillage la capte proprement),
   * donc l'ombrage peut suivre le vrai relief sans risquer l'aliasing d'avant :
   * chaque crête reçoit sa propre lumière et sa propre ombre, comme un vrai
   * volume plutôt qu'un aplat peint.
   */
  vec3 normaleRelief(vec2 p){
    float e = 0.010;
    float h  = hauteurPaysage(p);
    float hx = hauteurPaysage(p + vec2(e, 0.0));
    float hy = hauteurPaysage(p + vec2(0.0, e));
    return normalize(vec3(-(hx - h)/e, -(hy - h)/e, 1.0));
  }
`

/**
 * Le cadran de KiteSpot : un diorama du spot en volume (three.js).
 *
 * Un palet circulaire couché en perspective porte une maquette du spot — la mer
 * qui ondule d'un côté, la dune de l'autre, la bande de sable entre les deux —
 * sculptée en vrai relief et non peinte à plat. Le plateau pivote selon
 * l'orientation réelle du littoral, si bien qu'on voit d'un coup d'œil si le vent
 * pousse vers la plage ou vers le large. Une aiguille volumétrique, dans la
 * couleur du verdict, indique le sens où le vent pousse et projette son ombre sur
 * l'eau ; deux crêtes marquent la provenance de la houle en surf.
 *
 * L'éclairage suit le sport : soleil rasant et doré en kite, plein jour marin en
 * surf, avec le ciel correspondant reflété dans l'eau et le métal — le cadran
 * appartient ainsi à la photo de fond au lieu de flotter dessus.
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
  sport,
}: Props) {
  const conteneurRef = useRef<HTMLDivElement>(null)

  // Props relues à chaque image, sans jamais relancer la scène
  const props = useRef({ directionDeg, orientationLittoral, analyse, directionHouleDeg, sport })
  props.current = { directionDeg, orientationLittoral, analyse, directionHouleDeg, sport }

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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    // Ombres douces : c'est l'indice de volume le plus fort du cadran
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    conteneur.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0.02, 3.75)
    camera.lookAt(0, 0.04, 0)

    // Un ciel par sport, précalculé : l'eau et le métal y prennent leurs reflets
    const pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()
    const ciels = {} as Record<Sport, THREE.WebGLRenderTarget>
    ;(Object.keys(AMBIANCES) as Sport[]).forEach((s) => {
      const tex = textureCiel(AMBIANCES[s].ciel)
      ciels[s] = pmrem.fromEquirectangular(tex)
      tex.dispose()
    })
    pmrem.dispose()
    scene.environment = ciels[sport].texture
    // Assez de reflet pour que l'eau et le métal prennent la lumière du sport,
    // pas assez pour délaver le paysage en surface laiteuse
    scene.environmentIntensity = 0.4

    const ambiante = new THREE.AmbientLight(0xffffff, AMBIANCES[sport].ambiante)
    scene.add(ambiante)

    const soleil = new THREE.DirectionalLight(AMBIANCES[sport].lumiere, AMBIANCES[sport].intensite)
    soleil.position.set(...AMBIANCES[sport].position)
    soleil.castShadow = true
    soleil.shadow.mapSize.set(1024, 1024)
    soleil.shadow.camera.near = 0.5
    soleil.shadow.camera.far = 9
    soleil.shadow.camera.left = -1.6
    soleil.shadow.camera.right = 1.6
    soleil.shadow.camera.top = 1.6
    soleil.shadow.camera.bottom = -1.6
    soleil.shadow.bias = -0.0015
    soleil.shadow.radius = 4
    scene.add(soleil)

    // Contre-jour froid : détache le rebord du fond, quel que soit le sport
    const contre = new THREE.DirectionalLight(0xdfe6ee, 0.35)
    contre.position.set(-0.9, -0.5, 0.8)
    scene.add(contre)

    // Racine inclinée : tout le cadran est couché en perspective
    const racine = new THREE.Group()
    racine.rotation.x = INCLINAISON
    scene.add(racine)

    // --- Corps du cadran : un vrai palet épais sous le diorama --------------
    // Solide de révolution : sa rotation est sans effet, on le laisse fixe.
    const corps = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 0.955, EPAISSEUR, 96, 1, false),
      new THREE.MeshStandardMaterial({ color: 0xeef2f6, metalness: 0.25, roughness: 0.5 }),
    )
    corps.rotation.x = Math.PI / 2 // axe du cylindre aligné sur la normale du plateau
    corps.position.z = -EPAISSEUR / 2 // face supérieure ramenée en z = 0
    corps.castShadow = true
    corps.receiveShadow = true
    racine.add(corps)

    // --- Diorama : le spot en relief, un seul maillage sculpté --------------
    const paysage = new THREE.Group()
    paysage.position.z = 0.002
    racine.add(paysage)

    const P = AMBIANCES[sport].palette
    const uPaysage = {
      uTime: { value: 0 },
      uHouleForce: { value: 1 },
      uMerClair: { value: new THREE.Color(P.merClair) },
      uMerFonce: { value: new THREE.Color(P.merFonce) },
      uSable: { value: new THREE.Color(P.sable) },
      uSableFonce: { value: new THREE.Color(P.sableFonce) },
      uTerre: { value: new THREE.Color(P.terre) },
      uTerreFonce: { value: new THREE.Color(P.terreFonce) },
      uEcume: { value: new THREE.Color(P.ecume) },
    }

    // Un MeshStandardMaterial détourné : on garde tout l'éclairage physique de
    // three (ombres reçues, reflets du ciel) et on n'y greffe que le relief et
    // les teintes du spot.
    // Un peu de ciel reflété dans l'eau : c'est ce qui ancre le cadran dans
    // l'ambiance du sport (doré au couchant en kite, bleu en surf). Faible
    // dose : le relief est désormais basse fréquence, donc sans risque de
    // repliement, mais l'eau doit rester lisible, pas un miroir.
    const matPaysage = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0, envMapIntensity: 0.35 })
    matPaysage.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uPaysage)

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${GLSL_PAYSAGE}`)
        .replace(
          '#include <beginnormal_vertex>',
          `vec3 objectNormal = normaleRelief(position.xy);`,
        )
        .replace(
          '#include <begin_vertex>',
          `
            vP = position.xy;
            vH = hauteurPaysage(position.xy);
            float resserre = resserrementHoule(position.xy);
            vec3 transformed = vec3(position.x, position.y + resserre, position.z + vH);
          `,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `
            #include <common>
            ${GLSL_PAYSAGE}
            uniform vec3 uMerClair, uMerFonce, uSable, uSableFonce, uTerre, uTerreFonce, uEcume;
          `,
        )
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          `
            float y = vP.y;
            vec3 col;

            // Mer : bas-fond clair près du rivage, sombre vers le large
            vec3 mer = mix(uMerClair, uMerFonce, smoothstep(PLAGE, 1.0, y));

            // Hauteur exacte au pixel, indépendante du maillage (lui reste
            // grossier pour la géométrie/l'ombrage) : l'écume peut donc suivre
            // la vraie crête sans jamais la trahir en blocs.
            float hIci = hauteurPaysage(vP);
            // Un échantillon un peu plus au large : la différence donne la pente
            // de la face de la vague, pas seulement son altitude. L'écume se
            // concentre sur cette face raide, près du sommet — jamais étalée
            // sur toute la mer, comme une vraie crête qui déferle.
            float hAvant = hauteurPaysage(vP + vec2(0.0, 0.020));
            float pente = hAvant - hIci;
            // Filet fin, pile sur le sommet de la crête — c'est le relief (la
            // silhouette resserrée, l'ombre du creux) qui doit se voir en
            // premier, l'écume n'est plus qu'un accent, pas la vague entière.
            float creteZone = smoothstep(0.060, 0.088, hIci) * smoothstep(-0.004, 0.018, pente);
            float paquet = smoothstep(0.30, 0.70, noise(vec2(-vP.x*4.0, vP.y*4.5 + uTime*0.15)));
            float moutons = creteZone * mix(0.6, 1.0, paquet);
            mer = mix(mer, uEcume, moutons * 0.4);
            // Le creux des vagues s'assombrit nettement : c'est ce contour qui
            // fait lire le volume même sous une lumière plate.
            mer *= 1.0 - (1.0 - smoothstep(-0.088, -0.020, hIci)) * 0.32;

            // Clapot fin : peint au fragment, jamais sculpté dans le maillage — à
            // cette finesse, une ondulation géométrique se replierait en bandes
            // (le maillage polaire n'a pas la résolution pour la suivre). Un
            // fragment shader, lui, n'a pas cette limite : chaque pixel calcule
            // sa propre valeur, donc aucun repliement possible. Même sens de
            // marche que la houle : vers la plage, légèrement vers la droite.
            float clapot = sin(y*70.0 + uTime*1.6 + sin(-vP.x*9.0)*0.8)
                         + 0.5*sin(y*115.0 - vP.x*10.0 + uTime*2.4);
            mer += smoothstep(0.7, 1.0, clapot) * 0.05 * smoothstep(PLAGE, PLAGE + 0.08, y);
            float miroitement = smoothstep(0.6, 1.0, noise(vec2(-vP.x*22.0, y*26.0 + uTime*0.8)));
            mer += miroitement * smoothstep(PLAGE, 0.85, y) * 0.045;

            // Terre : sable exposé près du rivage, touffes d'herbe plus loin à
            // l'intérieur — un vrai dégradé de végétation, pas une teinte plate.
            vec3 terre = mix(uTerre, uTerreFonce, smoothstep(-PLAGE, -1.0, y));
            // Touffes allongées (l'herbe rase des dunes), plus denses en
            // s'éloignant du sable ; le bruit est étiré pour lire comme des
            // brins, pas comme des taches rondes.
            float densiteHerbe = smoothstep(-PLAGE - 0.04, -PLAGE - 0.30, y);
            float touffes = smoothstep(0.48, 0.66, fbm(vP * vec2(10.0, 4.5) + vec2(3.1, 0.0)));
            terre = mix(terre, uTerreFonce * 0.68, touffes * densiteHerbe * 0.6);
            // Grain fin par-dessus, pour casser les à-plats
            terre += (fbm(vP*13.0) - 0.5) * 0.030;

            // Bande de sable, plus foncée là où l'eau la mouille, avec un
            // grain fin (le sable) et quelques débris épars plus sombres.
            vec3 sable = mix(uSable, uSableFonce, smoothstep(0.0, PLAGE, abs(y)));
            sable += (fbm(vP*38.0) - 0.5) * 0.05;
            float debris = smoothstep(0.74, 0.90, noise(vP*34.0 + 11.0));
            sable = mix(sable, sable * 0.6, debris * 0.5);

            if (y > PLAGE) col = mer;
            else if (y < -PLAGE) col = terre;
            else col = sable;

            // Écume mobile sur la ligne de rivage
            float ecume = smoothstep(0.035, 0.0, abs(y - PLAGE));
            ecume *= 0.55 + 0.45 * sin(-vP.x*26.0 - uTime*3.2);
            col = mix(col, uEcume, clamp(ecume, 0.0, 1.0) * 0.85);

            vec4 diffuseColor = vec4( col, opacity );
          `,
        )
        // L'eau est lisse et miroite le ciel ; le sable et la dune restent mats.
        // La face de la crête est encore plus glacée : c'est elle qui accroche
        // le reflet du soleil et vend le volume de la vague.
        .replace(
          '#include <roughnessmap_fragment>',
          `
            float roughnessFactor = mix(0.92, 0.34, smoothstep(PLAGE - 0.02, PLAGE + 0.12, vP.y));
            roughnessFactor -= smoothstep(0.045, 0.085, hIci) * 0.18;
          `,
        )
    }
    const disque = new THREE.Mesh(geometrieDisque(RAYON, 132, 160), matPaysage)
    disque.receiveShadow = true
    paysage.add(disque)

    // --- Couronne fixe : bezel + graduations (ne tourne pas avec le littoral) ---
    const anneau = new THREE.Group()
    racine.add(anneau)

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.05, 28, 180),
      new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.55, roughness: 0.38 }),
    )
    bezel.castShadow = true
    anneau.add(bezel)

    // Gorge intérieure sombre : sépare le rebord du diorama, creuse le relief
    const gorge = new THREE.Mesh(
      new THREE.TorusGeometry(0.962, 0.012, 12, 160),
      new THREE.MeshStandardMaterial({ color: 0x2c3a44, metalness: 0.6, roughness: 0.45 }),
    )
    gorge.position.z = 0.012
    anneau.add(gorge)

    const encre = new THREE.Color(lireVar('--color-dim') || '#8497a3')
    const matTick = new THREE.MeshBasicMaterial({ color: encre, transparent: true, opacity: 0.75 })
    for (let i = 0; i < 36; i++) {
      const majeur = i % 3 === 0
      const long = majeur ? 0.075 : 0.04
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(majeur ? 0.012 : 0.008, long, 0.006),
        matTick,
      )
      const a = (i * 10 * Math.PI) / 180
      const rMoyen = 0.93 - long / 2
      tick.position.set(Math.sin(a) * rMoyen, Math.cos(a) * rMoyen, 0.05)
      tick.rotation.z = -a
      anneau.add(tick)
    }

    // --- Houle : deux crêtes vers la provenance (surf) ---------------------
    const houle = new THREE.Group()
    racine.add(houle)
    const matHoule = new THREE.MeshBasicMaterial({ color: 0x4d9fbd, transparent: true, opacity: 0.7 })
    const crete = (rayon: number, largeur: number, epaisseur: number) => {
      const courbe = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-largeur, rayon, 0.08),
        new THREE.Vector3(0, rayon + 0.09, 0.08),
        new THREE.Vector3(largeur, rayon, 0.08),
      )
      return new THREE.Mesh(new THREE.TubeGeometry(courbe, 24, epaisseur, 8, false), matHoule)
    }
    houle.add(crete(0.66, 0.16, 0.014))
    const crete2 = crete(0.8, 0.12, 0.011)
    ;(crete2.material as THREE.MeshBasicMaterial).opacity = 0.4
    houle.add(crete2)

    // --- Aiguille du vent : flèche volumétrique flottant au-dessus du plateau ---
    const aiguille = new THREE.Group()
    aiguille.position.z = 0.14
    racine.add(aiguille)

    const matAiguille = new THREE.MeshStandardMaterial({
      color: COULEURS.muted.clone(),
      emissive: COULEURS.muted.clone().multiplyScalar(0.15),
      metalness: 0.65,
      roughness: 0.2,
    })

    // Aiguille directionnelle : une seule pointe franche vers où le vent pousse,
    // une courte queue effilée à l'arrière pour l'équilibre visuel — jamais une
    // seconde pointe qui rendrait le sens ambigu.
    const hampe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.019, 0.58, 24), matAiguille)
    hampe.position.y = 0.17
    aiguille.add(hampe)

    const tete = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.2, 28), matAiguille)
    tete.position.y = 0.56
    aiguille.add(tete)

    // Collerette sous la pointe : l'arête accroche la lumière, la flèche s'affine
    const collerette = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.022, 0.022, 24),
      matAiguille,
    )
    collerette.position.y = 0.452
    aiguille.add(collerette)

    const queue = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.004, 0.16, 18), matAiguille)
    queue.position.y = -0.16
    queue.rotation.z = Math.PI
    aiguille.add(queue)

    const moyeu = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xf7fafc, metalness: 0.9, roughness: 0.15 }),
    )
    aiguille.add(moyeu)

    // L'aiguille projette son ombre sur l'eau : le relief se lit d'emblée
    ;[hampe, tete, collerette, queue, moyeu].forEach((m) => (m.castShadow = true))

    // Angles courants, lissés vers la cible (inertie type instrument)
    let angPaysage = capVersRotation(orientationLittoral ?? 0)
    let angAiguille = capVersRotation(directionDeg + 180)
    let angHoule = capVersRotation(directionHouleDeg ?? 0)
    paysage.rotation.z = angPaysage
    aiguille.rotation.z = angAiguille
    houle.rotation.z = angHoule

    // Ambiance courante, glissée vers celle du sport à chaque bascule
    let sportCourant = sport
    const cibleAmbiante = { valeur: AMBIANCES[sport].ambiante }
    const couleurSoleil = new THREE.Color(AMBIANCES[sport].lumiere)

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

      // Bascule de sport : le ciel change net, la lumière et l'eau se fondent
      if (p.sport !== sportCourant) {
        sportCourant = p.sport
        scene.environment = ciels[sportCourant].texture
        const a = AMBIANCES[sportCourant]
        couleurSoleil.set(a.lumiere)
        cibleAmbiante.valeur = a.ambiante
        soleil.position.set(...a.position)
        soleil.intensity = a.intensite
      }
      const pal = AMBIANCES[sportCourant].palette
      const kLent = reduit ? 1 : 1 - Math.exp(-dt * 2)
      soleil.color.lerp(couleurSoleil, kLent)
      ambiante.intensity += (cibleAmbiante.valeur - ambiante.intensity) * kLent
      uPaysage.uMerClair.value.lerp(new THREE.Color(pal.merClair), kLent)
      uPaysage.uMerFonce.value.lerp(new THREE.Color(pal.merFonce), kLent)
      uPaysage.uSable.value.lerp(new THREE.Color(pal.sable), kLent)
      uPaysage.uSableFonce.value.lerp(new THREE.Color(pal.sableFonce), kLent)
      uPaysage.uTerre.value.lerp(new THREE.Color(pal.terre), kLent)
      uPaysage.uTerreFonce.value.lerp(new THREE.Color(pal.terreFonce), kLent)
      uPaysage.uEcume.value.lerp(new THREE.Color(pal.ecume), kLent)

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
      matAiguille.emissive.copy(matAiguille.color).multiplyScalar(0.15)

      if (!reduit) {
        uPaysage.uTime.value += dt
        // Léger flottement de l'aiguille, pour le vivant
        aiguille.position.z = 0.14 + Math.sin(maintenant * 0.0016) * 0.012
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
      Object.values(ciels).forEach((rt) => rt.dispose())
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
