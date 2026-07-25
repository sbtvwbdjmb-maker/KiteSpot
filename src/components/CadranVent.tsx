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
}

const C = 110 // centre
const R_DISQUE = 82
const R_RIM = 96

/**
 * Le cadran de KiteSpot : au lieu d'afficher une direction brute, il dessine
 * le trait de côte du spot et la flèche du vent par-dessus. On voit
 * immédiatement si le vent pousse vers la plage ou vers le large — c'est
 * l'interprétation qu'on doit normalement faire de tête devant une rose des vents.
 */
export function CadranVent({
  directionDeg,
  orientationLittoral,
  ventNoeuds,
  rafalesNoeuds,
  analyse,
}: Props) {
  // Sans analyse de direction, la flèche reste neutre : aucune couleur ne doit
  // laisser croire qu'on a jugé une orientation qu'on ne connaît pas.
  const couleur = !analyse
    ? 'var(--color-muted)'
    : analyse.score >= 0.8
      ? 'var(--color-go)'
      : analyse.score >= 0.45
        ? 'var(--color-warn)'
        : 'var(--color-stop)'

  const description = analyse
    ? `Vent de ${degresVersCardinal(directionDeg)} à ${Math.round(ventNoeuds)} nœuds, ${analyse.label} sur ce spot`
    : `Vent de ${degresVersCardinal(directionDeg)} à ${Math.round(ventNoeuds)} nœuds. Orientation du littoral inconnue ici.`

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[15rem] sm:max-w-[19rem]">
      <svg viewBox="0 0 220 220" className="h-full w-full" role="img" aria-label={description}>
        <defs>
          <clipPath id="disque">
            <circle cx={C} cy={C} r={R_DISQUE} />
          </clipPath>
          {/* Texture d'eau : de fines lignes horizontales dans la moitié « mer » */}
          <pattern id="houle" width="10" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 6 Q2.5 3.4 5 6 T10 6" fill="none" stroke="#1d5a6f" strokeWidth="0.8" opacity="0.35" />
          </pattern>
          <radialGradient id="halo">
            <stop offset="65%" stopColor={couleur} stopOpacity="0" />
            <stop offset="100%" stopColor={couleur} stopOpacity="0.13" />
          </radialGradient>
        </defs>

        {/* Terre et mer, pivotés selon l'orientation réelle du littoral.
            Quand elle est inconnue, on ne dessine pas de côte : le cadran
            redevient une simple rose des vents. */}
        {orientationLittoral !== null ? (
          <g
            clipPath="url(#disque)"
            className="transition-cadran"
            style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${orientationLittoral}deg)` }}
          >
            <rect x={C - R_DISQUE} y={C - R_DISQUE} width={R_DISQUE * 2} height={R_DISQUE} fill="var(--color-sea)" />
            <rect x={C - R_DISQUE} y={C - R_DISQUE} width={R_DISQUE * 2} height={R_DISQUE} fill="url(#houle)" />
            <rect x={C - R_DISQUE} y={C} width={R_DISQUE * 2} height={R_DISQUE} fill="var(--color-land)" />
            <line x1={C - R_DISQUE} y1={C} x2={C + R_DISQUE} y2={C} stroke="#3d8f7a" strokeWidth="1.25" opacity="0.6" />
          </g>
        ) : (
          <circle cx={C} cy={C} r={R_DISQUE} fill="var(--color-sea)" opacity="0.5" />
        )}

        <circle cx={C} cy={C} r={R_DISQUE} fill="url(#halo)" />
        <circle cx={C} cy={C} r={R_DISQUE} fill="none" stroke="var(--color-line)" strokeWidth="1" />
        <circle cx={C} cy={C} r={R_RIM} fill="none" stroke="var(--color-line)" strokeWidth="1" opacity="0.5" />

        {/* Graduations tous les 30° */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180
          const r1 = R_RIM - 5
          const r2 = R_RIM
          return (
            <line
              key={i}
              x1={C + r1 * Math.sin(a)}
              y1={C - r1 * Math.cos(a)}
              x2={C + r2 * Math.sin(a)}
              y2={C - r2 * Math.cos(a)}
              stroke="var(--color-dim)"
              strokeWidth="1"
              opacity={i % 3 === 0 ? 0.9 : 0.4}
            />
          )
        })}

        {/* Flèche du vent : elle pointe dans le sens où le vent pousse.
            Elle reste sur l'anneau extérieur pour ne pas masquer la valeur centrale. */}
        <g
          className="transition-cadran"
          style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${directionDeg}deg)` }}
        >
          <line x1={C} y1={C - 88} x2={C} y2={C - 58} stroke={couleur} strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M${C} ${C - 46} L${C - 8.5} ${C - 63} L${C + 8.5} ${C - 63} Z`} fill={couleur} />
        </g>

        <circle cx={C} cy={C} r="4" fill="var(--color-foam)" opacity="0.5" />
      </svg>

      {/* Points cardinaux, fixes : ils ne tournent pas avec le spot */}
      {(['N', 'E', 'S', 'O'] as const).map((point, i) => {
        const pos = [
          { top: '-2%', left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', right: '-2%', transform: 'translateY(-50%)' },
          { bottom: '-2%', left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', left: '-2%', transform: 'translateY(-50%)' },
        ][i]
        return (
          <span
            key={point}
            className="absolute font-mono text-[10px] tracking-widest text-dim"
            style={pos}
          >
            {point}
          </span>
        )
      })}

      {/* Lecture centrale : la valeur mesurée, en mono */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="tabular font-mono text-[3.25rem] leading-none font-medium text-foam">
          {Math.round(ventNoeuds)}
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted">NŒUDS</span>
        <span className="tabular mt-1 font-mono text-[11px] text-dim">
          rafales {Math.round(rafalesNoeuds)}
        </span>
      </div>
    </div>
  )
}
