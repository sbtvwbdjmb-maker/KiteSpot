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

Autres commandes :

```bash
npm run verif
```

Vérifie le moteur d'analyse sur des cas réels connus (Levante à Tarifa, mistral à l'Almanarre,
tramontane à Leucate…). À lancer après toute modification de la logique de scoring.

```bash
npm run build
```

## Comment KiteSpot décide

### Le score, critère par critère

La note sur 10 est une moyenne pondérée de cinq critères, tous relatifs **à ton profil** :

| Critère | Poids | Ce qu'il regarde |
|---|---|---|
| Force du vent | 30 % | Vent moyen comparé à ta plage exploitable, qui dépend de ton niveau |
| Direction | 28 % | Orientation du vent **par rapport au trait de côte du spot** |
| Régularité | 16 % | Rapport rafales / vent moyen |
| Matériel | 16 % | Est-ce qu'une voile de ton quiver correspond vraiment |
| Confort | 10 % | Température, pluie |

Des garde-fous priment sur cette moyenne, parce qu'un bon score matériel ne doit jamais rattraper
des conditions dangereuses :

- **vent de terre** (offshore) → note plafonnée à 3,5 et avertissement explicite ;
- **vent au-dessus de ta plage de niveau** → plafonnée à 3,2 ;
- **vent de tempête** (> 38 nds) → plafonnée à 2,8 ;
- **pas assez de vent** → plafonnée à 2,4.

Concrètement : 26 nœuds à l'Almanarre donnent *8,9/10 — va kiter* pour un intermédiaire, et
*3,2/10 — trop fort pour toi* pour un débutant. Mêmes conditions, réponse opposée.

### La direction, l'apport principal

Chaque spot porte une donnée `orientation` : le cap vers lequel on regarde quand on est sur la plage
face à la mer. En la croisant avec la provenance du vent, KiteSpot déduit onshore / side-onshore /
side-shore / side-offshore / offshore — au lieu d'afficher « vent de NO » et de te laisser conclure.

C'est ce que dessine le cadran : le trait de côte du spot, et la flèche du vent par-dessus. On voit
immédiatement si le vent pousse vers la plage ou vers le large.

Le modèle retrouve les configurations connues des locaux : le Levante est side-offshore à Tarifa, le
mistral est side-onshore à l'Almanarre, un vent d'est est franchement offshore à Lacanau. Cas
particulier traité : sur une **lagune fermée** (Leucate-Les Coussoules, Lagoa de Albufeira), le vent
de terre reste gênant mais cesse d'être dangereux, la dérive étant contenue.

### La taille de voile

Table de référence ancrée sur la pratique courante (10 m² à 20 nœuds pour 75 kg), interpolée sur le
vent, mise à l'échelle du poids, puis ajustée selon le niveau, le style et la préférence de puissance.
KiteSpot retient ensuite la voile **de ton quiver** la plus proche, et dit franchement quand aucune ne
convient.

C'est une **estimation indicative**, jamais une vérité : le ressenti dépend aussi de la planche, du
modèle de voile et de l'état de la mer.

## D'où viennent les données

Tout est gratuit et sans clé API.

- **Mesuré — [Open-Meteo](https://open-meteo.com)** : vent moyen, rafales, direction, température,
  précipitations, couverture nuageuse, lever et coucher du soleil. Température de l'eau et houle via
  l'API marine.
- **Calculé — KiteSpot** : orientation relative au littoral, régularité, scores, meilleur créneau.
- **Estimé — KiteSpot** : taille de voile. L'orientation du littoral de chaque spot est une donnée
  curatée à la main.

Quand une donnée n'est pas disponible (l'API marine ne couvre pas tous les plans d'eau intérieurs),
elle est simplement masquée. Rien n'est inventé.

L'interface porte cette distinction typographiquement : **tout ce qui est mesuré est en chasse fixe**,
tout ce que KiteSpot interprète est en linéale.

## Base de spots

44 spots curatés à la main : 30 en France (Méditerranée, Manche–mer du Nord, Bretagne, Atlantique),
9 au Portugal, 5 en Espagne. Le champ `popularite` va de 1 (spot confidentiel) à 5 (spot ultra connu),
et sert à faire remonter les spots méconnus dans la découverte plutôt que les classiques touristiques.

Pour en ajouter un, édite `src/data/spots.json` en suivant le type `Spot` de `src/types/spot.ts`.
Le champ délicat est `orientation` : regarde le spot sur une carte, place-toi mentalement sur la plage
et note le cap vers le large.

## Stack

React 19 + TypeScript strict + Vite, Tailwind CSS v4, aucune dépendance backend. Profils, favoris et
dernier spot sont persistés en `localStorage`. Déployable tel quel sur Vercel.

```
src/
  data/spots.json          base de spots curatée
  lib/                     moteur d'analyse (pur, testable)
    direction.ts           orientation du vent vs littoral
    voile.ts               estimation de la taille de voile
    scoring.ts             critères, note globale, meilleur créneau
    verdict.ts             rédaction de la recommandation
  services/                appels Open-Meteo (forecast + marine)
  hooks/                   géoloc, profils, conditions, persistance
  components/              interface
scripts/verif-moteur.ts    vérification du moteur sur cas réels
```

## Limites connues

- Les marées ne sont pas calculées. Les spots concernés portent un avertissement, mais il faut
  vérifier l'horaire ailleurs.
- L'orientation du littoral est un cap unique par spot : elle ne rend pas compte des plages à double
  exposition (Quiberon-Penthièvre, le tombolo de Giens) où il faut changer de côté selon le vent.
- Le vent est modélisé à 10 m et lissé sur une maille : en thermique côtier, le vent réel au bord peut
  différer sensiblement.
