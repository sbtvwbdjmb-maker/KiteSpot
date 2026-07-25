# KiteSpot

Un copilote de décision pour le kitesurf. Tu ouvres le site, il détecte ta position, trouve le spot
le plus proche, lit les conditions et te dit s'il faut y aller — avec quelle voile.

L'objectif n'est pas d'afficher des données météo de plus. C'est de faire à ta place le raisonnement
qu'on fait normalement de tête devant Windguru : *14 nœuds → quelle voile ? → cette direction est-elle
bonne ici ? → est-ce adapté à mon poids ? → est-ce que ça vaut le déplacement ?*

## Lancer le projet

```bash
npm install
```

```bash
npm run dev
```

Le site tourne sur http://localhost:5173. Il écoute sur toutes les interfaces réseau : depuis un
téléphone sur le même Wi-Fi, remplace `localhost` par l'IP locale de la machine.

**Aucune clé API n'est nécessaire.** Il n'y a pas de fichier `.env` à remplir, pas de compte à créer.
Toutes les sources utilisées sont ouvertes et interrogées directement depuis le navigateur.

Autres commandes :

```bash
npm run verif
```

Rejoue le moteur d'analyse sur des cas réels connus (Levante à Tarifa, mistral à l'Almanarre,
tramontane à Leucate…). À lancer après toute modification de la logique de scoring.

```bash
npm run build
```

## Les sources de données

### Météo et vent — Open-Meteo

| | |
|---|---|
| **Fournit** | Vent moyen, rafales, direction, température, précipitations, couverture nuageuse, lever/coucher du soleil. Prévisions horaires sur 2 jours. Température de l'eau et hauteur de houle via l'API marine. |
| **Modèle** | `best_match` : Open-Meteo choisit automatiquement le meilleur modèle disponible au point demandé. Vérifié : AROME de Météo-France (~1,3 km de maille), ICON, ECMWF IFS (~25 km) et GFS de la NOAA sont tous accessibles. Sur un point à Leucate, AROME renvoie le point (42,91 / 3,030) contre (43,0 / 3,0) pour ECMWF — cette finesse compte pour le vent côtier. |
| **Mise à jour** | Les modèles sont réassimilés au mieux toutes les 15 min. KiteSpot rafraîchit toutes les 10 min et au retour sur l'onglet. |
| **Gratuit** | Oui, pour un usage non commercial. |
| **Clé API** | Non. |
| **Limites** | Moins de 10 000 appels/jour, 5 000/heure, 600/minute. Licence CC-BY 4.0 : l'attribution est obligatoire, elle est affichée dans le bloc « Sources ». Le dépassement renvoie un HTTP 429 — rencontré en développement, d'où le cache. |

### Recherche de lieux — Photon (OpenStreetMap)

| | |
|---|---|
| **Fournit** | Recherche directe (plage, ville, adresse, lieu-dit) et recherche inverse (coordonnées → nom du lieu). |
| **Gratuit** | Oui. |
| **Clé API** | Non. CORS ouvert, utilisable depuis le navigateur. |
| **Limites** | « Fair use » : l'usage intensif est bridé, aucune garantie de disponibilité. Données © contributeurs OpenStreetMap (ODbL), attribution affichée. |

**Pourquoi Photon et pas le géocodeur d'Open-Meteo ?** Ce dernier ne référence que des localités
peuplées. Testé : la requête « Praia do Carvalhal » ne renvoie **rien**, et « Carvalhal » seul pointe
un village intérieur à 150 km de la plage. Photon trouve la plage exacte. Comme tu veux pouvoir
chercher n'importe quel spot, c'était rédhibitoire.

### Relief — Open-Meteo Elevation

Sert à déduire l'orientation du littoral d'un lieu cherché (voir plus bas). Même quotas que l'API météo.

### Sources écartées, et pourquoi

- **NOAA (api.weather.gov)** — vérifié : renvoie une erreur 404 « Data Unavailable For Requested
  Point » sur Leucate, et fonctionne sur Washington. C'est une API **strictement états-unienne**,
  inutilisable pour la France, le Portugal ou l'Espagne. Le modèle GFS de la NOAA reste accessible,
  mais *via* Open-Meteo.
