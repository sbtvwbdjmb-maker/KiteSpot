interface Props {
  misAJourLe: Date | null
  eauDisponible: boolean
  onRafraichir: () => void
}

/**
 * Distinction explicite entre ce qui est mesuré, ce qui est calculé et ce qui
 * est estimé. La typographie porte déjà la règle (mono = mesuré), ce bloc la nomme.
 */
export function Provenance({ misAJourLe, eauDisponible, onRafraichir }: Props) {
  return (
    <section className="rounded-2xl border border-line/60 bg-surface/25 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted">D’OÙ VIENNENT LES CHIFFRES</h3>
        <button
          type="button"
          onClick={onRafraichir}
          className="font-mono text-[11px] text-dim transition-colors hover:text-foam"
        >
          ↻ actualiser
        </button>
      </div>

      <dl className="space-y-2.5 text-[13px] leading-snug">
        <div>
          <dt className="font-mono text-[11px] text-foam/70">Mesuré — API Open-Meteo</dt>
          <dd className="text-dim">
            Vent moyen, rafales, direction, température, précipitations, nuages, lever et coucher du
            soleil.
            {eauDisponible
              ? ' Température de l’eau et houle via l’API marine.'
              : ' Température de l’eau indisponible sur ce plan d’eau : rien n’est affiché plutôt qu’une valeur inventée.'}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] text-foam/70">Calculé — KiteSpot</dt>
          <dd className="text-dim">
            Orientation du vent par rapport au littoral, régularité déduite du rapport rafales/vent,
            score par critère et note globale, meilleur créneau.
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] text-foam/70">Estimé — KiteSpot</dt>
          <dd className="text-dim">
            La taille de voile est une estimation indicative, à partir de ton poids, de ton niveau et du
            vent. Elle ne remplace ni ton ressenti ni l’avis des locaux. L’orientation du littoral de
            chaque spot est une donnée curatée à la main.
          </dd>
        </div>
      </dl>

      {misAJourLe && (
        <p className="tabular mt-4 font-mono text-[11px] text-dim/70">
          Relevé de {misAJourLe.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </section>
  )
}
