import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Lieu } from './types/lieu'
import type { ResultatLieu } from './services/geocoding'
import { nommerPosition } from './services/geocoding'
import { SPOTS, spotVersLieu, idGeo, useResolutionLieu } from './hooks/useLieux'
import { useProfils } from './hooks/useProfils'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useConditions, useFraicheur } from './hooks/useConditions'
import { useGeolocation } from './hooks/useGeolocation'
import { distanceKm, formaterDistance } from './lib/geo'
import { analyserConditions, meilleurCreneau } from './lib/scoring'
import { construireVerdict } from './lib/verdict'
import { BlocVerdict } from './components/BlocVerdict'
import { Timeline } from './components/Timeline'
import { Criteres } from './components/Criteres'
import { SelecteurLieu } from './components/SelecteurLieu'
import { PanneauProfil } from './components/PanneauProfil'
import { MenuProfil } from './components/MenuProfil'
import { CreationProfil } from './components/CreationProfil'
import { Modale } from './components/Modale'
import { Provenance } from './components/Provenance'

const COULEUR_TON = {
  go: 'var(--color-go)',
  mitige: 'var(--color-warn)',
  stop: 'var(--color-stop)',
} as const

export default function App() {
  const { profils, profilActif, selectionner, ajouter, modifier, supprimer } = useProfils()
  const { resoudre, corrigerOrientation } = useResolutionLieu()
  // On mémorise le lieu entier, pas seulement un identifiant de spot :
  // un lieu cherché librement doit être retrouvé au retour sur le site.
  const [dernierLieu, setDernierLieu] = useLocalStorage<Lieu | null>('kitespot.lieu.v1', null)
  const [lieu, setLieuInterne] = useState<Lieu | null>(dernierLieu)

  const setLieu = useCallback(
    (suivant: Lieu | null | ((courant: Lieu | null) => Lieu | null)) => {
      setLieuInterne((courant) => {
        const resolu = typeof suivant === 'function' ? suivant(courant) : suivant
        setDernierLieu(resolu)
        return resolu
      })
    },
    [setDernierLieu],
  )
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null)
  const [modale, setModale] = useState<'lieu' | 'profil' | 'nouveau-profil' | null>(null)
  const [menuProfilOuvert, setMenuProfilOuvert] = useState(false)
  const [heureSelectionnee, setHeureSelectionnee] = useState<string | null>(null)
  const [resolutionEnCours, setResolutionEnCours] = useState(false)
  const [messageGeoloc, setMessageGeoloc] = useState<string | null>(null)

  const { localiser } = useGeolocation()
  const { meteo, marine, chargement, erreur, misAJourLe, rafraichir } = useConditions(lieu)
  const fraicheur = useFraicheur(misAJourLe)

  const distances = useMemo(() => {
    if (!position) return {}
    const table: Record<string, number> = {}
    for (const spot of SPOTS) table[spot.id] = distanceKm(position.lat, position.lon, spot.lat, spot.lon)
    return table
  }, [position])

  const choisirResultat = useCallback(
    async (resultat: ResultatLieu) => {
      setResolutionEnCours(true)
      setHeureSelectionnee(null)
      try {
        const nouveau = await resoudre(resultat)
        setLieu(nouveau)
      } finally {
        setResolutionEnCours(false)
      }
    },
    [resoudre, setLieu],
  )

  const utiliserMaPosition = useCallback(async () => {
    setMessageGeoloc(null)
    try {
      const { lat, lon } = await localiser()
      setPosition({ lat, lon })

      // Un spot vérifié à moins de 15 km prime : ses données valent mieux qu'une estimation
      const proche = SPOTS.map((s) => ({ s, d: distanceKm(lat, lon, s.lat, s.lon) })).sort(
        (a, b) => a.d - b.d,
      )[0]
      if (proche && proche.d <= 15) {
        setLieu(spotVersLieu(proche.s))
        return
      }

      // Sinon on nomme la position par géocodage inverse
      const nomme = await nommerPosition(lat, lon)
      await choisirResultat(
        nomme ?? {
          cle: idGeo(lat, lon),
          nom: 'Ma position',
          localite: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
          pays: '',
          lat,
          lon,
          categorie: 'coords',
        },
      )
    } catch (e) {
      setMessageGeoloc(e instanceof Error ? e.message : 'Position indisponible')
    }
  }, [localiser, choisirResultat, setLieu])

  // Géolocalisation au chargement, non bloquante : un spot déjà choisi reste affiché
  useEffect(() => {
    let annule = false
    void localiser()
      .then(({ lat, lon }) => {
        if (annule) return
        setPosition({ lat, lon })
        setLieu((courant) => {
          if (courant) return courant
          const proche = SPOTS.map((s) => ({ s, d: distanceKm(lat, lon, s.lat, s.lon) })).sort(
            (a, b) => a.d - b.d,
          )[0]
          if (proche) return spotVersLieu(proche.s)
          return courant
        })
      })
      .catch((e: Error) => {
        if (!annule) setMessageGeoloc(e.message)
      })
    return () => {
      annule = true
    }
  }, [localiser, setLieu])

  const conditionsAffichees = useMemo(() => {
    if (!meteo) return null
    if (!heureSelectionnee) return meteo.actuel
    return meteo.previsions.find((h) => h.heure === heureSelectionnee) ?? meteo.actuel
  }, [meteo, heureSelectionnee])

  const analyse = useMemo(() => {
    if (!lieu || !profilActif || !conditionsAffichees) return null
    return analyserConditions(conditionsAffichees, marine, lieu, profilActif)
  }, [marine, lieu, profilActif, conditionsAffichees])

  const verdict = useMemo(() => (analyse ? construireVerdict(analyse) : null), [analyse])

  const creneau = useMemo(() => {
    if (!meteo || !lieu || !profilActif) return null
    return meilleurCreneau(meteo.previsions, lieu, profilActif, new Date(), meteo.coucherSoleil)
  }, [meteo, lieu, profilActif])

  // La page prend la couleur de la réponse
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--verdict',
      verdict ? COULEUR_TON[verdict.ton] : 'var(--color-go)',
    )
  }, [verdict])

  const appliquerOrientation = useCallback(
    (orientation: number) => {
      if (!lieu) return
      corrigerOrientation(lieu.id, orientation)
      setLieu({ ...lieu, orientation, sourceOrientation: 'manuelle' })
    },
    [lieu, corrigerOrientation, setLieu],
  )

  // Tant qu'aucun profil n'existe, on ne peut rien personnaliser : on le crée d'abord
  if (!profilActif) {
    return (
      <div className="relative min-h-screen">
        <div className="ambiance" aria-hidden />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
          <h1 className="mb-1 font-display text-2xl font-bold text-foam">
            Kite<span style={{ color: 'var(--verdict)' }}>Spot</span>
          </h1>
          <p className="mb-7 text-[14px] text-muted">
            Sais en cinq secondes si tu dois aller kiter.
          </p>
          <CreationProfil premier onCreer={ajouter} />
        </div>
      </div>
    )
  }

  const distanceLieu = lieu && position ? distances[lieu.id] : undefined

  return (
    <div className="relative min-h-screen">
      <div className="ambiance" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-14 sm:px-6">
        <header className="flex items-center justify-between gap-3 py-4">
          <span className="font-display text-[15px] font-bold tracking-tight text-foam">
            Kite<span style={{ color: 'var(--verdict)' }}>Spot</span>
          </span>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuProfilOuvert((o) => !o)}
                aria-expanded={menuProfilOuvert}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface/50 px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-foam"
              >
                <span aria-hidden>👤</span>
                {profilActif.nom}
                <span aria-hidden className="text-[9px] opacity-70">▼</span>
              </button>
              {menuProfilOuvert && (
                <MenuProfil
                  profils={profils}
                  profilActif={profilActif}
                  onSelectionner={selectionner}
                  onAjouter={() => setModale('nouveau-profil')}
                  onModifier={() => setModale('profil')}
                  onFermer={() => setMenuProfilOuvert(false)}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setModale('lieu')}
              className="rounded-full border border-line bg-surface/50 px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-foam"
            >
              Changer de spot
            </button>
          </div>
        </header>

        {lieu ? (
          <main className="flex flex-1 flex-col gap-8 pt-2">
            <div className="monte">
              <p className="font-mono text-[11px] tracking-[0.2em] text-muted">SPOT SÉLECTIONNÉ</p>
              <h1 className="mt-1.5 font-display text-[clamp(1.5rem,4.5vw,2.1rem)] leading-tight font-bold text-foam">
                {lieu.nom}
              </h1>
              <p className="mt-1 text-[13px] text-muted">
                {[lieu.localite, lieu.pays].filter(Boolean).join(' · ')}
                {distanceLieu !== undefined && ` · à ${formaterDistance(distanceLieu)}`}
              </p>
            </div>

            {(chargement || resolutionEnCours) && !meteo && (
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
                  lieu={lieu}
                  analyse={analyse}
                  verdict={verdict}
                  conditions={conditionsAffichees}
                  heureProjetee={heureSelectionnee}
                />

                <Timeline
                  previsions={meteo.previsions}
                  lieu={lieu}
                  profil={profilActif}
                  creneau={creneau}
                  heureSelectionnee={heureSelectionnee}
                  onSelectionner={setHeureSelectionnee}
                  coucherSoleil={meteo.coucherSoleil}
                />

                <Criteres criteres={analyse.criteres} />

                {lieu.acces && (
                  <section className="rounded-2xl border border-line/70 bg-surface/40 p-4 sm:p-5">
                    <h3 className="mb-3 font-mono text-[11px] tracking-[0.22em] text-muted">LE SPOT</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {lieu.type && <Info label="Type d’eau" valeur={lieu.type.join(', ')} />}
                      {lieu.niveau && <Info label="Niveau requis" valeur={lieu.niveau} />}
                      <Info label="Accès" valeur={lieu.acces} />
                      {lieu.notes && <Info label="À savoir" valeur={lieu.notes} />}
                    </div>
                  </section>
                )}

                <Provenance
                  lieu={lieu}
                  fraicheur={fraicheur}
                  eauDisponible={marine.temperatureEauC !== null}
                  chargement={chargement}
                  onRafraichir={rafraichir}
                  onCorrigerOrientation={appliquerOrientation}
                />
              </>
            )}
          </main>
        ) : (
          <main className="flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center">
            {/* Espace fine insécable avant le « ? » : il ne doit jamais partir seul à la ligne */}
            <h1 className="max-w-md font-display text-[clamp(1.6rem,5vw,2.4rem)] leading-tight font-bold text-foam">
              {`Où veux-tu kiter, ${profilActif.nom} ?`}
            </h1>
            <p className="max-w-sm text-[14px] leading-relaxed text-muted">
              {messageGeoloc ?? 'Autorise la localisation ou cherche un spot.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={utiliserMaPosition}
                className="rounded-xl px-5 py-3 text-[14px] font-medium text-abyss"
                style={{ background: 'var(--verdict)' }}
              >
                📍 Utiliser ma position
              </button>
              <button
                type="button"
                onClick={() => setModale('lieu')}
                className="rounded-xl border border-line px-5 py-3 text-[14px] text-foam transition-colors hover:bg-surface"
              >
                Chercher un spot
              </button>
            </div>
          </main>
        )}
      </div>

      {modale === 'lieu' && (
        <SelecteurLieu
          distances={distances}
          positionConnue={position !== null}
          onChoisirResultat={choisirResultat}
          onUtiliserMaPosition={utiliserMaPosition}
          onFermer={() => setModale(null)}
        />
      )}

      {modale === 'profil' && (
        <PanneauProfil
          profil={profilActif}
          peutSupprimer={profils.length > 1}
          onModifier={modifier}
          onSupprimer={supprimer}
          onFermer={() => setModale(null)}
        />
      )}

      {modale === 'nouveau-profil' && (
        <Modale titre="Nouveau profil" onFermer={() => setModale(null)}>
          <CreationProfil
            premier={false}
            onCreer={(champs) => {
              ajouter(champs)
              setModale(null)
            }}
            onAnnuler={() => setModale(null)}
          />
        </Modale>
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
