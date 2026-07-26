import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Lieu } from '../types/lieu'
import type { Profil } from '../types/profile'
import type { MeteoSpot } from '../services/weather'
import type { DonneesMarines } from '../services/marine'
import { scoreHorairePourSport, meilleurCreneauSport, type Sport } from '../lib/sport'
import { resumerJours } from '../lib/jours'
import { couleurScore, SEUILS_COULEUR } from '../lib/couleurs'
import { CarrouselDefilant } from '@/components/ui/carrousel-defilant'

interface Props {
  sport: Sport
  meteo: MeteoSpot
  marine: DonneesMarines
  lieu: Lieu
  profil: Profil
  heureSelectionnee: string | null
  onSelectionnerHeure: (heure: string | null) => void
  dateSelectionnee: string
  onSelectionnerDate: (date: string) => void
}

export function Timeline({
  sport,
  meteo,
  marine,
  lieu,
  profil,
  heureSelectionnee,
  onSelectionnerHeure,
  dateSelectionnee,
  onSelectionnerDate,
}: Props) {
  const reduit = useReducedMotion()

  const jours = useMemo(
    () => resumerJours(meteo, marine, lieu, profil, sport),
    [meteo, marine, lieu, profil, sport],
  )

  const jourActif = jours.find((j) => j.date === dateSelectionnee) ?? jours[0]
  const estAujourdhui = jourActif?.date === jours[0]?.date

  // Aujourd'hui on part de l'heure courante ; les autres jours, de la journée entière
  const heures = useMemo(() => {
    if (!jourActif) return []
    const depuis = estAujourdhui ? Date.now() - 3600_000 : 0
    return jourActif.heures
      .filter((h) => new Date(h.heure).getTime() >= depuis)
      .map((h) => ({
        ...h,
        score: scoreHorairePourSport(sport, h, marine, lieu, profil),
      }))
  }, [jourActif, estAujourdhui, sport, marine, lieu, profil])

  const { creneau, raison } = useMemo(() => {
    if (!jourActif) return { creneau: null, raison: 'donnees-manquantes' as const }
    // Pour un jour futur, on cherche le créneau depuis son lever de soleil
    const depart = estAujourdhui ? new Date() : new Date(jourActif.leverSoleil)
    return meilleurCreneauSport(
      sport,
      { ...meteo, previsions: jourActif.heures, coucherSoleil: jourActif.coucherSoleil },
      marine,
      lieu,
      profil,
      depart,
    )
  }, [sport, meteo, marine, lieu, profil, jourActif, estAujourdhui])

  if (!jourActif) return null

  const coucher = new Date(jourActif.coucherSoleil).getTime()
  const lever = new Date(jourActif.leverSoleil).getTime()
  const debutCreneau = creneau ? new Date(creneau.debut).getTime() : null
  const finCreneau = creneau ? new Date(creneau.fin).getTime() : null

  return (
    <section className="verre verre-verdict p-4 sm:p-5">
      {/* Sélecteur de jour */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Jour">
        {jours.map((jour) => {
          const actif = jour.date === jourActif.date
          return (
            <button
              key={jour.date}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => {
                onSelectionnerDate(jour.date)
                onSelectionnerHeure(null)
              }}
              className={`flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-3 py-2 transition-colors ${
                actif
                  ? 'border-transparent bg-foam/[0.07] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.6)]'
                  : 'border-transparent hover:bg-foam/[0.05]'
              }`}
            >
              <span className={`font-mono text-[11px] ${actif ? 'text-foam' : 'text-muted'}`}>
                {jour.label}
              </span>
              <span
                className="h-2 w-6 rounded-full"
                style={{ background: couleurScore(jour.meilleurScore) }}
                title={
                  jour.meilleurScore === null
                    ? 'Données indisponibles'
                    : `Meilleur score ${jour.meilleurScore.toFixed(1)}/10`
                }
              />
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted">
          {estAujourdhui ? 'AUJOURD’HUI' : jourActif.label.toUpperCase()}
        </h3>
        {creneau ? (
          <p className="text-[13px]">
            {/* Même palette que les carrés : le créneau porte sa propre qualité */}
            <span
              className="font-mono text-[11px] tracking-wide"
              style={{ color: couleurScore(creneau.score) }}
            >
              MEILLEUR CRÉNEAU
            </span>{' '}
            <span className="tabular font-mono text-foam">
              {new Date(creneau.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {new Date(new Date(creneau.fin).getTime() + 3600_000).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </p>
        ) : (
          <p
            className="text-[13px]"
            style={{
              color: raison === 'journee-finie' ? 'var(--color-dim)' : 'var(--color-stop)',
            }}
          >
            {raison === 'journee-finie'
              ? 'Journée terminée — regarde demain'
              : raison === 'donnees-manquantes'
                ? 'Données insuffisantes ce jour-là'
                : 'Aucun bon créneau'}
          </p>
        )}
      </div>

      {heures.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-dim">Aucune heure à afficher.</p>
      ) : (
        <CarrouselDefilant largeurFondu={28}>
          {heures.map((h) => {
            const t = new Date(h.heure).getTime()
            const dansCreneau =
              debutCreneau !== null && finCreneau !== null && t >= debutCreneau && t <= finCreneau
            const selectionnee = heureSelectionnee === h.heure
            const nuit = t > coucher || t < lever
            const couleur = couleurScore(h.score)

            return (
              <motion.button
                key={h.heure}
                type="button"
                onClick={() => onSelectionnerHeure(selectionnee ? null : h.heure)}
                aria-pressed={selectionnee}
                aria-label={`${new Date(h.heure).toLocaleTimeString('fr-FR', { hour: '2-digit' })} — ${
                  h.score === null ? 'données indisponibles' : `score ${h.score.toFixed(1)} sur 10`
                }`}
                whileHover={reduit ? undefined : { y: -3 }}
                transition={{ duration: 0.18 }}
                className={`flex w-[3.1rem] shrink-0 flex-col items-center gap-2 rounded-xl border px-1 py-2.5 transition-colors ${
                  selectionnee
                    ? 'border-transparent bg-foam/[0.08] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.6)]'
                    : dansCreneau
                      ? 'border-transparent bg-foam/[0.045]'
                      : 'border-transparent hover:bg-foam/[0.05]'
                } ${nuit ? 'opacity-40' : ''}`}
              >
                <span className="tabular font-mono text-[10px] text-muted">
                  {new Date(h.heure).toLocaleTimeString('fr-FR', { hour: '2-digit' })}
                </span>

                {/* Le carré porte la qualité : sa couleur sort du score calculé */}
                <span
                  className="h-7 w-7 rounded-lg"
                  style={{
                    background: couleur,
                    opacity: h.score === null ? 0.25 : 1,
                  }}
                />

                <span className="tabular font-mono text-[11px] text-foam">
                  {h.score === null ? '—' : h.score.toFixed(1)}
                </span>
              </motion.button>
            )
          })}
        </CarrouselDefilant>
      )}

      {/* Légende : la même échelle pour le kite et le surf */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {SEUILS_COULEUR.map((seuil) => (
          <li key={seuil.cle} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: seuil.variable }} />
            <span className="text-[11px] text-dim">
              {seuil.libelle}
              <span className="tabular ml-1 font-mono opacity-70">
                {seuil.min === 0 ? '< 4' : `${seuil.min}+`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
