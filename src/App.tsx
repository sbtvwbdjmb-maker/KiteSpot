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
import { analyserPourSport, type Sport } from './lib/sport'
import { couleurScore } from './lib/couleurs'
import { NavSport } from '@/components/ui/nav-sport'
import { BlocVerdict } from './components/BlocVerdict'
import { Timeline } from './components/Timeline'
import { Criteres } from './components/Criteres'
import { SelecteurLieu } from './components/SelecteurLieu'
import { PanneauProfil } from './components/PanneauProfil'
import { MenuProfil } from './components/MenuProfil'
import { CreationProfil } from './components/CreationProfil'
import { Modale } from './components/Modale'
import { Provenance } from './components/Provenance'
import { HeroAccueil } from '@/components/ui/hero-accueil'

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
  const [sport, setSport] = useLocalStorage<Sport>('kitespot.sport.v1', 'kite')
  const [dateSelectionnee, setDateSelectionnee] = useState<string>('')
  const [resolutionEnCours, setResolutionEnCours] = useState(false)
  const [messageGeoloc, setMessageGeoloc] = useState<string | null>(null)

  const { localiser, permission: permissionGeoloc, erreur: erreurGeoloc } = useGeolocation()
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
        setModale(null)
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
      setModale(null)
    } catch (e) {
      // Le message reste affiché dans le sélecteur, qui ne se ferme pas
      setMessageGeoloc(e instanceof Error ? e.message : 'Position indisponible')
    }
  }, [localiser, choisirResultat, setLieu])

  // On ne localise d'office que si la permission est DÉJÀ accordée. Sinon on
  // attend le clic : une demande non sollicitée que l'utilisateur écarte
  // condamnerait le bouton « Utiliser ma position » pour toute la session.
  useEffect(() => {
    if (permissionGeoloc !== 'accordee') return
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
          return proche ? spotVersLieu(proche.s) : courant
        })
      })
      .catch(() => {
        // Le message d'erreur est porté par le hook, rien à ajouter ici
      })
    return () => {
      annule = true
    }
  }, [permissionGeoloc, localiser, setLieu])

  const conditionsAffichees = useMemo(() => {
    if (!meteo) return null
    if (!heureSelectionnee) return meteo.actuel
    return meteo.previsions.find((h) => h.heure === heureSelectionnee) ?? meteo.actuel
  }, [meteo, heureSelectionnee])

  const analyse = useMemo(() => {
    if (!lieu || !profilActif || !conditionsAffichees) return null
    return analyserPourSport(
      sport,
      conditionsAffichees,
      marine,
      lieu,
      profilActif,
      heureSelectionnee === null,
    )
  }, [sport, marine, lieu, profilActif, conditionsAffichees, heureSelectionnee])

  // Spots proposés sur l'écran d'accueil : les plus proches si on connaît la
  // position, sinon les plus discrets — c'est là qu'on fait découvrir la base.
  const spotsDecouverte = useMemo(() => {
    if (position) {
      return [...SPOTS].sort((a, b) => distances[a.id] - distances[b.id]).slice(0, 10)
    }
    return [...SPOTS].sort((a, b) => a.popularite - b.popularite).slice(0, 10)
  }, [position, distances])

  // Changer de sport remet la lecture à maintenant : les scores ne sont pas comparables
  useEffect(() => {
    setHeureSelectionnee(null)
  }, [sport])

  // Par défaut on regarde aujourd'hui
  useEffect(() => {
    if (meteo?.jours?.[0] && !meteo.jours.some((j) => j.date === dateSelectionnee)) {
      setDateSelectionnee(meteo.jours[0].date)
    }
  }, [meteo, dateSelectionnee])

  // La page prend la couleur de la réponse. Elle est calculée à partir du
  // score par la même fonction que les carrés de la timeline : à note égale,
  // la couleur du verdict et celle de l'heure sont forcément identiques.
  useEffect(() => {
    const couleur =
      analyse && analyse.scoreGlobal !== null
        ? couleurScore(analyse.scoreGlobal)
        : 'var(--color-muted)'
    document.documentElement.style.setProperty('--verdict', couleur)
  }, [analyse])

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
        <header className="flex flex-wrap items-center justify-between gap-3 py-4">
          <span className="font-display text-[15px] font-bold tracking-tight text-foam">
            Kite<span style={{ color: 'var(--verdict)' }}>Spot</span>
          </span>

          <NavSport actif={sport} onChanger={setSport} />

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

            {analyse && conditionsAffichees && meteo && (
              <>
                <BlocVerdict
                  lieu={lieu}
                  analyse={analyse}
                  ventNoeuds={conditionsAffichees.ventNoeuds}
                  rafalesNoeuds={conditionsAffichees.rafalesNoeuds}
                  heureProjetee={heureSelectionnee}
                />

                <Timeline
                  sport={sport}
                  meteo={meteo}
                  marine={marine}
                  lieu={lieu}
                  profil={profilActif}
                  heureSelectionnee={heureSelectionnee}
                  onSelectionnerHeure={setHeureSelectionnee}
                  dateSelectionnee={dateSelectionnee}
                  onSelectionnerDate={setDateSelectionnee}
                />

                {analyse.criteres.length > 0 && <Criteres criteres={analyse.criteres} />}

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
          <main className="flex flex-1 flex-col py-14">
            <HeroAccueil
              titre={`Où veux-tu kiter, ${profilActif.nom}\u202f?`}
              sousTitre="KiteSpot lit le vent, le compare à ton poids et à ton niveau, puis te dit s’il faut y aller."
              actionPrincipale={{ label: '\ud83d\udccd Utiliser ma position', onClick: utiliserMaPosition }}
              actionSecondaire={{ label: 'Chercher un spot', onClick: () => setModale('lieu') }}
              note={messageGeoloc ?? undefined}
              spots={spotsDecouverte}
              onChoisirSpot={(spot) =>
                choisirResultat({
                  cle: spot.id,
                  nom: spot.name,
                  localite: spot.locality,
                  pays: spot.country,
                  lat: spot.lat,
                  lon: spot.lon,
                  categorie: 'spot',
                })
              }
            />
          </main>
        )}
      </div>

      {modale === 'lieu' && (
        <SelecteurLieu
          distances={distances}
          positionConnue={position !== null}
          permissionGeoloc={permissionGeoloc}
          messageGeoloc={erreurGeoloc ?? null}
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
