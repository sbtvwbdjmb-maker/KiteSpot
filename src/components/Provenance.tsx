import type { Lieu } from '../types/lieu'

interface Props {
  lieu: Lieu
  fraicheur: string | null
  eauDisponible: boolean
  chargement: boolean
  onRafraichir: () => void
  onCorrigerOrientation: (orientation: number) => void
}

const LIBELLES_ORIENTATION: Record<Lieu['sourceOrientation'], string> = {
  curatee: 'Orientation du littoral vérifiée à la main',
  estimee: 'Orientation du littoral déduite du relief (estimation)',
  manuelle: 'Orientation du littoral que tu as corrigée',
  inconnue: 'Orientation du littoral indéterminée ici',
}

/**
 * Sépare explicitement mesuré / calculé / estimé, et laisse corriger
 * l'orientation quand elle n'est qu'estimée.
 */
export function Provenance({
  lieu,
  fraicheur,
  eauDisponible,
  chargement,
  onRafraichir,
  onCorrigerOrientation,
}: Props) {
  const ajustable = lieu.sourceOrientation === 'estimee' || lieu.sourceOrientation === 'manuelle' || lieu.sourceOrientation === 'inconnue'

  return (
    <section className="rounded-2xl border border-line/60 bg-surface/25 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted">SOURCES</h3>
        <button
          type="button"
          onClick={onRafraichir}
          disabled={chargement}
          className="font-mono text-[11px] text-dim transition-colors hover:text-foam disabled:opacity-50"
        >
          {chargement ? 'actualisation…' : '↻ actualiser'}
        </button>
      </div>

      <dl className="space-y-2 text-[13px] leading-snug">
        <Ligne
          titre="Météo et vent"
          detail={`Open-Meteo — vent moyen, rafales, direction, température, précipitations, nuages, soleil.${
            eauDisponible ? ' Température de l’eau et houle via son API marine.' : ''
          }`}
        />
        {!eauDisponible && (
          <Ligne titre="Température de l’eau" detail="Non couverte sur ce plan d’eau : rien n’est affiché." />
        )}
        <Ligne titre="Recherche de lieux" detail="Photon — données © contributeurs OpenStreetMap." />
        <Ligne
          titre="Calculé par KiteSpot"
          detail="Direction relative au littoral, régularité, score par critère, note globale, meilleur créneau."
        />
        <Ligne
          titre="Estimé par KiteSpot"
          detail="La taille de voile est indicative, à partir de ton poids, ton niveau et le vent."
        />
      </dl>

      <div className="mt-4 border-t border-line/60 pt-3">
        <p className="text-[12px] text-muted">
          {LIBELLES_ORIENTATION[lieu.sourceOrientation]}
          {lieu.orientation !== null && (
            <span className="tabular ml-1 font-mono text-dim">· cap {lieu.orientation}°</span>
          )}
        </p>

        {ajustable && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[12px] text-dim">
              {lieu.orientation === null
                ? 'Tu connais le spot ? Indique la direction du large pour activer l’analyse de direction.'
                : 'Ajuste si tu connais mieux le spot que le relief.'}
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={355}
                step={5}
                value={lieu.orientation ?? 270}
                onChange={(e) => onCorrigerOrientation(Number(e.target.value))}
                className="flex-1 accent-[var(--verdict)]"
              />
              <span className="tabular w-12 shrink-0 text-right font-mono text-[13px] text-foam">
                {lieu.orientation ?? 270}°
              </span>
            </div>
          </label>
        )}
      </div>

      {fraicheur && (
        <p className="tabular mt-4 font-mono text-[11px] text-dim/70">Mis à jour {fraicheur}</p>
      )}
    </section>
  )
}

function Ligne({ titre, detail }: { titre: string; detail: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] text-foam/70">{titre}</dt>
      <dd className="text-dim">{detail}</dd>
    </div>
  )
}
