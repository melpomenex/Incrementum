# Manuel de l'utilisateur Incrementum

**Votre guide complet pour maîtriser la lecture incrémentielle et la répétition espacée**

---

## Pour commencer

### Premier lancement

Lorsque vous lancez Incrementum pour la première fois, vous verrez le **Tableau de bord** composé de quatre sections principales :

1. **File d'attente** - Votre file d'attente de révision (vide au début)
2. **Révision** - Séance de révision active
3. **Documents** - Votre bibliothèque de documents
4. **Analytics** - Statistiques de progression

### Configuration initiale

1. **Choisissez un thème** - Accédez à Paramètres → Apparence → Thème
   - 147 thèmes intégrés disponibles (26 modernes, 121 hérités)
   - Essayez « Modern Dark » ou « Material You » pour un look moderne

2. **Configurer les paramètres de révision** - Paramètres → Apprentissage → Algorithme
   - **Algorithme** : FSRS-6 (recommandé), SM-20, SM-18 ou SM-2
   - **Rétention souhaitée** : 90 % (par défaut) - cible la qualité dont vous souhaitez vous souvenir
   - **Apprendre par jour** : 20 à 50 éléments recommandés pour les débutants

3. **Configurer les catégories** - Paramètres → Catégories
   - Créer des catégories pour différents sujets (par exemple, "Programmation", "Science", "Langues")
   - Les catégories vous aident à organiser et filtrer votre matériel d'apprentissage

### Votre premier document

Importons votre premier document :

1. Cliquez sur **Documents** dans la barre latérale
2. Cliquez sur le bouton **Importer** (en haut à droite)
3. Choisissez votre méthode d'importation :
   - **Fichier local** : sélectionnez un fichier PDF, EPUB ou texte
   - **URL** : collez n'importe quelle URL Web
   - **Arxiv** : collez un identifiant ou une URL de document de recherche
4. Attendez le traitement
   - Si la segmentation automatique est activée dans Paramètres, le document sera automatiquement divisé en extraits après l'importation

---

## Gestion des documents

### Formats d'importation

| Formater | Descriptif | Cas d'utilisation |
|--------|-------------|--------------|
| **PDF** | Format de document portable | Documents de recherche, ebooks, documentation |
| **EPUB** | Publication électronique | Livres, articles avec texte redistribuable |
| **Marquage** | Fichiers `.md` | Documentation technique, remarques |
| **HTML** | Pages Web | Articles, billets de blog |
| **Anki (.apkg)** | Forfait de pont Anki | Migrer depuis Anki |
| **SuperMémo** | Exportations ZIP | Migrer depuis SuperMemo |
| **JSON (.json)** | Fichiers de jeu de cartes mémoire | Importer des decks avec des données de planification |
| **URL** | Tout lien Web | Articles en ligne, blogs |
| **Arxiv** | Articles académiques | Littérature de recherche |
| **Capture d'écran** | Capture d'écran | Captures rapides depuis n'importe quelle application |

### Importation de documents

#### Méthode 1 : fichiers locaux

1. Cliquez sur **Documents** → **Importer**
2. Sélectionnez **Fichier local**
3. Accédez à votre fichier et sélectionnez-le
4. Incrementum :
   - Extraire le contenu du texte
   - Calculer le temps de lecture et le nombre de mots
   - Extraire les métadonnées (titre, auteur, etc.)
   - Si l'auto-segmentation est activée (Paramètres → Documents → Traitement automatique à l'importation), divisez automatiquement le document en extraits

#### Méthode 2 : importation d'URL

1. Copiez n'importe quelle URL Web
2. Cliquez sur **Documents** → **Importer** → **URL**.
3. Collez l'URL
4. Cliquez sur **Importer**
5. Incrementum récupère et traite le contenu

**Sites pris en charge :**
- Articles de presse (la plupart des sites majeurs)
- Articles de blog
- Pages de documentation
- Moyen, Sous-pile, etc.

#### Méthode 3 : Documents Arxiv

