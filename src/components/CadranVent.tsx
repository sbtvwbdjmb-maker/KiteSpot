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

const C = 110
const R_DISQUE = 82
const R_RIM = 98
const LARGEUR_PLAGE = 9

/**
 * Le cadran de KiteSpot : une rose des vents qui porte le trait de côte du
 * spot, avec sa bande de sable, la mer d'un côté et la terre de l'autre.
 * On voit immédiatement si le vent pousse vers la plage ou vers le large.
 *
 * Aucun texte à l'intérieur : les valeurs chiffrées sont déjà lues dans le
 * bandeau, et les superposer ici brouillait la lecture du dessin.
 */
export function CadranVent({
  directionDeg,
  orientationLittoral,
  ventNoeuds,
  rafalesNoeuds,
  analyse,
  directionHouleDeg = null,
}: Props) {
  const couleur = !analyse
    ? 'var(--color-muted)'
    : analyse.score >= 0.8
      ? 'var(--color-go)'
      : analyse.score >= 0.45
        ? 'var(--color-warn)'
        : 'var(--color-stop)'

  const description = analyse
    ? `Vent de ${degresVersCardinal(directionDeg)} à ${Math.round(ventNoeuds)} nœuds, rafales ${Math.round(rafalesNoeuds)}, ${analyse.label} sur ce spot`
    : `Vent de ${degresVersCardinal(directionDeg)} à ${Math.round(ventNoeuds)} nœuds. Orientation du littoral inconnue ici.`

  return (
    <div className="halo-cadran relative mx-auto aspect-square w-full max-w-[16rem] sm:max-w-[19rem]">
      <svg viewBox="0 0 220 220" className="h-full w-full" role="img" aria-label={description}>
        <defs>
          <clipPath id="disque">
            <circle cx={C} cy={C} r={R_DISQUE} />
          </clipPath>

          {/* Dégradé de profondeur : l'eau s'assombrit vers le large */}
          <linearGradient id="profondeur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#03202e" />
            <stop offset="70%" stopColor="#0a3a4d" />
            <stop offset="100%" stopColor="#0e4a5e" />
          </linearGradient>

          {/* Houle de surface, plus serrée près du bord */}
          <pattern id="houle" width="14" height="9" patternUnits="userSpaceOnUse">
            <path
              d="M0 7 Q3.5 3.6 7 7 T14 7"
              fill="none"
              stroke="#5fb6d4"
              strokeWidth="0.7"
              opacity="0.22"
            />
          </pattern>

          {/* Halo diffus derrière le disque, dans la couleur du verdict */}
          <radialGradient id="halo">
            <stop offset="55%" stopColor={couleur} stopOpacity="0" />
            <stop offset="100%" stopColor={couleur} stopOpacity="0.16" />
          </radialGradient>
        </defs>

        <circle cx={C} cy={C} r={R_RIM} fill="url(#halo)" />

        {/* Le paysage, pivoté selon l'orientation réelle du littoral */}
        {orientationLittoral !== null ? (
          <g
            clipPath="url(#disque)"
            className="transition-cadran"
            style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${orientationLittoral}deg)` }}
          >
            {/* Mer */}
            <rect x={C - R_DISQUE} y={C - R_DISQUE} width={R_DISQUE * 2} height={R_DISQUE} fill="url(#profondeur)" />
            <rect x={C - R_DISQUE} y={C - R_DISQUE} width={R_DISQUE * 2} height={R_DISQUE} fill="url(#houle)" />

            {/* Terre */}
            <rect x={C - R_DISQUE} y={C} width={R_DISQUE * 2} height={R_DISQUE} fill="#16241c" />

            {/* Bande de sable le long du rivage */}
            <rect x={C - R_DISQUE} y={C} width={R_DISQUE * 2} height={LARGEUR_PLAGE} fill="#c9ad7a" opacity="0.55" />
            <rect
              x={C - R_DISQUE}
              y={C + LARGEUR_PLAGE}
              width={R_DISQUE * 2}
              height={4}
              fill="#8a7550"
              opacity="0.35"
            />

            {/* Écume : la ligne de rivage elle-même */}
            <line
              x1={C - R_DISQUE}
              y1={C}
              x2={C + R_DISQUE}
              y2={C}
              stroke="#eaf7fb"
              strokeWidth="1.4"
              opacity="0.55"
            />
          </g>
        ) : (
          <circle cx={C} cy={C} r={R_DISQUE} fill="url(#profondeur)" opacity="0.6" />
        )}

        <circle cx={C} cy={C} r={R_DISQUE} fill="none" stroke="var(--color-line)" strokeWidth="1" />

        {/* Couronne graduée : trait long tous les 30°, fin tous les 10° */}
        {Array.from({ length: 36 }, (_, i) => {
          const majeur = i % 3 === 0
          const a = (i * 10 * Math.PI) / 180
          const r1 = R_RIM - (majeur ? 9 : 4)
          return (
            <line
              key={i}
              x1={C + r1 * Math.sin(a)}
              y1={C - r1 * Math.cos(a)}
              x2={C + R_RIM * Math.sin(a)}
              y2={C - R_RIM * Math.cos(a)}
              stroke="var(--color-dim)"
              strokeWidth={majeur ? 1.3 : 0.8}
              opacity={majeur ? 0.85 : 0.35}
            />
          )
        })}

        {/* Houle : deux crêtes bleues qui pointent vers sa provenance.
            Distinctes de l'aiguille de vent par la forme et la couleur. */}
        {directionHouleDeg !== null && (
          <g
            className="transition-cadran"
            style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${directionHouleDeg}deg)` }}
          >
            <path
              d={`M${C - 15} ${C - 76} Q${C} ${C - 66} ${C + 15} ${C - 76}`}
              fill="none"
              stroke="#5fb6d4"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d={`M${C - 11} ${C - 64} Q${C} ${C - 55} ${C + 11} ${C - 64}`}
              fill="none"
              stroke="#5fb6d4"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.55"
            />
          </g>
        )}

        {/* Aiguille du vent : elle pointe dans le sens où le vent pousse */}
        <g
          className="transition-cadran"
          style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${directionDeg}deg)` }}
        >
          <line
            x1={C}
            y1={C - 52}
            x2={C}
            y2={C + 34}
            stroke={couleur}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d={`M${C} ${C + 46} L${C - 9} ${C + 26} L${C} ${C + 31} L${C + 9} ${C + 26} Z`}
            fill={couleur}
          />
          <circle cx={C} cy={C - 52} r="3.5" fill={couleur} opacity="0.75" />
        </g>

        <circle cx={C} cy={C} r="3" fill="var(--color-foam)" opacity="0.55" />
      </svg>

      {/* Points cardinaux, fixes : ils ne tournent pas avec le spot */}
      {(['N', 'E', 'S', 'O'] as const).map((point, i) => {
        const pos = [
          { top: '-4%', left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', right: '-4%', transform: 'translateY(-50%)' },
          { bottom: '-4%', left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', left: '-4%', transform: 'translateY(-50%)' },
        ][i]
        return (
          <span
            key={point}
            className="absolute font-mono text-[11px] tracking-widest text-muted"
            style={pos}
          >
            {point}
          </span>
        )
      })}
    </div>
  )
}
