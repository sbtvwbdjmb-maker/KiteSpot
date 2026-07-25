import { useCallback, useEffect, useMemo, useState } from 'react'
import spotsData from './data/spots.json'
import type { Spot } from './types/spot'
import { useProfils } from './hooks/useProfils'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useConditions } from './hooks/useConditions'
import { useApercuSpots } from './hooks/useApercuSpots'
import { useGeolocation } from './hooks/useGeolocation'
import { distanceKm, formaterDistance } from './lib/geo'
import { analyserConditions, meilleurCreneau } from './lib/scoring'
import { construireVerdict } from './lib/verdict'
import { BlocVerdict } from './components/BlocVerdict'
import { Timeline } from './components/Timeline'
import { Criteres } from './components/Criteres'
import { RailSpots } from './components/RailSpots'
import { SelecteurSpot } from './components/SelecteurSpot'
import { PanneauProfil } from './components/PanneauProfil'
import { Provenance } from './components/Provenance'

const SPOTS = spotsData as Spot[]

const COULEUR_TON = {
  go: 'var(--color-go)',
  mitige: 'var(--color-warn)',
  stop: 'var(--color-stop)',
} as const

export default function App() {
  const { profils, profilActif, selectionner, modifier, ajouter, supprimer } = useProfils()
  const [favoris, setFavoris] = useLocalStorage<string[]>('kitespot.favoris.v1', [])
  const [dernierSpotId, setDernierSpotId] = useLocalStorage<string | null>('kitespot.spot.v1', null)

  const [spotActif, setSpotActif] = useState<Spot | null>(
    () => SPOTS.find((s) => s.id === dernierSpotId) ?? null,
  )
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null)
  const [modale, setModale] = useState<'spot' | 'profil' | null>(null)
  const [heureSelectionnee, setHeureSelectionnee] = useState<string | null>(null)
  const [messageGeoloc, setMessageGeoloc] = useState<string | null>(null)

  const { localiser } = useGeolocation()
  const { meteo, marine, chargement, erreur, misAJourLe, rafraichir } = useConditions(spotActif)

  // Distances à vol d'oiseau depuis la position détectée
  const distances = useMemo(() => {
    if (!position) return {}
    const table: Record<string, number> = {}
    for (const spot of SPOTS) table[spot.id] = distanceKm(position.lat, position.lon, spot.lat, spot.lon)
    return table
  }, [position])

  const spotLePlusProche = useCallback((lat: number, lon: number) => {
    return SPOTS.reduce((proche, spot) =>
      distanceKm(lat, lon, spot.lat, spot.lon) < distanceKm(lat, lon, proche.lat, proche.lon)
        ? spot
        : proche,
    )
  }, [])

  const utiliserMaPosition = useCallback(async () => {
    setMessageGeoloc(null)
    try {
      const { lat, lon } = await localiser()
      setPosition({ lat, lon })
      const proche = spotLePlusProche(lat, lon)
      setSpotActif(proche)
      setDernierSpotId(proche.id)
    } catch (e) {
      setMessageGeoloc(e instanceof Error ? e.message : 'Position indisponible')
    }
  }, [localiser, spotLePlusProche, setDernierSpotId])

  // Au chargement : on tente la géolocalisation sans la rendre bloquante.
  // Si un spot était déjà sélectionné, il reste affiché pendant la détection.
  useEffect(() => {
    let annule = false
    void localiser()
      .then(({ lat, lon }) => {
        if (annule) return
        setPosition({ lat, lon })
        setSpotActif((courant) => {
          if (courant) return courant
          const proche = spotLePlusProche(lat, lon)
          setDernierSpotId(proche.id)
          return proche
        })
      })
      .catch((e: Error) => {
        if (!annule) setMessageGeoloc(e.message)
      })
    return () => {
      annule = true
    }
  }, [localiser, spotLePlusProche, setDernierSpotId])

  const choisirSpot = useCallback(
    (spot: Spot) => {
      setSpotActif(spot)
      setDernierSpotId(spot.id)
      setHeureSelectionnee(null)
    },
    [setDernierSpotId],
  )

  const basculerFavori = useCallback(
    (spotId: string) =>
      setFavoris((liste) => (liste.includes(spotId) ? liste.filter((id) => id !== spotId) : [...liste, spotId])),
    [setFavoris],
  )

  // Conditions analysées : soit maintenant, soit l'heure projetée depuis la timeline
  const conditionsAffichees = useMemo(() => {
    if (!meteo) return null
    if (!heureSelectionnee) return meteo.actuel
    return meteo.previsions.find((h) => h.heure === heureSelectionnee) ?? meteo.actuel
  }, [meteo, heureSelectionnee])

  const analyse = useMemo(() => {
    if (!meteo || !spotActif || !conditionsAffichees) return null
    return analyserConditions({ ...meteo, actuel: conditionsAffichees }, marine, spotActif, profilActif)
  }, [meteo, marine, spotActif, profilActif, conditionsAffichees])

  const verdict = useMemo(() => {
    if (!analyse || !spotActif || !conditionsAffichees) return null
    return construireVerdict(analyse, profilActif, spotActif, conditionsAffichees)
  }, [analyse, profilActif, spotActif, conditionsAffichees])

  const creneau = useMemo(() => {
    if (!meteo || !spotActif) return null
    return meilleurCreneau(meteo.previsions, spotActif, profilActif, new Date(), meteo.coucherSoleil)
  }, [meteo, spotActif, profilActif])

  // Les vignettes : favoris d'abord, sinon les spots proches, sinon une
  // sélection du même pays en remontant les plus discrets — jamais de rail vide.
  const { spotsRail, titreRail } = useMemo(() => {
    const favorisSpots = favoris
      .map((id) => SPOTS.find((s) => s.id === id))
      .filter((s): s is Spot => Boolean(s))
    if (favorisSpots.length > 0) return { spotsRail: favorisSpots.slice(0, 8), titreRail: 'MES SPOTS' }

    if (position) {
      return {
        spotsRail: [...SPOTS].sort((a, b) => distances[a.id] - distances[b.id]).slice(0, 6),
        titreRail: 'AUTOUR DE TOI',
      }
    }

    if (spotActif) {
      const memePays = SPOTS.filter((s) => s.country === spotActif.country && s.id !== spotActif.id)
        .sort((a, b) => a.popularite - b.popularite)
        .slice(0, 6)
      return { spotsRail: memePays, titreRail: `À DÉCOUVRIR · ${spotActif.country.toUpperCase()}` }
    }

    return { spotsRail: [] as Spot[], titreRail: '' }
  }, [favoris, position, distances, spotActif])

  const apercus = useApercuSpots(spotsRail, profilActif)

  // La page prend la couleur de la réponse
  useEffect(() => {
    const couleur = verdict ? COULEUR_TON[verdict.ton] : 'var(--color-go)'
    document.documentElement.style.setProperty('--verdict', couleur)
  }, [verdict])

  const distanceSpot = spotActif && position ? distances[spotActif.id] : undefined

  return (
    <div className="relative min-h-screen">
      <div className="ambiance" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-14 sm:px-6">
        {/* Barre : identité, profil, spot */}
        <header className="flex items-center justify-between gap-3 py-4">
          <span className="font-display text-[15px] font-bold tracking-tight text-foam">
            Kite<span style={{ color: 'var(--verdict)' }}>Spot</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModale('profil')}
              className="rounded-full border border-line bg-surface/50 px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-foam"
            >
              {profilActif.nom} · {profilActif.poids} kg
            </button>
            <button
              type="button"
              onClick={() => setModale('spot')}
              className="rounded-full border border-line bg-surface/50 px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-foam"
            >
              Changer de spot
            </button>
          </div>
        </header>

        {spotActif ? (
          <main className="flex flex-1 flex-col gap-8 pt-2">
            {/* Localisation détectée */}
            <div className="monte">
              <p className="font-mono text-[11px] tracking-[0.2em] text-muted">
                {position ? 'SPOT LE PLUS PROCHE' : 'SPOT SÉLECTIONNÉ'}
              </p>
              <h1 className="mt-1.5 font-display text-[clamp(1.5rem,4.5vw,2.1rem)] leading-tight font-bold text-foam">
                {spotActif.name}
              </h1>
              <p className="mt-1 text-[13px] text-muted">
                {spotActif.locality} · {spotActif.country}
                {distanceSpot !== undefined && ` · à ${formaterDistance(distanceSpot)}`}
              </p>
            </div>

            {chargement && !meteo && (
              <p className="pulse-douce py-16 text-center font-mono text-[13px] text-muted">
                Lecture des conditions…
              </p>
            )}

            {erreur && (
              <div className="rounded-xl border border-stop/40 bg-stop/10 p-4">
                <p className="text-[14px] text-foam">{erreur}</p>
                <button
                  type="button"
                  onClick={rafraichir}
                  className="mt-2 font-mono text-[12px] text-foam/80 underline underline-offset-4"
                >
                  Réessayer
                </button>
              </div>
            )}

            {analyse && verdict && conditionsAffichees && meteo && (
              <>
                <BlocVerdict
                  spot={spotActif}
                  analyse={analyse}
                  verdict={verdict}
                  conditions={conditionsAffichees}
                  marine={marine}
                  heureProjetee={heureSelectionnee}
                />

                <Timeline
                  previsions={meteo.previsions}
                  spot={spotActif}
                  profil={profilActif}
                  creneau={creneau}
                  heureSelectionnee={heureSelectionnee}
                  onSelectionner={setHeureSelectionnee}
                  coucherSoleil={meteo.coucherSoleil}
                />

                <Criteres criteres={analyse.criteres} />

                <RailSpots
                  titre={titreRail}
                  spots={spotsRail}
                  spotActifId={spotActif.id}
                  apercus={apercus}
                  distances={distances}
                  favoris={favoris}
                  onSelectionner={choisirSpot}
                  onBasculerFavori={basculerFavori}
                />

                {/* Fiche du spot */}
                <section className="rounded-2xl border border-line/70 bg-surface/40 p-4 sm:p-5">
                  <h3 className="mb-3 font-mono text-[11px] tracking-[0.22em] text-muted">LE SPOT</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Info label="Type d’eau" valeur={spotActif.type.join(', ')} />
                    <Info label="Niveau requis" valeur={spotActif.niveau} />
                    <Info label="Accès" valeur={spotActif.acces} />
                    <Info label="À savoir" valeur={spotActif.notes} />
                  </div>
                </section>

                <Provenance
                  misAJourLe={misAJourLe}
                  eauDisponible={marine.temperatureEauC !== null}
                  onRafraichir={rafraichir}
                />
              </>
            )}
          </main>
        ) : (
          /* Aucun spot : on invite à agir plutôt que d'afficher une page vide */
          <main className="flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center">
            <h1 className="max-w-md font-display text-[clamp(1.6rem,5vw,2.4rem)] leading-tight font-bold text-foam">
              Sais en cinq secondes si tu dois aller kiter.
            </h1>
            <p className="max-w-sm text-[14px] leading-relaxed text-muted">
              KiteSpot lit le vent, le compare à ton poids, ton niveau et ton matériel, puis te dit quoi
              faire. {messageGeoloc ?? 'Autorise la localisation pour détecter ton spot.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={utiliserMaPosition}
                className="rounded-xl px-5 py-3 text-[14px] font-medium text-abyss"
                style={{ background: 'var(--verdict)' }}
              >
                Utiliser ma position
              </button>
              <button
                type="button"
                onClick={() => setModale('spot')}
                className="rounded-xl border border-line px-5 py-3 text-[14px] text-foam transition-colors hover:bg-surface"
              >
                Choisir un spot
              </button>
            </div>
          </main>
        )}
      </div>

      {modale === 'spot' && (
        <SelecteurSpot
          spots={SPOTS}
          spotActifId={spotActif?.id ?? ''}
          favoris={favoris}
          distances={distances}
          positionConnue={position !== null}
          onSelectionner={choisirSpot}
          onBasculerFavori={basculerFavori}
          onUtiliserMaPosition={utiliserMaPosition}
          onFermer={() => setModale(null)}
        />
      )}

      {modale === 'profil' && (
        <PanneauProfil
          profils={profils}
          profilActif={profilActif}
          onSelectionner={selectionner}
          onModifier={modifier}
          onAjouter={ajouter}
          onSupprimer={supprimer}
          onFermer={() => setModale(null)}
        />
      )}
    </div>
  )
}

function Info({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.16em] text-dim">{label.toUpperCase()}</p>
      <p className="mt-1 text-[13px] leading-snug text-foam/85">{valeur}</p>
    </div>
  )
}