1. Recherchez un article Arxiv (par exemple, « https://arxiv.org/abs/2301.07041 »)
2. Copiez l'URL ou l'ID papier (`2301.07041`)
3. Cliquez sur **Documents** → **Importer** → **Arxiv**
4. Collez l'URL ou l'ID
5. Téléchargements incrémentaux :
   - PDF complet
   - Résumé
   - Auteurs
   -Date de parution
   - Références

#### Méthode 4 : importation de deck JSON

Importez des jeux de cartes mémoire à partir de fichiers JSON qui incluent des données de planification (intervalles, facteurs de facilité, historique des révisions).

**Importation via le sélecteur de fichiers :**

1. Cliquez sur **Documents** → **Importer** → **JSON**.
2. Sélectionnez votre fichier de deck `.json`
3. Incrementum crée un document de jeu et importe toutes les cartes, en préservant :
   - Planification (intervalles, facteurs de facilité, dates d'échéance)
   - Revoir l'historique (répétitions, échecs, taux de rétention)
   - États de la carte (nouveau, en cours de révision ou suspendu)

**Importation par glisser-déposer :**

Faites glisser un fichier « .json » directement sur la fenêtre de l'application. Si le fichier correspond au format de deck attendu, il est importé automatiquement.

**Format de plate-forme JSON :**

Le fichier doit être un objet plat mappant le texte de la question aux données de la carte :

```json
{
  "Quelle est la puissance de la cellule ?" : {
    "answer": "Les mitochondries.",
    "subject": "Biologie",
    "deck_name": "Biologie cellulaire",
    "ease_factor": 2.6,
    "intervalle_jours": 7,
    "répétitions": 3,
    "due_at": "2026-04-20T12:00:00Z"
  }
}
```

**Remarques :**
- Chaque fichier `.json` crée un deck. Le nom du deck vient du champ `deck_name`.
- Les cartes importées utilisent l'algorithme SM-2 par défaut. Vous pouvez changer d'algorithme après l'importation.
- Supprimer deux fois le même fichier ne créera pas de doublons : les cartes existantes sont ignorées.
- Les cartes marquées «known_pile: true» sont importées comme suspendues.

### Visionneuse de documents

Une fois importé, ouvrez n'importe quel document pour accéder :

**Fonctionnalités de la visionneuse :**
- **Navigation dans les pages** : faites défiler les pages/sections
- **Zoom** : Ajustez la taille du texte
- **Plein écran** : lecture sans distraction
- **Recherche** : rechercher du texte dans le document
- **Table des matières** : accéder aux sections (si disponible)**Outils d'annotation :**
1. **Surligner le texte** : Sélectionnez le texte → Choisissez la couleur de surbrillance
   - Yellow: Important concepts
   - Vert : Exemples
   - Bleu : Définitions
   - Rouge : Points critiques
   - Violet : Thèmes connexes

2. **Créer un extrait** : Sélectionnez le texte → Cliquez sur le bouton "Extraire"
   - L'extrait apparaît dans l'onglet Extraits
   - Peut être converti en flashcard plus tard

3. **Ajouter une note** : Sélectionnez le texte → Cliquez sur le bouton « Note »
   - Joignez vos pensées/notes
   - Notes appear with extracts

### Organisation des documents

**Catégories :**
- Assign each document to a category
- Filtrer les documents par catégorie
- Les catégories héritent des extraits et des fiches

**Mots clés :**
- Ajouter des balises personnalisées aux documents
- Utiliser des balises pour l'organisation inter-catégories
- Exemples : `#urgent`, `#research`, `#tutorial`

**Recherche :**
- Recherche en texte intégral dans tous les documents
- Filtrer par catégorie, tags, plage de dates
- Trier par titre, date, nombre de mots

---

## Le système d'apprentissage

### Comprendre FSRS-6

**FSRS-6** (Free Spaced Repetition Scheduler) est un algorithme moderne qui :

1. **Suive l'état de la mémoire** : modélise la force de votre mémoire pour chaque carte
2. **Prédit l'oubli** : estime le moment où vous oublierez chaque élément
3. **Optimise la planification** : planifie les révisions à des moments optimaux
4. **S'adapte à vous** : apprend de vos modèles de performance

**Mesures clés :**
- **Stabilité** : combien de temps dure une mémoire (plus élevée = plus stable)
- **Difficulté** : la difficulté de l'objet pour vous (échelle de 1 à 10)
- **Récupérabilité** : probabilité actuelle de rappel (0-100 %)

### Comprendre SM-18

**SM-18** (SuperMemo 18) est l'algorithme précédent de la famille SuperMemo. Il représente une évolution significative par rapport à SM-2, introduisant la modélisation de la stabilité de la mémoire et une approche basée sur les données pour le calcul des intervalles.

SM-18 :

1. **Modélise l'Oubli de Façon Exponentielle** : Utilise la formule `R = 0,9^(t/S)` pour calculer la récupérabilité — la probabilité que vous vous souveniez d'un élément au temps `t` compte tenu de sa stabilité `S`
2. **Suit la Difficulté de Manière Indépendante** : Maintient une valeur de difficulté `D ∈ [0, 1]` pour chaque élément, mise à jour via une formule de moyenne glissante qui devient plus réactive à chaque répétition
3. **Utilise une Matrice SInc 3D** : Recherche le facteur d'augmentation de stabilité dans une matrice 21×21×21 indexée par difficulté, stabilité et récupérabilité regroupées — c'est le cœur de l'intelligence de SM-18
4. **Gère les Échecs avec Grâce** : En cas d'échec, réduit la stabilité d'un facteur de 0,87 (divisé en plus par les échecs accumulés) et réinitialise le compteur de répétitions, mais préserve l'estimation de difficulté
5. **Calcule les Intervalles à partir de la Stabilité** : Déduit le prochain intervalle de révision à partir de l'objectif de rétention souhaité : `intervalle = S × ln(1-FI) / ln(0,9)`

**Mesures clés :**
- **Stabilité (S)** : Combien de temps une mémoire persiste avant de s'effacer (mesurée en jours)
- **Difficulté (D)** : Une valeur de 0 (la plus facile) à 1 (la plus difficile), mise à jour par fusion de moyenne glissante après chaque révision
- **Récupérabilité (R)** : Probabilité de rappel actuelle, calculée comme `0,9^(écoulé/S)`
- **SInc** : Le facteur d'augmentation de stabilité issu de la matrice de 9 261 entrées — de combien la stabilité augmente après chaque révision réussie
- **Échecs** : Nombre d'échecs, qui pénalisent la stabilité future lors des échecs ultérieurs

### Comprendre SM-20

**SM-20** (SuperMemo 20) est l'algorithme le plus avancé disponible, obtenu par rétro-ingénierie à partir de `sm20`. Il s'appuie sur les fondations de SM-18 tout en introduisant le lissage bayésien, plusieurs versions d'algorithme et une branche optionnelle de la famille FSRS.

SM-20 :

1. **Prend en Charge Plusieurs Formules d'Intervalle** : Fournit trois versions d'algorithme — V2 (compatible SM-19), V4 (SM-20 proprement dit) et V6 (style FSRS) — chacune calculant les intervalles différemment à partir des mêmes variables d'état
2. **Applique le Lissage Bayésien** : Lorsque suffisamment de données de révision s'accumulent, il lisse les calculs d'intervalle grâce à une recherche de voisins 3×3×3 dans les matrices d'intervalle/compteur, combinée à un prior bayésien
3. **Suit la Stabilité avec un Indexage en Loi de Puissance** : Convertit la stabilité en indices de matrice via une transformation en loi de puissance (`S^2,9`), offrant une résolution plus fine aux stabilités faibles et plus grossière aux valeurs élevées
4. **Inclut une Branche de la Famille FSRS** : Les éléments peuvent optionnellement utiliser un modèle de mélange à 3 experts (loi de puissance, loi de puissance FSRS et oubli exponentiel) avec 35 paramètres dédiés pour les mises à jour de difficulté et stabilité
5. **Enregistre et Apprend des Révisions** : Chaque révision met à jour des matrices d'intervalle et de compteur de 21×21×21 par moyennage incrémental, permettant à l'algorithme d'apprendre les intervalles optimaux à partir de vos performances réelles au fil du temps

**Mesures clés :**
- **Stabilité (S)** : Persistance de la mémoire en jours, avec une transformation d'index en loi de puissance pour la recherche matricielle (plafonnée à 44 530 jours maximum)
- **Difficulté (D)** : Regroupée en 10 niveaux via `floor(D × 19) + 1`, utilisée comme un axe de la matrice d'intervalle
- **Version** : Sélectionne la formule d'intervalle à utiliser (V2, V4 ou V6)
- **Branche d'Algorithme** : 0 pour SM-20 classique, 1 pour le modèle de mélange d'experts de la famille FSRS
- **Retrov (Retrov) :** Estimation de récupérabilité utilisée par la branche FSRS pour les ajustements de stabilité
- **Matrices d'Intervalle/Compteur** : Deux matrices de 9 261 entrées qui accumulent votre historique de révisions et permettent l'optimisation d'intervalles avec lissage bayésien

**Comment SM-20 diffère de FSRS-6 :**
- FSRS-6 utilise un ensemble fixe de paramètres entraînés sur des données agrégées ; SM-20 apprend de *vos* révisions au fil du temps via ses matrices
- Le lissage bayésien de SM-20 fournit un moyen fondé d'équilibrer les connaissances préalables avec les données observées
- SM-20 permet de basculer entre les formules d'intervalle (V2/V4/V6) et possède même une branche de la famille FSRS intégrée

### Système de notation

Lors des examens, évaluez chaque article en fonction de votre rappel :

| Évaluation | Étiquette | Descriptif | Intervalle typique |
|--------|-------|-------------|------------------|
| **1** | Encore une fois | Panne totale | ~10 minutes |
| **2** | Difficile | Souvenir d'un effort considérable | 1-2 jours |
| **3** | Bon | Souvenir avec réflexion | 5-7 jours |
| **4** | Facile | Le rappel s'est fait sans effort | 10-14 jours |

**Intervalles d'aperçu :**
Avant la notation, Incrementum vous indique exactement quand chaque carte apparaîtra ensuite pour les quatre options de notation. Profitez-en pour optimiser votre emploi du temps !

### Types de cartes

#### 1. Flashcards de base
Cartes simples recto/verso

**Recto :** Quelle est la capitale de la France ?
**Retour :** Paris

**Idéal pour :** Faits, définitions, vocabulaire

#### 2. Supprimer la suppression
Style de remplissage

**Texte :** La capitale de la {{France}} est Paris.

**S'affiche comme :** La capitale de _____ est Paris.

**Idéal pour :** Apprentissage contextuel, relations

#### 3. Cartes questions-réponses
Paires de questions et réponses

**Q :** Expliquez la différence entre TCP et UDP.
**R :** TCP est orienté connexion avec une livraison garantie ; UDP est sans connexion sans garantie.

**Idéal pour :** Concepts, explications

#### 4. Occlusion de l'image
Masquer des parties d'une image (schémas, graphiques)

**Idéal pour :** Anatomie, cartes, diagrammes

### Création de cartes

#### À partir d'extraits

1. Pendant la lecture, sélectionnez le texte important
2. Cliquez sur **Extraire** pour créer un extrait
3. Dans l'onglet **Extraits**, examinez vos extraits
4. Cliquez sur **Créer une carte** sur n'importe quel extrait
5. Choisissez le type de carte (Flashcard, Cloze, Q&A)
6. Modifier le contenu de la carte
7. Cliquez sur **Enregistrer**

La carte est maintenant programmée pour examen !

#### Création manuelle

1. Cliquez sur **File d'attente** → **Ajouter un élément**
2. Choisissez le type de carte
3. Saisissez le contenu recto/verso
4. Sélectionnez la catégorie
5. Cliquez sur **Créer**

#### Génération basée sur l'IA

Si vous avez configuré l'IA :

1. Sélectionnez un extrait ou une section de document
2. Cliquez sur **Générer des cartes**
3. L'IA créera automatiquement plusieurs cartes
4. Vérifiez et modifiez si nécessaire
5. Enregistrez les meilleurs

---

## Gestionnaire de pont

Le **Deck Manager** est une vue plein écran permettant de parcourir, d'inspecter et de modifier vos jeux de cartes mémoire et leurs cartes. Ouvrez-le à partir du bouton **Deck Manager** sur la page d'accueil de Review.

### Parcourir les decks

- La barre latérale gauche répertorie tous vos decks avec le nombre de cartes et les indicateurs d'échéance aujourd'hui.
- Cliquez sur un deck pour le développer : un seul deck est développé à la fois.
- Les filtres de balises pour chaque deck sont affichés sous forme de petites pilules sous le nom du deck.

### Liste des cartes

Lorsqu'un jeu est développé, ses cartes apparaissent dans une liste virtualisée et déroulante. Chaque rangée de cartes montre :

- **Badge d'État** - code couleur : bleu (Nouveau), orange (Apprentissage), vert (Révision), rouge (Réapprentissage)
- **Aperçu de la question** - jusqu'à 80 caractères
- **Date d'échéance** - étiquette relative (Aujourd'hui, Demain, 5j, en retard)
- **Difficulté** - 1 à 10 mini-barres de progression
- **Intervalle** - intervalle d'examen actuel en jours
- **Nombre de révisions** - combien de fois la carte a été révisée
- **Indicateur de sangsue** - icône d'avertissement jaune pour les cartes avec plus de 5 échecs

### Tri et filtrage

**Triez** les cartes par date d'échéance, état, difficulté, intervalle, nombre de révisions ou échecs. Cliquez à nouveau sur un bouton de tri pour basculer entre ordre croissant/décroissant.

**Filtrer** par :
- **État** - Nouveau, apprentissage, révision, réapprentissage
- **Statut dû** - Dû aujourd'hui, En retard, Non dû

**Recherchez** par texte de question ou par nom de balise à l'aide de la barre de recherche en haut.

### Éditeur de cartes en ligne

Cliquez sur n'importe quelle ligne de carte pour développer un éditeur en ligne en dessous :

- Modifiez directement **question**, **réponse** et **tags** - aucun modal n'est nécessaire.
- Les **Cartes Cloze** affichent le texte Cloze avec les plages de suppression en surbrillance.
- **Les types de cartes complexes** (à choix multiples, occlusion d'image) affichent un aperçu en lecture seule avec un lien "Modifier dans Studio".
- **Suspendre/Annuler la suspension** basculer en un seul clic.
- Les modifications sont enregistrées avec des **mises à jour optimistes** : l'interface utilisateur se met à jour instantanément et est annulée si la sauvegarde échoue.

### Panneau de statistiques de deck

La barre latérale droite affiche les statistiques du deck étendu :

- **Dû aujourd'hui** - nombre de cartes dues maintenant
- **Taux de rétention** - estimé sur la base du taux de déchéance
- **Difficulté moyenne** - sur toutes les cartes du jeu
- **Nombre de sangsues** - cartes avec plus de 5 erreurs (cliquez pour filtrer uniquement les sangsues)
- **Répartition de la maturité** - barre empilée affichant la répartition des cartes Nouveau/Apprentissage/Jeune/Mature
- **Prévisions sur 7 jours** : sparkline affichant le nombre d'échéances projetées pour la semaine prochaine
- **Santé de la mémoire FSRS** - stabilité et difficulté moyennes avec un indicateur de santé à code couleur

### Opérations groupées

Sélectionnez plusieurs cartes à l'aide des cases à cocher, puis utilisez la barre d'outils d'actions groupées :

- **Suspendre / Annuler la suspension** - suspension par lots
- **Supprimer** - supprime les cartes sélectionnées (avec confirmation)
- **Retag** : ajoutez ou supprimez des balises sur toutes les cartes sélectionnées à la fois

### Raccourcis clavier

| Clé | Actions |
|-----|--------|
| `Évasion` | Réduire l'éditeur en ligne ou réduire le deck développé |

---

## Processus de révision

### Démarrage d'une session de révision

1. Cliquez sur **Réviser** dans la barre latérale
2. Voir les cartes dues aujourd'hui (et à venir)
3. Cliquez sur **Démarrer l'examen** pour commencer

### Interface de révision

**Affichage de la carte :**
- Recto de la carte affiché (question ou invite)
- Appuyez sur **Espace** ou cliquez pour afficher la réponse
- La réponse apparaît ci-dessous

**Séances de révision mixtes (fiches + documents) :**
- Les sessions de révision peuvent inclure des **éléments d'apprentissage** et des **documents** qui doivent être lus.
- Lorsqu'un document apparaît, vous pouvez l'ouvrir directement depuis la fiche de session.
- Noter un document programme sa prochaine date de lecture, tout comme une carte programme sa prochaine révision.

**Interface d'évaluation :**
Après avoir révélé la réponse, quatre boutons d'évaluation apparaissent :

```
[Encore] [Difficile] [Bon] [Facile]
  ~10 min ~2j ~7j ~14j
```

Chaque bouton affiche la **prochaine date de révision** : il s'agit de la fonctionnalité **Intervalle de prévisualisation** !

**Actions de récupération (inspecteur de file d'attente de révision) :**
Utilisez-les lorsque le calendrier d'un élément d'apprentissage nécessite un coup de pouce rapide :

- **Intervalles de compression** : rapprochez la prochaine révision (intervalle plus court).
- **Reprogrammer intelligemment** : déplacez l'élément vers « à rendre maintenant ».
- **Fréquence de rétrogradation** : repoussez la révision suivante (intervalle plus long).

Ces actions s'appliquent aux **éléments d'apprentissage uniquement** et mettent à jour le calendrier immédiatement.

### Raccourcis clavier (mode révision)

| Clé | Actions |
|-----|--------|
| `Espace` | Afficher la réponse |
| '1' | Notez "Encore" |
| '2' | Noter "Difficile" |
| '3' | Noter « Bon » (par défaut recommandé) |
| '4' | Noter "Facile" |
| `Ctrl+Entrée` | Afficher la réponse |
| `Ctrl+1/2/3/4` | Évaluer sans afficher la réponse |
| `Échap` | Pause/fin de session |
| `Ctrl+E` | Modifier la carte actuelle (pas encore implémentée) |
| `Ctrl+D` | Supprimer la carte actuelle (également utilisée globalement pour « Aller au tableau de bord ») |

### Gestion des sessions

**Caractéristiques de la session de révision :**
- **Barre de progression** : affiche les cartes restantes
- **Suivi du temps** : affiche la durée de la session
- **Break Timer** : pauses facultatives toutes les N cartes
- **Limites de session** : définissez le nombre maximum de cartes ou la durée par session

**Fin d'une session :**
- Cliquez sur **Terminer** lorsque vous avez terminé
- Ou définir une limite (Paramètres → Révision → Limites de session)
- Les cartes inachevées restent dues pour la prochaine session

### Stratégies d'examen

#### Routine de révision quotidienne

1. **Séance du matin** (15-30 min)
   - Examiner les cartes à rendre du jour au lendemain
   - Concentrez-vous sur les éléments plus difficiles

2. **Séance du soir** (15-30 min)
   - Cartes de révision ajoutées pendant la journée
   - Créer de nouvelles cartes à partir de la lecture

#### Gestion du backlog

Si vous avez plusieurs cartes à rendre (>100) :

1. **Focus sur les nouvelles cartes** : limiter les révisions à 20-30/jour
2. **Utilisez des filtres** : examinez par catégorie (ne vous submergez pas)
3. **Cram Sessions** : séances de rattrapage du week-end
4. **Ajuster la rétention** : temporairement inférieur à 85 % (moins d'avis)

#### Gérer les cartes "Encore"

Les cartes notées « Encore » réapparaissent rapidement (10 min). Stratégies :

- **Réapprentissage immédiat** : révisez à nouveau les cartes au cours de la même session
- **Session séparée** : révisez à nouveau les cartes plus tard dans la journée
- **Comprendre les problèmes** : Si de nombreuses réponses sont négatives, la carte peut être mal rédigée

---

## Gestion des files d'attente

### Comprendre la file d'attente

La **file d'attente** contient tous les éléments dont la révision est programmée, organisés par :

- **Date d'échéance** : les éléments dus plus tôt apparaissent en premier
- **Priorité** : priorité définie par l'utilisateur (0-100)
- **Catégorie** : Domaine
- **Type de carte** : Flashcard, cloze, etc.

### Vues de la file d'attente

#### Vue due
Affiche les éléments dus aujourd'hui et en retard, triés par heure d'échéance

#### Vue programmée
Affiche tous les éléments planifiés, y compris les révisions futures

#### Nouvelle vue
Affiche les cartes nouvellement créées qui n'ont pas encore été examinées

### Opérations de file d'attente

**Filtrage :**
- Par catégorie (par exemple, "Afficher uniquement la programmation")
- Par type de carte (par exemple, "Afficher uniquement les cartes Cloze")
- Par plage de priorités (par exemple, "Afficher la priorité 80+")

**Tri :**
- Date d'échéance (par défaut)
- Priorité
- Difficulté
- Aléatoire (pour la variété)

**Actions groupées :**
1. Sélectionnez plusieurs éléments (cases à cocher)
2. Choisissez l'action :
   - **Changer de catégorie** : passer à une autre catégorie
   - **Définir la priorité** : priorité de mise à jour groupée
   - **Suspendre** : masquer temporairement les avis
   - **Supprimer** : Supprimer définitivement

### Système de priorité

Définissez la priorité de 0 à 100 sur n'importe quel élément :

- **100** : Critique (à apprendre)
- **80-90** : important
- **60-70** : Priorité normale
- **40-50** : Faible priorité
- **0-20** : Archive/référence

**Planification prioritaire :**
Les éléments plus prioritaires sont affichés plus fréquemment dans les avis mitigés.

### Files d'attente intelligentes

Créez des files d'attente personnalisées avec des filtres :

**Exemples de files d'attente :**
- "Aujourd'hui": cartes dues de la catégorie principale
- "Quick Review" : Cartes faciles, priorité < 50
- "Deep Dive" : Cartes rigides de la catégorie recherche
- "Exam Prep" : Toutes les cartes de la catégorie "Biologie"

**Création d'une file d'attente intelligente :**
1. Cliquez sur **File d'attente** → **Files d'attente enregistrées**.
2. Cliquez sur **Nouvelle file d'attente**
3. Définir les filtres et l'ordre de tri
4. Nommez et enregistrez

### Tag-Aware Scheduling (TAS)

<!-- English original below — please translate to French -->

Tag-Aware Scheduling adds semantic intelligence to the review queue.
When enabled in Settings, TAS applies two post-processing passes over
your due items without changing underlying SM-20/FSRS intervals:

- **Prerequisite Gating**: Blocks items whose tag prerequisites haven't
  reached the configured maturity threshold.  Foundational material is
  stabilized before advanced topics appear.
- **Interference Jitter**: Separates items sharing high-coherence tags
  by a minimum time window, reducing semantic interference during review.

TAS is **opt-in** and **non-destructive** — toggle it off at any time
to return to the default queue order.  Blocked or delayed items keep
their original due dates and intervals.

#### Enabling TAS

1. Open **Settings → Tag-Aware Scheduling**.
2. Toggle **Enable TAS** on.
3. Optionally enable/disable the **Interference** and **Prerequisites**
   subsystems independently.
4. Adjust each slider to your preference.

| Setting | Range | Default | Description |
|---|---|---|---|
| Minimum Separation | 0–24 h | 4 h | Hours between items sharing a high-coherence tag |
| Coherence Threshold | 0.50–1.00 | 0.75 | Only tags with coherence ≥ this are separated |
| Maturity Ratio | 0.50–1.00 | 0.70 | Fraction of items in a prerequisite tag that must be mature |

#### Setting Up Prerequisites

Tag prerequisites let you control the order in which topics surface:

1. Open **Tag Management** (from the media panel or library toolbar).
2. Click the **Prerequisites** button at the top.
3. Click a tag name to select it for editing.
4. In the editor panel, check the tags that must be learned **before**
   this tag's items can appear in the queue.
5. Click **Save Prerequisites**.

The **dependency graph** on the right visualizes relationships — arrows
point from prerequisite to dependent tag.  Circular dependencies are
detected and rejected at save time.

> **Note**: Tags are synced from your existing items automatically.
> If a tag doesn't appear, tag some items first, then reopen Tag
> Management — TAS will detect and register them.

#### Reading the Queue

When TAS is active, the queue header shows a **TAS Active** badge
with counts of ready and blocked items.

| Badge | Means |
|---|---|
| 🟡 "Waiting on `tag` maturity (45%)" | Blocked — a prerequisite tag is only 45% mature |
| 🔵 "Delayed to avoid interference with `tag`" | Delayed — an item sharing a high-coherence tag was recently scheduled |

#### Forcing Items

You can override TAS for individual items:

- Click the **Force show** link next to any blocked or delayed item
  to add it to the current review session immediately.
- The override is session-only — the item is re-evaluated against TAS
  rules in the next session.

#### How Coherence Is Computed

Coherence measures how semantically tight a tag's items are:

1. Use **Compute Semantic Graph** from the queue view.  This requires
   a configured embedding provider (OpenAI, Ollama, Cohere, OpenRouter).
2. Each item's title, content, and tags are sent to your chosen LLM
   provider and an embedding vector is stored.
3. After embedding, TAS automatically computes each tag's **centroid**
   (mean vector of all items with that tag) and **coherence** (average
   pairwise cosine similarity of those items).
4. Coherence values appear in Tag Management next to each tag.

Tags with no embeddings yet are treated as coherence = 0 — no
interference jitter is applied for those tags.

#### Tag Maturity

A tag is **mature** for an item when that item's SM-20/FSRS stability
meets or exceeds the tag's `maturityThreshold` (default 0.8).  The
overall maturity ratio is `matureCount / itemCount`.

- Progress bars in the Prerequisite Editor show each tag's current
  maturity ratio.
- Prerequisite gating uses the configured `maturityRatio` to decide
  whether a prerequisite tag is "satisfied" enough to unlock dependent
  tags for review.

#### Tips

- **Start with prerequisites only**. Keep interference jitter off until
  you've run the embedding pipeline and have coherence values.
- **Use granular tags**. `calculus.limits` → `calculus.derivatives` is
  more effective than one broad `calculus` tag.
- **Watch the block rate**. If many items sit blocked, lower the maturity
  ratio or simplify the prerequisite graph.
- **Force-show is your safety valve**. If TAS is too aggressive for a
  particular item, force-show it — no underlying scheduling data is harmed.

---

## Analyses et suivi des progrès

### Présentation du tableau de bord

Le tableau de bord Analytics fournit des informations complètes :

**Mesures clés :**
- **Cartes dues aujourd'hui** : numéro en attente d'examen
- **Total des cartes** : Toutes les cartes du système
- **Taux de rétention** : pourcentage mémorisé
- **Study Streak** : Jours d'activité consécutifs
- **Cartes apprises** : nombre total de cartes créées

### Graphiques d'activité

**Activité de 30 jours :**
- Graphique à barres affichant les avis par jour
- Code couleur par note (Encore/Difficile/Bon/Facile)
- Identifiez les modèles dans vos habitudes d'étude

**Courbe d'apprentissage :**
- Graphique linéaire montrant le nombre total de cartes au fil du temps
- Suivez la croissance de votre base de connaissances

### Statistiques

**Statistiques de révision :**
- Total des examens terminés
- Répartition moyenne des notes
- Avis par jour/semaine/mois

**Statistiques de la carte :**
- Total des cartes par catégorie
- Cartes par type (Flashcard, Cloze, etc.)
- Cartes nouvelles ou matures

**Mesures d'algorithme (FSRS/SM-18) :**
- Stabilité moyenne
- Difficulté moyenne
- Rétention prévue
- Performances de la mémoire

### Répartition des catégories

Afficher les performances par domaine :

- Cartes par catégorie
- Taux de rétention par catégorie
- Niveau d'activité par catégorie
- Identifier les points forts/faibles

### Buts et séquences

**Fixation d'objectifs :**
1. Cliquez sur **Analytics** → **Objectifs**.
2. Fixez des objectifs quotidiens/hebdomadaires :
   - Cartes à revoir
   - Cartes à créer
   - Temps d'étude
3. Suivez les indicateurs visuels de progrès

**Séries d'études :**
- Journées consécutives avec activité
- Série actuelle affichée sur le tableau de bord
- Entretenir des séquences de motivation

### Statistiques d'exportation

Exportez vos données pour analyse :

1. Cliquez sur **Analytics** → **Exporter**.
2. Choisissez le format :
   - **CSV** : compatible avec les feuilles de calcul
   - **JSON** : pour une analyse personnalisée
   - **PDF** : Rapport imprimable
3. Sélectionnez une plage de dates
4. Incluez des métriques (avis, cartes, rétention)

---

## Paramètres et personnalisation

### Paramètres d'apparence

#### Thèmes
- **147 thèmes intégrés** : 26 thèmes modernes et 121 thèmes hérités (sombre et clair)
- **Aperçu en direct** : consultez instantanément les changements de thème
- **Thèmes personnalisés** : créez vos propres combinaisons de couleurs

**Options de thème :**
- Modern Dark (sombre par défaut)
- Matériel vous (Conception matérielle 3)
- Lumière aurore
- Bleu glacier
- Nocturne Dark, Snow, Cartographer, Focus, et bien d'autres...

#### Création de thèmes personnalisés

1. Paramètres → Apparence → Personnaliser le thème
2. Ajustez les couleurs :
   - Couleur primaire
   - Couleur de fond
   - Couleur du texte
   - Couleurs accentuées
3. Enregistrer comme thème personnalisé
4. Exporter/importer des thèmes à partager

#### Options d'affichage
- **Mode dense** : affichez plus de contenu par écran
- **Famille de polices** : choisissez parmi 65 polices intégrées réparties en 5 catégories :
  - Sans empattement (25) : Inter, Poppins, Montserrat, Space Grotesk, et plus
  - Serif (5) : Merriweather, Playfair Display, Lora, Crimson Text, Bitter
  - Monospace (31) : JetBrains Mono, Fira Code, Source Code Pro, et plus
  Affichage (2) : Comic Neue, Major Mono Display
  - Système (4) : interface utilisateur système, système Serif, système Sans, système Mono
- **Taille de police** : Ajustez la taille du texte
- **Animation de carte** : activer/désactiver les animations
- **Afficher les intervalles d'aperçu** : afficher les prochaines dates de révision

### Paramètres d'apprentissage

#### Sélection d'algorithme

Incrementum prend en charge quatre algorithmes de planification. Choisissez celui qui correspond le mieux à votre style d'apprentissage :

**FSRS-6 (recommandé) :**
- Moderne, soutenu par la recherche
- S'adapte à la mémoire individuelle
- Prédit les temps d'oubli
- Meilleure rétention avec moins d'avis

**SM-20 (SuperMemo 20) :**
- Algorithme le plus avancé, obtenu par rétro-ingénierie de sm20.exe via Ghidra
- Prend en charge trois versions de formules d'intervalle (V2/V4/V6)
- Le lissage bayésien apprend les intervalles optimaux à partir de vos données de révision réelles
- Branche optionnelle de la famille FSRS avec modèle d'oubli à 3 experts
- Construit des connaissances au fil du temps via des matrices d'intervalle/compteur de 21×21×21

**SM-18 (SuperMémo 18) :**
- Dernier algorithme SuperMemo, rétro-ingénierie à partir de l'application d'origine
- Utilise une matrice de recherche 3D SInc (Stability Increase) en fonction de la difficulté, de la stabilité et de la récupérabilité
- Suivi explicite des difficultés avec mises à jour de la moyenne finale
- Modèle de courbe d'oubli exponentielle : `R = 0,9^(t/S)`
- Gestion sophistiquée des pannes avec réduction de la stabilité en fonction des déchéances

**SM-2 (Classique) :**
- Algorithme traditionnel SuperMemo 2 (documenté publiquement)
- Plus simple, prévisible
- Plus d'avis requis

#### Paramètres

**Rétention souhaitée :** 0,70 - 0,95
- **90 %** (par défaut) : équilibre la rétention et la charge de révision
- **85 %** : moins d'avis, un peu moins de rétention
- **95 %** : Rétention maximale, plus d'avis

**Apprendre par jour :** 10 à 100
- **20** (par défaut) : Gérable pour la plupart des utilisateurs
- **50** : Pour les périodes d'études intensives
- **10** : charge de révision légère

**Révision par jour :** 50 - 500
- **200** (par défaut) : limite quotidienne raisonnable
- **500** : pour éliminer le retard
- **50** : Jours de révision légers

#### Paramètres d'intervalle

**Nouveaux intervalles de carte :**
- Intervalle d'obtention du diplôme (bonne note) : 1 à 10 jours
- Intervalle facile : 3-21 jours
- Intervalle minimum : 1 jour

**Intervalle maximum :**
- Limiter les intervalles les plus longs (365 jours par défaut)
- Empêche les cartes d'être programmées trop loin

**Capuchon de sécurité long (Vidéos/Articles) :**
- Pour les vidéos/articles longs, les notes positives (« Bon »/« Facile ») tiennent compte de la couverture.
- Si vous passez moins de **25 %** de la durée estimée du contenu, l'intervalle suivant est limité à **1 jour**.
- Si vous dépensez moins de **50 %**, l'intervalle suivant est limité à **2 jours**.
- Si vous dépensez moins de **75 %**, l'intervalle suivant est limité à **4 jours**.
- Cela évite que le contenu long soit programmé trop loin après une progression partielle.
- Une fois appliqué, le motif du planificateur inclut une note **Plafond tenant compte de la durée** pour plus de transparence.

### Paramètres de révision

#### Limites de session**Délai :**
- Durée maximale de la session (minutes)
- Intervalles de pause
- Fin automatique après la limite

**Limites des cartes :**
- Nombre maximum de cartes par session
- Limite séparée pour les nouvelles cartes
- Encore une fois la limite de carte

#### Options de notation

**Raccourcis d'évaluation :**
- Personnaliser les raccourcis clavier
- Définir la note par défaut (touche Espace)
- Activer/désactiver les raccourcis de notation

**Avance automatique :**
- Passage automatique à la carte suivante après la notation
- Délai avant avance automatique (secondes)

### Paramètres généraux

#### Sauvegarde automatique
- Enregistrer l'intervalle (secondes)
- Économisez sur la notation de la carte
- Enregistrer sur le commutateur d'onglet

#### Documents récents
- Max articles récents (5-50)
- Effacer les documents récents

#### Catégorie par défaut
- Définir la catégorie pour les nouveaux éléments
- Peut être remplacé par article

#### Statistiques
- Suivre le temps d'examen
- Suivre le nombre de cartes
- Intervalle de mise à jour (en temps réel ou périodique)

### Paramètres de synchronisation

#### Synchronisation du navigateur
- Activer/désactiver la synchronisation des extensions de navigateur
- Intervalle de synchronisation (minutes)
- Résolution de conflits (victoires locales / victoires à distance / demande)

#### Synchronisation avec le cloud

**Fournisseurs pris en charge :**
- Boîte de dépôt
- Google Drive
-OneDrive

**Options de synchronisation :**
- Synchronisation automatique sur les modifications
- Intervalle de synchronisation (manuel, 15 min, 30 min, 1 h)
- Synchronisation au démarrage/fermeture de l'application
- Gestion des conflits

#### Sauvegarde et restauration

Incrementum fournit un système complet de sauvegarde et de restauration pour protéger vos données d'apprentissage et migrer entre les appareils.

#### Sauvegarde complète de l'application

**Ce qui est sauvegardé :**
- **Paramètres** : Toutes les préférences, thèmes, paramètres d'apprentissage
- **Documents** : tous les documents importés avec métadonnées
- **Extraits** : tous les faits saillants et le contenu extrait
- **Éléments d'apprentissage** : toutes les flashcards, suppressions de cloze, cartes questions-réponses
- **Données de planification** : états de la mémoire de l'algorithme (stabilité, difficulté, intervalles), dates d'échéance
- **Collections** : toutes les collections et affectations de documents
- **État de l'interface utilisateur** : état de la barre latérale, préférences de thème
- **Facultatif** : fichiers de documents réels (PDF, EPUB, etc.)

**Création d'une sauvegarde :**

1. Accédez à **Paramètres → Importer/Exporter → Sauvegarde complète de l'application**
2. Cliquez sur **Ouvrir la sauvegarde et la restauration**
3. Sélectionnez **Exporter la sauvegarde**
4. Ajoutez une étiquette facultative (par exemple, "Avant de reformater le PC")
5. Choisissez si vous souhaitez inclure les fichiers de documents :
   - **Métadonnées uniquement** : fichier plus petit (~ Ko-Mo), réimportez les fichiers séparément
   - **Inclure les fichiers** : fichier plus volumineux (~ Mo-Go), sauvegarde autonome complète
6. Cliquez sur **Exporter la sauvegarde** et enregistrez le fichier `.incrementum`

**Format de fichier :**
- Extension : `.incrementum`
- Format : JSON avec commentaire d'en-tête
- Dénomination : `incrementum-backup-[label]-[date]-[time].incrementum`

**Restauration à partir d'une sauvegarde :**

1. Accédez à **Paramètres → Importer/Exporter → Sauvegarde complète de l'application**
2. Cliquez sur **Ouvrir la sauvegarde et la restauration**
3. Sélectionnez **Importer la sauvegarde**
4. Choisissez votre fichier `.incrementum`
5. Prévisualisez le contenu de la sauvegarde :
   - Nombre de documents
   - Compte d'extraits
   - Nombre d'éléments d'apprentissage
   - Nombre de collectes
   - Si les fichiers sont inclus
6. Configurez les options d'importation (facultatif) :
   - **Ce qu'il faut importer** : choisissez des types de données spécifiques
   - **Gestion des doublons** : ignorer, remplacer ou fusionner
   - **Importer des fichiers** : s'il faut restaurer les fichiers de documents
7. Cliquez sur **Importer la sauvegarde**
8. Attendez la fin de l'importation (progression affichée)

**Stratégies de gestion des doublons :**
- **Ignorer** : ignorer les éléments qui existent déjà (recommandé dans la plupart des cas)
- **Remplacer** : écraser les éléments existants avec des versions de sauvegarde
- **Fusion** : créez de nouvelles copies de tous les éléments (peut créer des doublons)

**Cas d'utilisation :**| Scénario | Approche recommandée |
|----------|-----------|
| **Migrer vers un nouvel ordinateur** | Exporter avec des fichiers, importer sur une nouvelle machine |
| **Sauvegarde avant les changements majeurs** | Sauvegarde rapide des métadonnées uniquement |
| **Synchronisation entre appareils** | Flux de travail d'exportation/importation |
| **Partager des collections** | Exporter des collections spécifiques |
| **Archiver les anciennes données** | Exporter et stocker à long terme |
| **Restaurer après reformatage** | Importer une sauvegarde complète avec des fichiers |

**Remarques importantes :**
- **Préservation de la planification** : toutes les données de planification (stabilité, difficulté, dates d'échéance) pour tous les types d'algorithmes sont conservées exactement
- **Chemins de fichiers** : lors de l'importation sans fichiers, vous devrez réimporter les documents originaux. Incrementum les fera correspondre par hachage de contenu et restaurera les métadonnées
- **Compatibilité des versions** : les sauvegardes sont rétrocompatibles mais peuvent ne pas fonctionner avec les anciennes versions de l'application
- **Stockage** : protégez les sauvegardes : elles contiennent vos données d'apprentissage personnelles

#### Options de sauvegarde héritées

**Sauvegardes automatiques :**
- Fréquence de sauvegarde (quotidienne, hebdomadaire)
- Sauvegardes maximales à conserver (5-50)
- Emplacement de sauvegarde

**Sauvegarde manuelle :**
- Paramètres → Sauvegarde → Créer une sauvegarde
- Choisissez l'emplacement
- Comprend toutes les données et paramètres

**Restaurer :**
- Paramètres → Sauvegarde → Restaurer
- Sélectionnez le fichier de sauvegarde
- Confirmer la restauration (remplace les données actuelles)

### Raccourcis clavier

#### Raccourcis globaux

| Raccourci | Actions |
|--------------|--------|
| `Ctrl+K` | Ouvrir la palette de commandes |
| `Ctrl+P` | Ouvrir la palette de commandes (alternative) |
| `Ctrl+,` | Ouvrir les paramètres |
| `Ctrl+D` | Aller au tableau de bord |
| `Ctrl+Q` | Aller à la file d'attente |
| `Ctrl+R` | Lancer l'évaluation |
| `Ctrl+O` | Ouvrir le document |
| `Ctrl+N` | Document d'importation (alternative) |

#### Personnalisation

1. Paramètres → Raccourcis clavier
2. Sélectionnez l'action à remapper
3. Appuyez sur une nouvelle combinaison de touches
4. Enregistrez les modifications

**Réinitialiser les paramètres par défaut :** Cliquez sur le bouton « Réinitialiser tout »

### Paramètres d'intégration

#### Intégration Anki

**Configuration :**
1. Paramètres → Intégrations → Anki
2. Configurez l'URL AnkiConnect (par défaut : `http://localhost:8765`)
3. Tester la connexion
4. Activer la synchronisation bidirectionnelle

**Options de synchronisation :**
- Synchronisation avec Anki lors de la création de cartes
- Intervalles de synchronisation d'Anki
- Cartographie du deck (catégorie Incrementum → deck Anki)
- Synchronisation des balises

#### Intégration d'obsidienne

**Configuration :**
1. Paramètres → Intégrations → Obsidienne
2. Définir le chemin du coffre-fort
3. Configurer le modèle
4. Activer la synchronisation

**Fonctionnalités de synchronisation :**
- Exporter des cartes vers des notes Obsidian
- Importer des notes sous forme de cartes
- Intégration des notes quotidiennes
- Synchronisation des balises bidirectionnelles

#### Intégration NotebookLM

Utilisez NotebookLM dans Incrementum pour rechercher, générer des artefacts d'étude et enregistrer des extraits révisables.

**Configuration :**
1. Paramètres → Fonctionnalités → activer **NotebookLM**
2. Paramètres → Intégrations → **NotebookLM**
3. Cliquez sur **Connect** et choisissez le fournisseur (`mock` pour les tests, `cli` pour Live NotebookLM)
4. Sélectionnez ou créez un bloc-notes actif

**Ce que vous pouvez faire :**
- Posez des questions dans le chat NotebookLM directement depuis Incrementum
- Exécuter des invites de recherche (recherche de cahiers assistée par Web)
- Générer des artefacts :
  - Cartes mémoire
  - Quiz
  - Rapport / Guide d'étude
  - Carte mentale
  - Tableau de données
  - Aperçu audio
  - Aperçu vidéo
- Prévisualisez les artefacts dans l'application (y compris les lecteurs audio/vidéo lorsque le média est disponible)
- Synchronisez les flashcards/éléments de quiz générés dans la file d'attente de révision Incrementum**Enregistrer les réponses au chat sous forme d'extraits :**
1. Ouvrez le chat de l'espace de travail NotebookLM
2. Sur n'importe quelle réponse de l'assistant, cliquez sur **Enregistrer en tant qu'extrait**.
3. Facultatif : mettez d'abord en surbrillance une partie de la réponse pour enregistrer uniquement le texte sélectionné.
4. Incrementum crée un extrait lié à NotebookLM avec des métadonnées thread/source
5. Les réponses enregistrées affichent un indicateur **déjà enregistré** pour éviter les doublons

**Questions et réponses sur les documents + flux de travail NotebookLM :**
1. Ouvrez un document dans Incrementum
2. Utilisez **Document Q&A** avec le mode de recherche NotebookLM
3. Modifier/affiner le texte de réponse généré en ligne
4. Créez des extraits de la réponse affinée
5. Générez des flashcards/cloze/éléments de questions-réponses à partir de ces extraits

**Dépannage :**
- Si l'aperçu de l'artefact indique que le média n'est pas disponible, attendez la fin de la génération NotebookLM et rouvrez l'artefact.
- Si vous utilisez le fournisseur `cli`, assurez-vous que le side-car/CLI NotebookLM est disponible dans votre build.
- Si vous avez changé de fournisseur ou si l'authentification a expiré, reconnectez-vous dans Intégrations → NotebookLM.

#### Serveurs MCP

**Serveurs MCP (Model Context Protocol) :**

Connectez jusqu'à 3 serveurs MCP pour des fonctionnalités basées sur l'IA :

1. Paramètres → AI → Serveurs MCP
2. Ajouter l'URL du serveur
3. Configurer l'authentification
4. Activez les fonctionnalités :
   - Génération de carte à puce
   - Résumé du contenu
   - Aide aux questions et réponses
   - Marquage automatique

### Paramètres IA

#### Fournisseurs d'assurance qualité

Configurez les fournisseurs d'IA pour la génération de cartes :

**Fournisseurs pris en charge :**
-OpenAI (GPT-4, GPT-3.5)
- Anthropique (Claude)
- Ollama (modèles locaux comme Llama, Mistral, Qwen)
- OpenRouter (accès à de nombreux modèles, y compris les niveaux gratuits)
- llama.cpp / vLLM (n'importe quel modèle GGUF via API compatible OpenAI)
- Points de terminaison d'API personnalisés

**Paramètres par fournisseur :**
- Clé API
- Nom du modèle
- Température (créativité)
- Nombre maximum de jetons
- Invite système

#### Génération automatique

**Génération de carte :**
- Activer la génération automatique à partir d'extraits
- Nombre de cartes par extrait
- Seuil de qualité
- Exiger une approbation manuelle

**Résumé :**
- Résumer automatiquement de longs extraits
- Longueur du résumé (court, moyen, long)
- Inclure dans le contenu de la carte

#### Fenêtre contextuelle

**Limites des jetons :**
- Max jetons par demande
- Contexte des cartes associées
- Longueur de l'extrait de document

---

## Fonctionnalités avancées

### Graphique de connaissances

Visualisez les liens entre vos connaissances :

**Vue graphique 2D :**
- Nœuds : Documents, extraits, fiches
- Bords : Relations (même catégorie, tags, références)
- Disposition dirigée par la force
- Navigation interactive

**Sphère de connaissances 3D :**
- Visualisation 3D immersive
- Rotation, zoom, panoramique
- Code couleur par catégorie
- Cliquez sur les nœuds pour afficher le contenu

**Caractéristiques :**
- Rechercher et filtrer
- Mettre en surbrillance les éléments associés
- Exporter sous forme d'image
- Identifier les lacunes dans les connaissances

### Lecteur RSS

Apprenez de vos flux préférés :

#### Répertoire des newsletters

Découvrez et abonnez-vous aux newsletters populaires directement dans Incrementum :

**Accédez au répertoire des newsletters :**
1. Cliquez sur l'onglet **RSS**
2. Cliquez sur l'**icône Newsletter** (📬) dans l'en-tête.
3. Parcourez les newsletters organisées par catégorie

**Catégories de newsletter :**
- **Technologie** : Actualités technologiques, programmation, IA
- **Science** : Recherche, découvertes, connaissances scientifiques
- **Finance** : Investissements, marchés, finances personnelles
- **Business** : Entrepreneuriat, stratégie, création d'entreprise
- **Santé** : Bien-être, médecine, mode de vie sain
- **Lifestyle** : Culture, voyages, gastronomie, développement personnel
- **Politique** : Politique, gouvernance, actualité
- **Arts et littérature** : livres, art, musique, écriture créative
- **Éducation** : apprentissage, enseignement, connaissances académiques
- **Crypto & Web3** : Blockchain, DeFi, actualités cryptomonnaies

**Abonnement aux newsletters :**
1. Parcourez l'annuaire ou recherchez une newsletter
2. Cliquez sur **S'abonner** sur n'importe quelle newsletter
3. Le flux est automatiquement ajouté à vos abonnements RSS
4. De nouveaux numéros apparaîtront dans votre lecteur RSS

**Découverte du flux de newsletter :**

Incrementum peut découvrir automatiquement les flux RSS des plateformes de newsletter populaires :

- **Substack** : ajoutez `/feed` à n'importe quelle URL de sous-pile
  - Exemple : `https://author.substack.com` → `https://author.substack.com/feed`
- **Beehiiv** : découvre automatiquement le point de terminaison `/feed`
- **Blogs fantômes** : découverte automatique du point de terminaison `/rss/`
- **Buttondown** : Ajoutez `/feed` à l'URL de la newsletter
- **Générique** : découvre automatiquement les flux RSS à partir des balises HTML `<link>`

**Abonnez-vous rapidement à partir de l'URL :**
1. Copiez n'importe quelle URL de newsletter
2. Cliquez sur **Ajouter un flux** dans l'onglet RSS
3. Collez l'URL
4. Incrementum découvre automatiquement le flux RSS
5. Cliquez sur **Ajouter un flux** pour vous abonner

**Recherche des flux RSS de la newsletter :**

La plupart des plateformes de newsletter publient des flux RSS :

| Plateforme | Modèle de flux RSS | Exemple |
|--------------|--------|---------|
| Sous-pile | `https://[auteur].substack.com/feed` | `https://stratechery.substack.com/feed` |
| Beehiiv | `https://[newsletter].beehiiv.com/feed` | `https://banklesshq.beehiiv.com/feed` |
| Fantôme | `https://[blog].ghost.io/rss/` | `https://blog.ghost.io/rss/` |
| Boutonnée | `https://buttondown.email/[nom]/feed` | `https://buttondown.email/newsletter/feed` |

**Plateformes prises en charge :**
- Sous-pile (la plupart des newsletters)
- Beehiiv
- Blogs fantômes
- Boutonné
- ConvertKit
-Revue
- Publications moyennes
- Sites WordPress (génériques)

**Abonnements à la newsletter d'importation/exportation :**
- **OPML Import** : Importer depuis d'autres lecteurs RSS
- **Export OPML** : sauvegardez vos abonnements à la newsletter
- Partager des abonnements entre appareils

#### Gestion des flux

1. Cliquez sur l'onglet **RSS**
2. Cliquez sur **Ajouter un flux**
3. Saisissez l'URL du flux
4. Définir l'intervalle de mise à jour
5. Activer l'importation automatique dans la file d'attente

**Fonctionnalités du flux :**
- Sondage automatique pour les nouveaux articles
- Importer des articles sous forme de documents
- Extraire automatiquement les points clés
- Créer des cartes à partir de flux**Flux recommandés :**
- Sites d'information (BBC, CNN, etc.)
- Blogs dans votre domaine
- Revues de recherche
- Actualité technologique (Hacker News, Ars Technica)

### Intégration YouTube

**Importation vidéo :**
1. Copiez l'URL de YouTube
2. Importer en tant que document
3. Incrementum récupère :
   - Métadonnées vidéo
   - Transcription (si disponible)
   - Informations sur le chapitre
   - Commentaires (facultatif)

**Caractéristiques de la transcription :**
- Transcription complète consultable
- Créer des extraits de transcription
- Synchroniser la transcription avec la vidéo
- Créer des cartes avec des horodatages

**Panneau de fonctionnalités vidéo :**
- Ouvrez le bouton **Panneaux** dans la visionneuse vidéo
- Onglets pour les signets, les chapitres, la transcription
- Les signets enregistrent les horodatages pour des sauts rapides
- Les chapitres peuvent être récupérés sur YouTube

**Extraits vidéo :**
1. Ouvrez les **Panneaux** → **Extraits vidéo**.
2. Cliquez sur **Nouveau**
3. Définir le début/la fin et le texte de transcription facultatif
4. Enregistrez pour créer un clip réutilisable

**Intégration SponsorBlock :**
- Sauter automatiquement les segments sponsorisés
- Filtrage par catégorie
- Contribuer à SponsorBlock

**Suivi des progrès :**
- Reprendre de la dernière position
- Marquer les sections regardées
- Regarder l'historique

### Transcription vidéo locale (application de bureau)

Générez des transcriptions pour les fichiers vidéo locaux dans l'application de bureau Tauri.

1. Ouvrez une vidéo locale
2. Ouvrez les **Panels** → **Transcription**.
3. Choisissez un modèle et une langue
4. Cliquez sur **Générer une transcription**

Remarques :
- La transcription s'exécute localement sur votre machine
- Nécessite un chemin de fichier local (non disponible pour les vidéos Web uniquement)

### Transcription de livres audio (application de bureau)

Créez des transcriptions pour les livres audio afin de permettre la sélection et la synchronisation du texte.

1. Importer un livre audio
2. Ouvrez la visionneuse de livres audio
3. Cliquez sur **Démarrer la transcription locale**
4. Surveillez les progrès et ouvrez le panneau de transcription

Remarques :
- La transcription s'exécute localement sur votre machine
- Les modèles sont gérés dans **Paramètres → Transcription audio**

### OCR (reconnaissance optique de caractères)

Extraire le texte des images :

**Fournisseurs pris en charge :**
- GLM-OCR (Local) - OCR multimodal via llama.cpp ou vLLM
- Tesseract (local)
- Google Cloud Vision
- Texte AWS
- Vision par ordinateur Azure
- Marqueur (local) - PDF vers Markdown
- Nougat (Local) - documents scientifiques avec mathématiques

**Cas d'utilisation :**
- Capture d'écran
- Documents numérisés
- Images avec texte
- Notes manuscrites

**Configuration (fournisseurs cloud) :**
1. Paramètres → ROC
2. Choisissez le fournisseur (Google, AWS ou Azure)
3. Configurez la clé API et les informations d'identification
4. Sélectionnez la ou les langues
5. Testez avec un exemple d'image

**Configuration (GLM-OCR avec lama.cpp) :**

llama.cpp fournit un serveur LLM local léger pour GLM-OCR sans nécessiter de GPU. Il utilise l'API compatible OpenAI sur le port 8080.

1. **Construisez llama.cpp** (s'il n'est pas déjà construit) :
   ```bash
   clone git https://github.com/ggml-org/llama.cpp.git
   cd lama.cpp
   cmake -B construire
   cmake --build build --config Release -j$(nproc)
   ```

2. **Télécharger un modèle multimodal** (format GGUF) :
   ```bash
   # Qwen2.5-VL (recommandé pour l'OCR)
   huggingface-cli télécharger bartowski/Qwen2.5-VL-7B-Instruct-GGUF \
     Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf --local-dir models/
   ```

3. **Démarrez le serveur** :
   ```bash
   ./build/bin/llama-server \
     -m modèles/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf \
     --port 8080 --host 0.0.0.0 -c 16384 -t $(nproc)
   ```

4. **Configurer dans Incrementum** :
   - Paramètres → OCR → Fournisseur : **GLM-OCR (Local)**
   - Backend : **vLLM (GPU)** (c'est le mode llama.cpp/vLLM - fonctionne pour les deux)
   - Point de terminaison : `http://localhost:8080/v1`
   - Modèle : votre nom de fichier de modèle (par exemple, `Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf`)**Conseils de performances :**
- Utilisez `-c 16384` ou supérieur pour les documents longs (4096 par défaut est trop petit pour la plupart des tâches OCR)
- Utilisez `-t $(nproc)` pour utiliser tous les threads du CPU
- La quantification Q4_K_M offre le meilleur compromis qualité/vitesse pour l'inférence CPU
- Pour l'accélération GPU, créez llama.cpp avec le support CUDA, Metal ou Vulkan

**Configuration (GLM-OCR avec vLLM) :**

vLLM fournit une inférence accélérée par GPU pour les modèles plus grands. Nécessite un GPU NVIDIA avec suffisamment de VRAM.

```bash
pip install -U vllm
vllm serve zai-org/GLM-OCR --allowed-local-media-path / --port 8080
```

Configurez ensuite Incrementum de la même manière (point de terminaison `http://localhost:8080/v1`).

**Configuration (GLM-OCR avec Ollama) :**

L'option la plus simple pour démarrer : Ollama gère automatiquement les téléchargements et l'exécution des modèles.

1. Paramètres → OCR → Fournisseur : **GLM-OCR (Local)**
2. Backend : **Ollama (CPU)**
3. Cliquez sur **Télécharger Ollama** (s'il n'est pas installé)
4. Cliquez sur **Démarrer l'exécution**
5. Définir le modèle (par exemple, `llava:7b` ou `qwen2-vl:7b`)
6. Cliquez sur **Tirer le modèle**

**OCR mathématique :**
- Gestion spécialisée des équations
- Sortie LaTeX
- Reconnaissance des symboles
- Idéal pour : articles scientifiques, manuels scolaires

### Palette de commandes

Accès rapide à toutes les commandes :

**Ouvrir :** `Ctrl+K` (ou `Cmd+K` sur Mac)

**Caractéristiques :**
- Recherche floue
- Navigation au clavier
- Commandes récemment utilisées
- Recherche par nom ou raccourci
- Les résultats de la recherche accèdent à l'emplacement correspondant dans les documents et mettent en surbrillance la requête (PDF, EPUB, Web Imports)
- Les correspondances de transcription YouTube recherchent l'horodatage et démarrent la lecture
- Survolez le résultat d'un document pour voir des correspondances supplémentaires du même document

**Commandes communes :**
- "Importer un document"
- "Démarrer la révision"
- "Créer une carte"
- "Ouvrir les paramètres"
- "Exporter des données"

### Mode Vimium

Navigation au clavier de style Vim pour les utilisateurs expérimentés :

**Activer :** Paramètres → Raccourcis clavier → Activer Vimium

**Navigation :**
- `j` / `k` : Défiler vers le bas/vers le haut
- `h` / `l` : Défilement vers la gauche/droite
- `gg` : Aller en haut
- `G` : Aller en bas
- `/` : Recherche
- `n` / `N` : résultat de recherche suivant/précédent

**Actions :**
- `f` : astuces de lien (éléments cliquables)
- `i` : entrez en mode de saisie
- `Escape` : Quitter le mode de saisie

**Personnalisation :**
- Remapper les clés
- Créer des commandes personnalisées
- Partager les configurations de raccourcis clavier

### Recherche et filtrage

Recherche avancée sur tout le contenu :

**Recherche en texte intégral :**
- Rechercher le contenu de la carte, les extraits, les documents
- Opérateurs booléens (ET, OU, NON)
- Recherche d'expression ("expression exacte")
- Caractères génériques (carte*)

**Filtres de recherche :**
- `category:programming` : Recherche dans la catégorie
- `tag:urgent` : Recherche par tag
- `type:cloze` : Recherche par type de carte
- `due:today` : recherche des cartes dues
- `rating:again` : recherche par note

**Recherches enregistrées :**
1. Effectuer une recherche
2. Cliquez sur « Enregistrer la recherche »
3. Nommez et enregistrez
4. Accès depuis le menu déroulant de recherche

### Extension du navigateur

Connectez Incrementum à la navigation Web :

**Caractéristiques :**
- Mettre en surbrillance des pages Web
- Créer des extraits d'articles
- Synchronisation avec l'application de bureau
- Ajout rapide à la file d'attente
- Avis basés sur un navigateur

**Configuration :**
1. Installer l'extension (Chrome/Firefox)
2. Associez-le à l'application de bureau
3. Accorder des autorisations
4. Commencez à utiliser !

**Utilisation :**
- Sélectionnez le texte sur la page Web
- Cliquez sur l'icône d'extension
- Choisissez "Ajouter à l'incrémentum"
- Se synchronise automatiquement

---

## Conseils et bonnes pratiques

### Création de cartes

**FAIRE :**
- Rendre les cartes spécifiques (un fait par carte)
- Utiliser un langage simple et clair
- Inclure le contexte dans les réponses
- Ajouter des exemples pertinents
- Utilisez Cloze pour les relations
- Gardez les questions concises

**À NE PAS FAIRE :**
- Mettez plusieurs faits sur une seule carte
- Utiliser des termes vagues
- Posez des questions trop faciles ou trop difficiles
- Copier de gros blocs de texte
- Utiliser des abréviations sans définition

**Exemple - Mauvaise carte :**
```
Q : Quelle est la fonction des mitochondries et comment
est-ce lié à la production d'ATP dans la respiration cellulaire ?
R : [Explication du paragraphe]
```

**Exemple - Bonnes cartes :**
```
Carte 1 :
Q : Quelle est la fonction principale des mitochondries ?
A : Produire de l'ATP par la respiration cellulaire

Carte 2 :
Q : Quel processus les mitochondries utilisent-elles pour produire de l'ATP ?
A : Respiration cellulaire (aérobie)

Carte 3 :
Q : Quelle est la monnaie énergétique produite par les mitochondries ?
A : ATP (adénosine triphosphate)
```

### Programme d'étude

**Horaire quotidien (20-30 min) :**
1. **Matin** : Révision des cartes dues (15 min)
2. **Tout au long de la journée** : créez des extraits de lecture
3. **Soirée** : Créez des cartes à partir d'extraits (10-15 min)

**Horaire hebdomadaire :**
- **Lun-Ven** : révisions régulières et création de cartes
- **Samedi** : séances d'étude plus longues (1-2 heures)
- **Dimanche** : examinez les analyses, ajustez les objectifs, organisez

**Gestion de gros volumes :**
- Définir une limite de révision quotidienne (par exemple, 50 cartes)
- Prioriser par catégorie (se concentrer sur un sujet)
- Utilisez des files d'attente intelligentes pour répartir les tâches
- Faites des pauses toutes les 20-30 minutes

### Optimisation de la rétention

**Améliorer le taux de rétention :**
- Évaluez honnêtement (ne gonflez pas les notes)
- Révisez de manière cohérente (quotidiennement, c'est mieux)
- Dormez suffisamment (la mémoire se consolide pendant le sommeil)
- Rappel actif (ne regardez pas, réfléchissez d'abord)
- Revues espacées (ne pas bourrer)

**Faire face à l'oubli :**
- Normal d'oublier 10-20 % (en fonction de la rétention cible)
- Les cartes "Encore" sont des opportunités d'apprentissage
- En cas d'oubli fréquent (>30 %), pensez à :
  - Diminution de la rétention souhaitée (85-90%)
  - Créer des cartes plus simples
  - Ajout de plus de contexte
  - Réviser plus fréquemment

### Organisation de la catégorie

**Meilleures pratiques :**
- Commencez large, puis subdivisez
- Exemple : `Programmation` → `Programmation/Python` → `Programmation/Python/Async`
- Utiliser une dénomination cohérente
- N'en créez pas trop (5-10 est gérable)
- Fusionner les catégories inutilisées

**Exemple de structure de catégorie :**
```
├── Programmation
│ ├── Python
│ ├── Rouille
│ └── Algorithmes
├── Langues
Espagnol
│ └── Japonais
├── Sciences
│ ├── Physique
│ └── Biologie
└── Professionnel
    ├── Gestion de projet
    └── Conception du système
```

### Gestion des priorités

**Directives prioritaires :**
- **100 (Critique)** : Préparation aux examens, projets de travail urgents
- **80-90 (Élevé)** : Cours actuels, apprentissage actif
- **60-70 (Moyen)** : Intérêts continus, connaissances générales
- **40-50 (Bas)** : Agréable à savoir, supplémentaire
- **0-20 (Archive)** : référence uniquement, rarement examiné

**Planification prioritaire :**
- Concentrez-vous sur la priorité 80+ pour les examens quotidiens
- Révisez 60-70 tous les quelques jours
- Révision 40-50 par semaine
- Révision 0-20 mensuellement ou à la demande

### Utilisation des intervalles d'aperçu

La fonction **Intervalle de prévisualisation** vous indique exactement quand chaque carte apparaîtra ensuite pour les quatre évaluations.

**Comment utiliser :**
1. Lisez la carte
2. Vérifiez les intervalles d'aperçu sous les boutons d'évaluation
3. Choisissez la note en fonction de :
   - Votre rappel actuel
   - Dans combien de temps tu veux le revoir
   - Votre emploi du temps (par exemple, examen à venir)**Exemple de stratégie :**
- Examen dans 2 semaines : Notez « Facile » sur les cartes importantes pour les revoir bientôt
- Journée chargée : notez "Bon" ou "Facile" pour espacer les avis
- Vous voulez maîtriser : notez "Difficile" pour réviser plus fréquemment

### Gérer le dépassement de soi

**Trop de cartes dues ?**
1. Définir la limite de révision (Paramètres → Révision → Max par jour)
2. Concentrez-vous sur les éléments hautement prioritaires
3. Suspendre temporairement les catégories peu prioritaires
4. Envisagez de réduire légèrement la rétention souhaitée

**Trop de contenu à traiter ?**
1. Importez les documents progressivement
2. Extrayez uniquement les points clés (pas tout)
3. Créez des cartes de manière sélective
4. Utilisez des catégories pour organiser

**Burn-out ?**
1. Faites une pause (c'est bon !)
2. Réduisez les limites quotidiennes
3. Suspendre les catégories non critiques
4. Concentrez-vous sur une catégorie à la fois

---

## Dépannage

### Problèmes courants

#### Les cartes n'apparaissent pas dans la révision

**Causes possibles :**
- Toutes les cartes examinées pour aujourd'hui
- Cartes suspendues
- Filtrer les cartes masquées actives

**Solutions :**
1. Vérifiez le nombre de « échéances » dans l'onglet Révision.
2. Vérifier la file d'attente → Assurez-vous que les cartes ne sont pas suspendues
3. Effacer les filtres
4. Vérifiez la date de révision (peut-être les cartes prévues pour le futur)

#### Mauvais taux de rétention

**Symptômes :** Oubli de nombreuses cartes, évaluations fréquentes « Encore »

**Solutions :**
1. **Évaluer la qualité des cartes** : Les cartes sont-elles claires ? Un fait par carte ?
2. **Rétention souhaitée inférieure** : essayez 85 % au lieu de 90 %
3. **Révisez plus fréquemment** : critiques quotidiennes, pas de bourrage
4. **Ajouter un contexte** : plus d'informations dans les réponses
5. **Simplifier les cartes** : divisez les cartes complexes en cartes plus simples

#### Conflits de synchronisation

**Symptômes :** Cartes en double, incohérences de données après la synchronisation

**Solutions :**
1. Choisissez la stratégie de résolution des conflits (Paramètres → Sync)
   - **Gains locaux** : conservez vos modifications
   - **Gagnements à distance** : Acceptez les modifications du serveur
   - **Demander** : résoudre manuellement chaque conflit
2. Synchronisez régulièrement pour minimiser les conflits
3. Utilisez un appareil principal

#### Échecs de l'importation

**Symptômes :** L'importation de documents échoue ou contient des erreurs

**Solutions :**
1. **Vérifiez le format du fichier** : assurez-vous que le format est pris en charge (PDF, EPUB, etc.)
2. **Vérifier la taille du fichier** : les fichiers très volumineux peuvent expirer
3. **Vérifiez l'URL** : certains sites bloquent l'accès automatisé
4. **Vérifiez Internet** : l'importation d'URL nécessite une connexion
5. **Essayez une alternative** : utilisez le copier-coller pour le contenu Web

#### Problèmes de performances

**Symptômes :** Chargement lent, décalage, blocage

**Solutions :**
1. **Grande base de données** : Archivez les anciennes cartes (Paramètres → Données → Archiver)
2. **Beaucoup d'images** : les images ralentissent le chargement
3. **Ressources système** : fermez les autres applications
4. **Reconstruire la base de données** : Paramètres → Données → Reconstruire (dernier recours)

#### L'OCR ne fonctionne pas

**Symptômes :** L'OCR échoue ou produit des résultats médiocres

**Solutions :**
1. **Vérifiez la clé API** : valide et dispose de crédits (fournisseurs de cloud)
2. **Vérifiez la qualité de l'image** : les images claires et haute résolution fonctionnent mieux
3. **Vérifier la langue** : Corriger la langue sélectionnée
4. **Essayez un fournisseur alternatif** : certains fonctionnent mieux pour certains contenus
5. **OCR local** : utilisez Tesseract en cas de problèmes Internet

#### lama.cpp ne répond pas

**Symptômes :** "Erreur d'appel de LLM" ou connexion refusée à localhost :8080

**Solutions :**
1. **Vérifiez si le serveur est en cours d'exécution** : `curl http://localhost:8080/v1/models`
2. **Démarrez le serveur** : voir [Configuration OCR](#ocr-optical-character-recognition) ci-dessus
3. **Taille du contexte trop petite** : redémarrez avec `-c 16384` ou supérieur
4. **Port utilisé** : un autre processus utilise peut-être le port 8080 ; vérifiez avec `lsof -i :8080`
5. **Mémoire insuffisante** : utilisez une quantification plus petite (Q3_K_M au lieu de Q4_K_M) ou un modèle plus petit

#### Ollama ne démarre pas

**Symptômes :** L'exécution de GLM-OCR Ollama ne démarre pas

**Solutions :**
1. **Installez Ollama** : utilisez le bouton Télécharger dans Paramètres → OCR, ou installez depuis ollama.com
2. **Vérifiez le chemin binaire** : définissez le chemin binaire Ollama s'il n'est pas à l'emplacement par défaut
3. **Autorisations Linux** : vous aurez peut-être besoin de « sudo » pour installer ou exécuter le service Ollama

### Obtenir de l'aide

**Ressources :**
- **Documentation** : consultez le dossier `docs/` pour des guides détaillés
- **Problèmes GitHub** : signaler les bugs et les demandes de fonctionnalités
- **Communauté** : rejoignez les discussions, posez des questions
- **Raccourcis clavier** : appuyez sur « ? » dans l'application pour une référence rapide

**Mode débogage :**
Activez la journalisation du débogage (Paramètres → Avancé → Mode débogage) pour résoudre les problèmes.

**Exportation de données :**
Exportez vos données avant les changements majeurs (Paramètres → Sauvegarde → Exporter)

### Récupération**Suppression accidentelle :**
1. Vérifiez les sauvegardes (Paramètres → Sauvegarde)
2. Restaurer à partir d'une sauvegarde récente
3. Contactez le support si aucune sauvegarde n'est disponible

**Base de données corrompue :**
1. Exportez les données immédiatement
2. Reconstruire la base de données (Paramètres → Données → Reconstruire)
3. Importer les données exportées
4. Vérifiez toutes les données présentes

**Progrès perdu :**
1. Vérifiez Analytics → Exporter pour les données historiques
2. Restaurer à partir d'une sauvegarde si nécessaire
3. Synchronisez avec le fournisseur de cloud si activé

---

## Glossaire

**Extrait** : élément de contenu extrait d'un document, matériel de carte potentiel

**Élément d'apprentissage** : tout élément à apprendre (flashcard, cloze, questions-réponses, etc.)

**File d'attente** : tous les éléments dont l'examen est programmé, organisés par priorité

**Séance de révision** : une période de rappel actif et de cartes d'évaluation

**FSRS** : Free Spaced Repetition Scheduler, algorithme moderne optimisant le timing de révision (FSRS-6 est la version actuelle)

**Intervalle** : délai entre les examens (par exemple, 7 jours)

**Stabilité** : durée d'une mémoire (métrique FSRS)

**Difficulté** : la difficulté d'un élément pour vous, sur une échelle de 1 à 10 (métrique FSRS)

**Récupérabilité** : probabilité actuelle de rappel, 0 à 100 % (métrique FSRS)

**Rétention souhaitée** : taux de rétention cible (généralement 90 %)

**Intervalle de prévisualisation** : fonctionnalité affichant la prochaine date de révision pour chaque option de notation

**Cloze** : type de carte à remplir

**Suspendre** : masquer temporairement l'article des avis

**Catégorie** : Domaine de l'organisation

**Tag** : étiquette personnalisée pour une organisation intercatégorielle

**Priorité** : importance définie par l'utilisateur (0 - 100)

---

## Référence des raccourcis clavier

### Raccourcis globaux

| Raccourci | Actions |
|--------------|--------|
| `Ctrl/Cmd + K` | Ouvrir la palette de commandes |
| `Ctrl/Cmd + P` | Ouvrir la palette de commandes (alternative) |
| `Ctrl/Cmd + ,` | Ouvrir les paramètres |
| `Ctrl/Cmd + D` | Aller au tableau de bord |
| `Ctrl/Cmd + Q` | Aller à la file d'attente |
| `Ctrl/Cmd + R` | Lancer l'évaluation |
| `Ctrl/Cmd + O` | Ouvrir le document |
| `Ctrl/Cmd + N` | Document d'importation (alternative) |
| `Ctrl/Cmd + /` | Afficher les raccourcis clavier |
| `?` | Afficher les raccourcis clavier (pas de modificateur) |

### Raccourcis du mode Révision

| Raccourci | Actions |
|--------------|--------|
| `Espace` | Afficher la réponse |
| '1' | Notez "Encore" |
| '2' | Noter "Difficile" |
| '3' | Noter « Bon » |
| '4' | Noter "Facile" |
| `Ctrl/Cmd + Entrée` | Afficher la réponse (alternative) |
| `Ctrl/Cmd + 1/2/3/4` | Évaluer sans afficher la réponse |
| `Échap` | Fin de séance |
| `Ctrl/Cmd + E` | Modifier la carte actuelle (pas encore implémentée) |
| `Ctrl/Cmd + D` | Supprimer la carte actuelle (également utilisée globalement pour « Aller au tableau de bord ») |
| `Ctrl/Cmd + S` | Suspendre la carte |
| `Ctrl/Cmd + H` | Historique de la carte |

### Raccourcis de file d'attente

| Raccourci | Actions |
|--------------|--------|
| `Ctrl/Cmd + F` | Recherche ciblée |
| `Ctrl/Cmd + A` | Tout sélectionner |
| `Supprimer` | Supprimer la sélection |
| `Ctrl/Cmd + Clic` | Sélection multiple |
| `Maj + Clic` | Sélection de plage |

### Raccourcis de la visionneuse de documents

| Raccourci | Actions |
|--------------|--------|
| `Ctrl/Cmd + F` | Rechercher dans le document |
| `Ctrl/Cmd + C` | Copier le texte sélectionné |
| `Ctrl/Cmd + E` | Créer un extrait de la sélection |
| `Ctrl/Cmd + H` | Sélection des surbrillance |
| `Ctrl/Cmd + +` | Zoomer |
| `Ctrl/Cmd + -` | Zoom arrière |
| `Ctrl/Cmd + 0` | Réinitialiser le zoom |
| 'F11' | Plein écran |

---

##FAQ

**Q : Comment ajouter des newsletters à Incrementum ?**
R : Vous pouvez ajouter des newsletters de deux manières :
1. **Répertoire des newsletters** : cliquez sur RSS → Icône de newsletter (📬) → Parcourez et abonnez-vous aux newsletters organisées
2. **URL directe** : copiez n'importe quelle URL de newsletter (Substack, Beehiiv, etc.) → RSS → Ajouter un flux → Coller l'URL. Incrementum découvrira automatiquement le flux RSS.

**Q : Quelles plateformes de newsletter sont prises en charge ?**
R : Incrementum prend en charge les flux RSS des sites Substack, Beehiiv, Ghost blogs, Buttondown, ConvertKit, Revue, Medium et WordPress. La plupart des newsletters publient des flux RSS - consultez le site Web de la newsletter pour un lien RSS ou essayez d'ajouter « /feed » à l'URL.

**Q : Combien de cartes dois-je examiner par jour ?**
R : Commencez avec 20 à 50 par jour. Ajustez en fonction de votre emploi du temps et de vos objectifs. La cohérence est plus importante que le volume.

**Q : Combien de cartes puis-je créer par jour ?**
R : Autant que vous le souhaitez, mais concentrez-vous sur la qualité plutôt que sur la quantité. 10 à 20 cartes bien faites valent mieux que 50 mauvaises.

**Q : Quel taux de rétention dois-je cibler ?**
R : 90 % est la valeur par défaut recommandée. Ajustez à 85 % si vous avez trop d'avis, ou à 95 % pour le matériel critique.

**Q : Puis-je utiliser Incrementum pour les langues ?**
R : Absolument ! C'est excellent pour les cartes de vocabulaire, de grammaire et de phrases. Utilisez des cartes Cloze pour les modèles de grammaire.

**Q : Comment gérer les équations mathématiques ?**
R : Utilisez la syntaxe LaTeX dans les cartes. Pour l'OCR, utilisez le fournisseur Mathpix pour obtenir de meilleurs résultats avec le contenu mathématique.

**Q : Puis-je synchroniser avec Anki ?**
R : Oui ! Configurez AnkiConnect dans Paramètres → Intégrations → Anki pour la synchronisation bidirectionnelle.

**Q : Quelle est la différence entre la suspension et la suppression ?**
R : La suspension masque temporairement les cartes (peut être rétablie). La suppression supprime définitivement (peut être restaurée à partir d'une sauvegarde).

**Q : À quelle fréquence dois-je réviser ?**
R : L'idéal est de le faire quotidiennement. Si vous manquez des jours, les cartes s'accumuleront mais ne seront pas « perdues » - rattrapez-les quand vous le pouvez.

**Q : Puis-je utiliser Incrementum sur plusieurs appareils ?**
R : Pas encore directement, mais vous pouvez synchroniser les données via Dropbox/Google Drive ou utiliser l'extension du navigateur.

**Q : Mes données sont-elles privées ?**
R : Oui ! Toutes les données stockées localement. La synchronisation cloud est cryptée. Aucune donnée envoyée aux serveurs, à l'exception des fournisseurs d'IA configurés.

**Q : Comment exporter mes cartes ?**
R : Paramètres → Sauvegarde → Exporter, ou utilisez la synchronisation Anki pour exporter au format .apkg.

---

## Journal des modifications

Voir [CHANGELOG.md](https://github.com/melpomenex/incrementum-tauri/blob/main/CHANGELOG.md) pour l'historique des versions et les mises à jour.

---

## Assistance et communauté

- **Documentation** : [docs/](./)
- **GitHub** : [incrementum-tauri](https://github.com/melpomenex/incrementum-tauri)
- **Problèmes** : [Signaler des bugs](https://github.com/melpomenex/incrementum-tauri/issues)
- **Discussions** : [Poser des questions](https://github.com/melpomenex/incrementum-tauri/discussions)

---

**Bon apprentissage ! 🚀**

Construit avec ❤️ en utilisant Tauri + React + Rust