- **Windy** — l'API Point Forecast **exige une clé**. Or KiteSpot n'a pas de backend : une clé
  placée dans le frontend est lisible par tout le monde. Écartée pour cette raison, pas par principe.
- **Meteomatics** — authentification par identifiant/mot de passe, sans offre gratuite en libre-service
  (leur documentation renvoie vers un commercial). Même problème d'exposition des identifiants.
- **Windguru** — pas d'API publique ouverte permettant cet usage. Aucun scraping n'a été fait,
  conformément à ta consigne.

## Actualisation et cache

- Chargement immédiat à l'ouverture.
- Rafraîchissement automatique **toutes les 10 minutes** tant que la page reste ouverte.
- Rafraîchissement au retour sur l'onglet.
- Cache mémoire de 9 minutes par coordonnée, avec mutualisation des requêtes en vol : passer d'un spot
  à l'autre et revenir ne relance pas d'appel.
- La fraîcheur est affichée en clair : « Mis à jour il y a 3 min ».

## Comment KiteSpot décide

### Le score, critère par critère

La note sur 10 est une moyenne pondérée, relative **à ton profil** :

| Critère | Poids | Ce qu'il regarde |
|---|---|---|
| Puissance du vent | 30 % | Vent moyen comparé à ta plage exploitable, qui dépend de ton niveau |
| Direction | 28 % | Orientation du vent **par rapport au trait de côte** |
| Régularité | 16 % | Rapport rafales / vent moyen |
| Matériel | 16 % | Est-ce qu'une voile de ton quiver correspond — **ignoré si tu n'as rien renseigné** |
| Conditions générales | 10 % | Température, pluie |

Les poids sont renormalisés sur les seuls critères réellement évaluables : sans quiver renseigné, ou
sans orientation de littoral connue, le critère disparaît au lieu d'être deviné.

Des garde-fous priment sur la moyenne, pour qu'un bon score matériel ne rattrape jamais des conditions
dangereuses :

- **vent de terre** (offshore) → note plafonnée à 3,5 ;
- **vent au-dessus de ta plage de niveau** → 3,2 ;
- **vent de tempête** (> 38 nds) → 2,8 ;
- **pas assez de vent** → 2,4 ;
- **orientation du littoral inconnue** → 7,5, parce qu'on ignore alors le principal facteur de sécurité.

Concrètement, à 26 nœuds à l'Almanarre : *8,9/10 — va kiter* pour un intermédiaire, *9,3/10* pour un
expert, *3,2/10 — trop fort pour toi* pour un débutant.

Les seuils du verdict sont regroupés dans `SEUILS_VERDICT` (`src/lib/verdict.ts`), les plages de vent
par niveau dans `PLAGES_VENT` (`src/lib/scoring.ts`). C'est là, et nulle part ailleurs, qu'on rend
KiteSpot plus ou moins sévère.

### La direction, l'apport principal

Chaque spot porte une `orientation` : le cap vers lequel on regarde depuis la plage face à la mer.
Croisée avec la provenance du vent, elle donne onshore / side-onshore / side-shore / side-offshore /
offshore — au lieu d'afficher « vent de NO » et de te laisser conclure. C'est ce que dessine le cadran.

Cette orientation vient de trois endroits, et KiteSpot te dit toujours lequel :

1. **Vérifiée** — les 44 spots de `src/data/spots.json`, renseignés à la main.
2. **Estimée** — pour un lieu cherché hors base, déduite du relief : on échantillonne l'altitude sur
   16 points à 3 km autour, les secteurs à altitude nulle sont de l'eau, et le cap est le milieu du
   plus grand arc de mer contigu.
3. **Corrigée par toi** — un curseur dans le bloc « Sources » permet d'ajuster, et la correction est
   mémorisée pour ce lieu.

