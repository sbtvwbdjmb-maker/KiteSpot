import type { DonneesVent } from '../services/weather'
import { degresVersCardinal } from '../services/weather'
import { COULEURS_QUALITE, qualiteVent } from '../lib/vent'

interface Props {
  donnees: DonneesVent | null
  chargement: boolean
  erreur: string | null
  label: string
}

export function WindConditions({ donnees, chargement, erreur, label }: Props) {
  if (chargement) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">
        Chargement des conditions de vent…
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">{erreur}</div>
    )
  }

  if (!donnees) return null

  const { actuel, previsions } = donnees
  const qualite = qualiteVent(actuel.vitesseNoeuds)
  const couleurs = COULEURS_QUALITE[qualite]

  // Les 12 prochaines heures de prévisions, à partir de maintenant
  const heureActuelle = new Date(actuel.heure).getTime()
  const prochaines12h = previsions.filter((p) => new Date(p.heure).getTime() >= heureActuelle).slice(0, 12)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{label}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${couleurs.fond} ${couleurs.texte}`}>
          {qualite === 'bon' ? 'Bon vent' : qualite === 'moyen' ? 'Vent moyen' : 'Pas de vent exploitable'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        {/* Boussole indiquant la direction du vent */}
        <div className="relative h-24 w-24 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
          {['N', 'E', 'S', 'O'].map((point, i) => (
            <span
              key={point}
              className="absolute text-[10px] font-medium text-slate-400"
              style={{
                top: i === 0 ? '2px' : i === 2 ? undefined : '50%',
                bottom: i === 2 ? '2px' : undefined,
                left: i === 3 ? '2px' : i === 1 ? undefined : '50%',
                right: i === 1 ? '2px' : undefined,
                transform: i === 0 || i === 2 ? 'translateX(-50%)' : 'translateY(-50%)',
              }}
            >
              {point}
            </span>
          ))}
          {/* Flèche pointant dans la direction où souffle le vent (sens du flux, donc +180° par rapport à la provenance météo) */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform"
            style={{ transform: `rotate(${actuel.directionDeg + 180}deg)` }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L18 16 L12 12 L6 16 Z" fill="#0369a1" />
            </svg>
          </div>
        </div>

        <div className="flex gap-6">
          <div>
            <p className="text-3xl font-bold text-slate-900">{Math.round(actuel.vitesseNoeuds)}</p>
            <p className="text-xs text-slate-400">nœuds moyen</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-500">{Math.round(actuel.rafalesNoeuds)}</p>
            <p className="text-xs text-slate-400">nœuds rafales</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-500">
              {degresVersCardinal(actuel.directionDeg)}
            </p>
            <p className="text-xs text-slate-400">{Math.round(actuel.directionDeg)}°</p>
          </div>
        </div>
      </div>

      {prochaines12h.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Prévisions 12h
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {prochaines12h.map((p) => {
              const q = qualiteVent(p.vitesseNoeuds)
              const c = COULEURS_QUALITE[q]
              return (
                <div key={p.heure} className="flex shrink-0 flex-col items-center gap-1">
                  <span className="text-[11px] text-slate-400">
                    {new Date(p.heure).toLocaleTimeString('fr-FR', { hour: '2-digit' })}
                  </span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${c.fond} ${c.texte}`}>
                    {Math.round(p.vitesseNoeuds)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