Quand le relief ne permet pas de trancher, KiteSpot **ne conclut pas** : la direction n'est pas notée,
le cadran redevient une rose des vents neutre, et un avertissement le dit.

### La taille de voile

Table de référence ancrée sur la pratique courante (10 m² à 20 nœuds pour 75 kg), interpolée sur le
vent, mise à l'échelle du poids, ajustée selon le niveau, le style et la préférence de puissance.
KiteSpot retient ensuite la voile **de ton quiver** la plus proche.

C'est une **estimation indicative**, jamais une vérité. Si tu n'as pas renseigné ton matériel, KiteSpot
donne une taille théorique et le dit — il ne prétend pas savoir ce que tu possèdes.

## Distinction des données

L'interface sépare explicitement, et la typographie porte la règle : **tout ce qui est mesuré est en
chasse fixe**, tout ce que KiteSpot interprète est en linéale.

- **Mesuré** — Open-Meteo : vent, rafales, direction, température, pluie, nuages, soleil, eau, houle.
- **Calculé par KiteSpot** — direction relative au littoral, régularité, score par critère, note
  globale, meilleur créneau.
- **Estimé par KiteSpot** — taille de voile, et orientation du littoral hors base vérifiée.

Quand une donnée manque (l'API marine ne couvre pas les plans d'eau intérieurs), elle est masquée.
Rien n'est inventé, aucune valeur n'est codée en dur.

## Base de spots

44 spots vérifiés à la main : 30 en France, 9 au Portugal, 5 en Espagne. Le champ `popularite` va de 1
(confidentiel) à 5 (ultra connu) et sert à remonter les spots méconnus dans la découverte.

Cette base n'est **pas** une limite de recherche : n'importe quel lieu du monde est cherchable via
Photon. Les 44 spots sont simplement ceux dont l'orientation est vérifiée, et ils remontent en tête
des résultats avec la mention « orientation vérifiée ».

Un audit (`orientation curatée` contre `orientation déduite du relief`) a été passé sur les 44 spots :
aucune correction nécessaire. Il a surtout montré où l'auto-détection échoue — voir les limites.

## Stack

React 19 + TypeScript strict + Vite, Tailwind CSS v4, aucun backend. Profils, dernier spot et
corrections d'orientation sont persistés en `localStorage`. Déployable tel quel sur Vercel.

```
src/
  data/spots.json          base vérifiée à la main
  lib/                     moteur d'analyse (pur, testable)
    direction.ts           orientation du vent vs littoral
    voile.ts               estimation de la taille de voile
    scoring.ts             critères, note globale, meilleur créneau
    verdict.ts             seuils et libellés du verdict
    cache.ts               cache à durée de vie
  services/
    weather.ts             Open-Meteo forecast
    marine.ts              Open-Meteo marine (eau, houle)
    geocoding.ts           Photon (recherche directe et inverse)
    coastline.ts           déduction de l'orientation du littoral
  hooks/                   géoloc, profils, conditions, résolution de lieu
  components/              interface
scripts/verif-moteur.ts    vérification du moteur sur cas réels
```

## Limites connues

- **L'auto-détection d'orientation se trompe sur les presqu'îles.** Testée contre des spots vérifiés,
  elle rejette correctement les îles, tombolos, golfes et plaines littorales, mais accepte à tort
  Tarifa (70° d'écart) : le relief seul ne distingue pas une presqu'île d'une plage droite. Les spots
  concernés sont dans la base vérifiée, et le curseur de correction est là pour les autres.
- **Les marées ne sont pas calculées.** Les spots concernés portent un avertissement, mais l'horaire
  est à vérifier ailleurs.
- **Une orientation unique par spot** ne rend pas compte des plages à double exposition
  (Quiberon-Penthièvre, tombolo de Giens) où l'on change de côté selon le vent.
- **Le vent est modélisé à 10 m** et lissé sur une maille : en thermique côtier, le vent réel au bord
  peut différer sensiblement.
- L'offre gratuite d'Open-Meteo couvre l'usage personnel. Un usage commercial demanderait leur offre payante.
