# Manuel de l'utilisateur Incrementum

**Votre guide complet pour maîtriser la lecture incrémentielle et la répétition espacée**

---

## Introduction

### Qu'est-ce qu'Incrementum ?

Incrementum est une puissante application d'apprentissage qui combine deux techniques éprouvées :

**Lecture incrémentielle** - Traitez de grandes quantités d'information par petits blocs gérables au fil du temps. Au lieu de lire un article du début à la fin, vous en extrayez les points clés et construisez progressivement votre compréhension.

**Répétition espacée** - Révisez le contenu à des intervalles scientifiquement optimisés pour maximiser la rétention. Des algorithmes comme FSRS-5 et SM-18 prédisent quand vous êtes sur le point d'oublier et planifient les révisions juste à temps.

### Concepts clés

- **Documents** : les sources (PDF, EPUB, articles, vidéos)
- **Extraits** : les passages ou points clés que vous avez extraits des documents
- **Éléments d'apprentissage** : des flashcards ou cartes de questions-réponses créées à partir d'extraits
- **File d'attente** : les éléments programmés pour révision, organisés par priorité
- **Révisions** : les sessions pendant lesquelles vous vous rappelez activement l'information et l'évaluez

---

## Pour commencer

### Premier lancement

Lorsque vous lancez Incrementum pour la première fois, vous verrez le **Tableau de bord** composé de quatre sections principales :

1. **File d'attente** - Votre file d'attente de révision (vide au début)
2. **Révision** – Séance de révision active
3. **Documents** - Votre bibliothèque de documents
4. **Analyses** - Statistiques de progression

### Configuration initiale

1. **Choisissez un thème** - Accédez à Paramètres → Apparence → Thème
   - 17 thèmes intégrés disponibles (6 sombres, 11 clairs)
   - Essayez « Modern Dark » ou « Material You » pour un look moderne

2. **Configurer les paramètres de révision** - Paramètres → Apprentissage → Algorithme
   - **Algorithme** : FSRS-5 (recommandé), SM-18 ou SM-2
   - **Rétention souhaitée** : 90 % (par défaut) - le niveau de mémorisation que vous visez
   - **Apprendre par jour** : 20 à 50 éléments recommandés pour les débutants

3. **Configurer les catégories** - Paramètres → Catégories
   - Créer des catégories pour différents sujets (par exemple, "Programmation", "Science", "Langues")
   - Les catégories vous aident à organiser et filtrer votre matériel d'apprentissage

### Votre premier document

Importons votre premier document :

1. Cliquez sur **Documents** dans la barre latérale
2. Cliquez sur le bouton **Importer** (en haut à droite)
3. Choisissez votre méthode d'importation :
   - **Fichier local** : sélectionnez un fichier PDF, EPUB ou texte
   - **URL** : collez n'importe quelle URL Web
   - **Arxiv** : collez un identifiant ou une URL de document de recherche
4. Attendez le traitement (l'auto-segmentation démarre automatiquement)

---

## Gestion des documents

### Formats d'importation

| Format | Description | Cas d'utilisation |
|--------|-------------|--------------|
| **PDF** | Format de document portable | Documents de recherche, ebooks, documentation |
| **EPUB** | Publication électronique | Livres, articles avec texte redistribuable |
| **Markdown** | Fichiers `.md` | Documentation technique, notes |
| **HTML** | Pages Web | Articles, billets de blog |
| **Anki (.apkg)** | Paquet de deck Anki | Migrer depuis Anki |
| **SuperMémo** | Exportations ZIP | Migrer depuis SuperMemo |
| **URL** | Tout lien Web | Articles en ligne, blogs |
| **Arxiv** | Articles académiques | Littérature de recherche |
| **Capture d'écran** | Capture d'écran | Captures rapides depuis n'importe quelle application |

### Importation de documents

#### Méthode 1 : fichiers locaux

1. Cliquez sur **Documents** → **Importer**
2. Sélectionnez **Fichier local**
3. Accédez à votre fichier et sélectionnez-le
4. Incrementum :
   - extrait le contenu textuel
   - segmente automatiquement le document en sections
   - calcule le temps de lecture et le nombre de mots
   - extrait les métadonnées (titre, auteur, etc.)

#### Méthode 2 : importation d'URL

1. Copiez n'importe quelle URL Web
2. Cliquez sur **Documents** → **Importer** → **URL**.
3. Collez l'URL
4. Cliquez sur **Importer**
5. Incrementum récupère et traite le contenu

**Sites pris en charge :**
- Articles de presse (la plupart des sites majeurs)
- Articles de blog
- Pages de documentation
- Medium, Substack, etc.

#### Méthode 3 : articles Arxiv

1. Recherchez un article Arxiv (par exemple, « https://arxiv.org/abs/2301.07041 »)
2. Copiez l'URL ou l'ID papier (`2301.07041`)
3. Cliquez sur **Documents** → **Importer** → **Arxiv**
4. Collez l'URL ou l'ID
5. Incrementum télécharge :
   - PDF complet
   - Résumé
   - Auteurs
   - Date de parution
   - Références

### Visionneuse de documents

Une fois importé, ouvrez n'importe quel document pour accéder :

**Fonctionnalités de la visionneuse :**
- **Navigation dans les pages** : faites défiler les pages/sections
- **Zoom** : Ajustez la taille du texte
- **Plein écran** : lecture sans distraction
- **Recherche** : rechercher du texte dans le document
- **Table des matières** : accéder aux sections (si disponible)

**Outils d'annotation :**
1. **Surligner le texte** : Sélectionnez le texte → Choisissez la couleur de surbrillance
   - Jaune : Concepts importants
   - Vert : Exemples
   - Bleu : Définitions
   - Rouge : Points critiques
   - Violet : Thèmes connexes

2. **Créer un extrait** : Sélectionnez le texte → cliquez sur le bouton « Extraire »
   - L'extrait apparaît dans l'onglet Extraits
   - Peut ensuite être converti en carte mémoire

3. **Ajouter une note** : Sélectionnez le texte → cliquez sur le bouton « Note »
   - Joignez vos pensées/notes
   - Des notes apparaissent avec des extraits

### Organisation des documents

**Catégories :**
- Attribuer chaque document à une catégorie
- Filtrer les documents par catégorie
- Les catégories héritent des extraits et des fiches

**Mots clés :**
- Ajouter des balises personnalisées aux documents
- Utiliser des balises pour l'organisation inter-catégories
- Exemples : `#urgent`, `#research`, `#tutorial`

**Recherche :**
- Recherche en texte intégral dans tous les documents
- Filtrer par catégorie, tags, plage de dates
- Trier par titre, date, nombre de mots

---

## Le système d'apprentissage

### Comprendre FSRS-5

**FSRS-5** (Free Spaced Repetition Scheduler) est un algorithme moderne qui :

1. **Suit l'état de la mémoire** : modélise la force de votre mémoire pour chaque carte
2. **Prédit l'oubli** : estime le moment où vous oublierez chaque élément
3. **Optimise la planification** : planifie les révisions à des moments optimaux
4. **S'adapte à vous** : apprend de vos modèles de performance

**Mesures clés :**
- **Stabilité** : combien de temps dure une mémoire (plus élevée = plus stable)
- **Difficulté** : la difficulté de l'objet pour vous (échelle de 1 à 10)
- **Récupérabilité** : probabilité actuelle de rappel (0-100 %)

### Système de notation

Pendant les révisions, évaluez chaque élément en fonction de votre capacité à vous en souvenir :

| Évaluation | Étiquette | Descriptif | Intervalle typique |
|--------|-------|-------------|------------------|
| **1** | Encore | Trou de mémoire complet | ~10 minutes |
| **2** | Difficile | Souvenir d'un effort considérable | 1-2 jours |
| **3** | Bon | Souvenir avec réflexion | 5-7 jours |
| **4** | Facile | Le rappel s'est fait sans effort | 10-14 jours |

**Intervalles d'aperçu :**
Avant la notation, Incrementum vous indique exactement quand chaque carte apparaîtra ensuite pour les quatre options de notation. Profitez-en pour optimiser votre emploi du temps !

### Types de cartes

#### 1. Cartes mémoire de base
Cartes simples recto/verso

**Recto :** Quelle est la capitale de la France ?
**Verso :** Paris

**Idéal pour :** Faits, définitions, vocabulaire

#### 2. Texte à trous (cloze)
Style de remplissage

**Texte :** La capitale de la {{France}} est Paris.

**S'affiche comme :** La capitale de _____ est Paris.

**Idéal pour :** apprentissage contextuel, relations entre concepts

#### 3. Cartes questions-réponses
Paires de questions et réponses

**Q :** Expliquez la différence entre TCP et UDP.
**R :** TCP est orienté connexion avec une livraison garantie ; UDP est sans connexion sans garantie.

**Idéal pour :** Concepts, explications

#### 4. Occlusion de l'image
Masquer des parties d'une image (schémas, graphiques)

**Idéal pour :** Anatomie, cartes, diagrammes

### Création de cartes

#### À partir d'extraits

1. Pendant la lecture, sélectionnez le texte important
2. Cliquez sur **Extraire** pour créer un extrait
3. Dans l'onglet **Extraits**, examinez vos extraits
4. Cliquez sur **Créer une carte** sur n'importe quel extrait
5. Choisissez le type de carte (Flashcard, Cloze, Q&A)
6. Modifier le contenu de la carte
7. Cliquez sur **Enregistrer**

La carte est maintenant programmée pour examen !

#### Création manuelle

1. Cliquez sur **File d'attente** → **Ajouter un élément**
2. Choisissez le type de carte
3. Saisissez le contenu recto/verso
4. Sélectionnez la catégorie
5. Cliquez sur **Créer**

#### Génération basée sur l'IA

Si vous avez configuré l'IA :

1. Sélectionnez un extrait ou une section de document
2. Cliquez sur **Générer des cartes**
3. L'IA créera automatiquement plusieurs cartes
4. Vérifiez et modifiez si nécessaire
5. Enregistrez les meilleurs

---

## Processus de révision

### Démarrage d'une session de révision

1. Cliquez sur **Réviser** dans la barre latérale
2. Voir les cartes dues aujourd'hui (et à venir)
3. Cliquez sur **Démarrer l'examen** pour commencer

### Interface de révision

**Affichage de la carte :**
- Recto de la carte affiché (question ou invite)
- Appuyez sur **Espace** ou cliquez pour afficher la réponse
- La réponse apparaît ci-dessous

**Séances de révision mixtes (fiches + documents) :**
- Les sessions de révision peuvent inclure des **éléments d'apprentissage** et des **documents** qui doivent être lus.
- Lorsqu'un document apparaît, vous pouvez l'ouvrir directement depuis la fiche de session.
- Noter un document programme sa prochaine date de lecture, tout comme une carte programme sa prochaine révision.

**Interface d'évaluation :**
Après avoir révélé la réponse, quatre boutons d'évaluation apparaissent :

```
[Encore] [Difficile] [Bon] [Facile]
  ~10 min ~2j ~7j ~14j
```

Chaque bouton affiche la **prochaine date de révision** : il s'agit de la fonctionnalité **Intervalle de prévisualisation** !

**Actions de récupération (inspecteur de file d'attente de révision) :**
Utilisez-les lorsque le calendrier d’un élément d’apprentissage nécessite un coup de pouce rapide :

- **Intervalles de compression** : rapprochez la prochaine révision (intervalle plus court).
- **Reprogrammer intelligemment** : déplacez l'élément vers « à rendre maintenant ».
- **Fréquence de rétrogradation** : repoussez la révision suivante (intervalle plus long).

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
| `Ctrl+E` | Modifier la carte actuelle (pas encore implémenté) |
| `Ctrl+D` | Supprimer la carte actuelle (aussi utilisé globalement pour « Aller au tableau de bord ») |

### Gestion des sessions

**Caractéristiques de la session de révision :**
- **Barre de progression** : affiche les cartes restantes
- **Suivi du temps** : affiche la durée de la session
- **Break Timer** : pauses facultatives toutes les N cartes
- **Limites de session** : définissez le nombre maximum de cartes ou la durée par session

**Fin d'une session :**
- Cliquez sur **Terminer** lorsque vous avez terminé
- Ou définir une limite (Paramètres → Révision → Limites de session)
- Les cartes inachevées restent dues pour la prochaine session

### Stratégies d'examen

#### Routine de révision quotidienne

1. **Séance du matin** (15-30 min)
   - Examiner les cartes à rendre du jour au lendemain
   - Concentrez-vous sur les éléments plus difficiles

2. **Séance du soir** (15-30 min)
   - Cartes de révision ajoutées pendant la journée
   - Créer de nouvelles cartes à partir de la lecture

#### Gestion du backlog

Si vous avez plusieurs cartes à rendre (>100) :

1. **Focus sur les nouvelles cartes** : limiter les révisions à 20-30/jour
2. **Utilisez des filtres** : examinez par catégorie (ne vous submergez pas)
3. **Cram Sessions** : séances de rattrapage du week-end
4. **Ajuster la rétention** : temporairement inférieur à 85 % (moins d'avis)

#### Gérer les cartes "Encore"

Les cartes notées « Encore » réapparaissent rapidement (10 min). Stratégies :

- **Réapprentissage immédiat** : révisez à nouveau les cartes au cours de la même session
- **Session séparée** : révisez à nouveau les cartes plus tard dans la journée
- **Comprendre les problèmes** : Si de nombreuses réponses sont négatives, la carte peut être mal rédigée

---

## Gestion des files d'attente

### Comprendre la file d'attente

La **file d'attente** contient tous les éléments dont la révision est programmée, organisés par :

- **Date d'échéance** : les éléments dus plus tôt apparaissent en premier
- **Priorité** : priorité définie par l'utilisateur (0-100)
- **Catégorie** : Domaine
- **Type de carte** : Flashcard, cloze, etc.

### Vues de la file d'attente

#### Vue due
Affiche les éléments dus aujourd'hui et en retard, triés par heure d'échéance

#### Vue programmée
Affiche tous les éléments planifiés, y compris les révisions futures

#### Nouvelle vue
Affiche les cartes nouvellement créées qui n'ont pas encore été examinées

### Opérations de file d'attente

**Filtrage :**
- Par catégorie (par exemple, "Afficher uniquement la programmation")
- Par type de carte (par exemple, "Afficher uniquement les cartes Cloze")
- Par plage de priorités (par exemple, "Afficher la priorité 80+")

**Tri :**
- Date d'échéance (par défaut)
- Priorité
- Difficulté
- Aléatoire (pour la variété)

**Actions groupées :**
1. Sélectionnez plusieurs éléments (cases à cocher)
2. Choisissez l'action :
   - **Changer de catégorie** : passer à une autre catégorie
   - **Définir la priorité** : priorité de mise à jour groupée
   - **Suspendre** : masquer temporairement les avis
   - **Supprimer** : Supprimer définitivement

### Système de priorité

Définissez la priorité de 0 à 100 sur n'importe quel élément :

- **100** : Critique (à apprendre)
- **80-90** : important
- **60-70** : Priorité normale
- **40-50** : Faible priorité
- **0-20** : Archive/référence

**Planification prioritaire :**
Les éléments plus prioritaires sont affichés plus fréquemment dans les avis mitigés.

### Files d'attente intelligentes

Créez des files d'attente personnalisées avec des filtres :

**Exemples de files d'attente :**
- "Aujourd'hui": cartes dues de la catégorie principale
- "Quick Review" : Cartes faciles, priorité < 50
- "Deep Dive" : Cartes rigides de la catégorie recherche
- "Exam Prep" : Toutes les cartes de la catégorie "Biologie"

**Création d'une file d'attente intelligente :**
1. Cliquez sur **File d'attente** → **Files d'attente enregistrées**.
2. Cliquez sur **Nouvelle file d'attente**
3. Définir les filtres et l'ordre de tri
4. Nommez et enregistrez

---

## Analyses et suivi des progrès

### Présentation du tableau de bord

Le tableau de bord Analytics fournit des informations complètes :

**Mesures clés :**
- **Cartes dues aujourd'hui** : numéro en attente d'examen
- **Total des cartes** : Toutes les cartes du système
- **Taux de rétention** : pourcentage mémorisé
- **Study Streak** : Jours d'activité consécutifs
- **Cartes apprises** : nombre total de cartes créées

### Graphiques d'activité

**Activité de 30 jours :**
- Graphique à barres affichant les avis par jour
- Code couleur par note (Encore/Difficile/Bon/Facile)
- Identifiez les modèles dans vos habitudes d'étude

**Courbe d'apprentissage :**
- Graphique linéaire montrant le nombre total de cartes au fil du temps
- Suivez la croissance de votre base de connaissances

### Statistiques

**Statistiques de révision :**
- Total des examens terminés
- Répartition moyenne des notes
- Avis par jour/semaine/mois

**Statistiques de la carte :**
- Total des cartes par catégorie
- Cartes par type (Flashcard, Cloze, etc.)
- Cartes nouvelles ou matures

**Mesures d'algorithme (FSRS/SM-18) :**
- Stabilité moyenne
- Difficulté moyenne
- Rétention prévue
- Performances de la mémoire

### Répartition des catégories

Afficher les performances par domaine :

- Cartes par catégorie
- Taux de rétention par catégorie
- Niveau d'activité par catégorie
- Identifier les points forts/faibles

### Buts et séquences

**Fixation d'objectifs :**
1. Cliquez sur **Analytics** → **Objectifs**.
2. Fixez des objectifs quotidiens/hebdomadaires :
   - Cartes à revoir
   - Cartes à créer
   - Temps d'étude
3. Suivez les indicateurs visuels de progrès

**Séries d'études :**
- Journées consécutives avec activité
- Série actuelle affichée sur le tableau de bord
- Entretenir des séquences de motivation

### Statistiques d'exportation

Exportez vos données pour analyse :

1. Cliquez sur **Analytics** → **Exporter**.
2. Choisissez le format :
   - **CSV** : compatible avec les feuilles de calcul
   - **JSON** : pour une analyse personnalisée
   - **PDF** : Rapport imprimable
3. Sélectionnez une plage de dates
4. Incluez des métriques (avis, cartes, rétention)

---

## Paramètres et personnalisation

### Paramètres d'apparence

#### Thèmes
- **17 thèmes intégrés** : choisissez parmi des thèmes sombres et clairs
- **Aperçu en direct** : consultez instantanément les changements de thème
- **Thèmes personnalisés** : créez vos propres combinaisons de couleurs

**Options de thème :**
- Modern Dark (sombre par défaut)
- Matériel vous (Conception matérielle 3)
- Lumière aurore
- Bleu glacier
- Et 13 de plus...

#### Création de thèmes personnalisés

1. Paramètres → Apparence → Personnaliser le thème
2. Ajustez les couleurs :
   - Couleur primaire
   - Couleur de fond
   - Couleur du texte
   - Couleurs accentuées
3. Enregistrer comme thème personnalisé
4. Exporter/importer des thèmes à partager

#### Options d'affichage
- **Mode dense** : affichez plus de contenu par écran
- **Taille de police** : Ajustez la taille du texte
- **Animation de carte** : activer/désactiver les animations
- **Afficher les intervalles d'aperçu** : afficher les prochaines dates de révision

### Paramètres d'apprentissage

#### Sélection d'algorithme

Incrementum prend en charge trois algorithmes de planification. Choisissez celui qui correspond le mieux à votre style d'apprentissage :

**FSRS-5 (recommandé) :**
- Moderne, soutenu par la recherche
- S'adapte à la mémoire individuelle
- Prédit les temps d'oubli
- Meilleure rétention avec moins d'avis

**SM-18 (SuperMémo 18) :**
- Dernier algorithme SuperMemo, rétro-ingénierie à partir de l'application d'origine
- Utilise une matrice de recherche 3D SInc (Stability Increase) en fonction de la difficulté, de la stabilité et de la récupérabilité
- Suivi explicite des difficultés avec mises à jour de la moyenne finale
- Modèle de courbe d'oubli exponentielle : `R = 0,9^(t/S)`
- Gestion sophistiquée des pannes avec réduction de la stabilité en fonction des déchéances

**SM-2 (Classique) :**
- Algorithme traditionnel SuperMemo 2 (documenté publiquement)
- Plus simple, prévisible
- Plus d'avis requis

#### Paramètres

**Rétention souhaitée :** 0,70 - 0,95
- **90 %** (par défaut) : équilibre la rétention et la charge de révision
- **85 %** : moins d'avis, un peu moins de rétention
- **95 %** : Rétention maximale, plus d'avis

**Apprendre par jour :** 10 à 100
- **20** (par défaut) : Gérable pour la plupart des utilisateurs
- **50** : Pour les périodes d'études intensives
- **10** : charge de révision légère

**Révision par jour :** 50 - 500
- **200** (par défaut) : limite quotidienne raisonnable
- **500** : pour éliminer le retard
- **50** : Jours de révision légers

#### Paramètres d'intervalle

**Nouveaux intervalles de carte :**
- Intervalle d'obtention du diplôme (bonne note) : 1 à 10 jours
- Intervalle facile : 3-21 jours
- Intervalle minimum : 1 jour

**Intervalle maximum :**
- Limiter les intervalles les plus longs (365 jours par défaut)
- Empêche les cartes d'être programmées trop loin

**Capuchon de sécurité long (Vidéos/Articles) :**
- Pour les vidéos/articles longs, les notes positives (« Bon »/« Facile ») tiennent compte de la couverture.
- Si vous passez moins de **25 %** de la durée estimée du contenu, l'intervalle suivant est limité à **1 jour**.
- Si vous dépensez moins de **50 %**, l'intervalle suivant est limité à **2 jours**.
- Si vous dépensez moins de **75 %**, l'intervalle suivant est limité à **4 jours**.
- Cela évite que le contenu long soit programmé trop loin après une progression partielle.
- Une fois appliqué, le motif du planificateur inclut une note **Plafond tenant compte de la durée** pour plus de transparence.

### Paramètres de révision

#### Limites de session

**Délai :**
- Durée maximale de la session (minutes)
- Intervalles de pause
- Fin automatique après la limite

**Limites des cartes :**
- Nombre maximum de cartes par session
- Limite séparée pour les nouvelles cartes
- Encore une fois la limite de carte

#### Options de notation

**Raccourcis d'évaluation :**
- Personnaliser les raccourcis clavier
- Définir la note par défaut (touche Espace)
- Activer/désactiver les raccourcis de notation

**Avance automatique :**
- Passage automatique à la carte suivante après la notation
- Délai avant avance automatique (secondes)

### Paramètres généraux

#### Sauvegarde automatique
- Enregistrer l'intervalle (secondes)
- Économisez sur la notation de la carte
- Enregistrer sur le commutateur d'onglet#### Documents récents
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

**Fournisseurs pris en charge :**
- Boîte de dépôt
- Google Drive
-OneDrive

**Options de synchronisation :**
- Synchronisation automatique sur les modifications
- Intervalle de synchronisation (manuel, 15 min, 30 min, 1 h)
- Synchronisation au démarrage/fermeture de l'application
- Gestion des conflits

#### Sauvegarde et restauration

Incrementum fournit un système complet de sauvegarde et de restauration pour protéger vos données d'apprentissage et migrer entre les appareils.

#### Sauvegarde complète de l'application

**Ce qui est sauvegardé :**
- **Paramètres** : Toutes les préférences, thèmes, paramètres d'apprentissage
- **Documents** : tous les documents importés avec métadonnées
- **Extraits** : tous les faits saillants et le contenu extrait
- **Éléments d'apprentissage** : toutes les flashcards, suppressions de cloze, cartes questions-réponses
- **Données de planification** : états de la mémoire de l'algorithme (stabilité, difficulté, intervalles), dates d'échéance
- **Collections** : toutes les collections et affectations de documents
- **État de l'interface utilisateur** : état de la barre latérale, préférences de thème
- **Facultatif** : fichiers de documents réels (PDF, EPUB, etc.)

**Création d'une sauvegarde :**

1. Accédez à **Paramètres → Importer/Exporter → Sauvegarde complète de l'application**
2. Cliquez sur **Ouvrir la sauvegarde et la restauration**
3. Sélectionnez **Exporter la sauvegarde**
4. Ajoutez une étiquette facultative (par exemple, "Avant de reformater le PC")
5. Choisissez si vous souhaitez inclure les fichiers de documents :
   - **Métadonnées uniquement** : fichier plus petit (~ Ko-Mo), réimportez les fichiers séparément
   - **Inclure les fichiers** : fichier plus volumineux (~ Mo-Go), sauvegarde autonome complète
6. Cliquez sur **Exporter la sauvegarde** et enregistrez le fichier `.incrementum`

**Format de fichier :**
- Extension : `.incrementum`
- Format : JSON avec commentaire d'en-tête
- Dénomination : `incrementum-backup-[label]-[date]-[time].incrementum`

**Restauration à partir d'une sauvegarde :**

1. Accédez à **Paramètres → Importer/Exporter → Sauvegarde complète de l'application**
2. Cliquez sur **Ouvrir la sauvegarde et la restauration**
3. Sélectionnez **Importer la sauvegarde**
4. Choisissez votre fichier `.incrementum`
5. Prévisualisez le contenu de la sauvegarde :
   - Nombre de documents
   - Compte d'extraits
   - Nombre d'éléments d'apprentissage
   - Nombre de collectes
   - Si les fichiers sont inclus
6. Configurez les options d'importation (facultatif) :
   - **Ce qu'il faut importer** : choisissez des types de données spécifiques
   - **Gestion des doublons** : ignorer, remplacer ou fusionner
   - **Importer des fichiers** : s'il faut restaurer les fichiers de documents
7. Cliquez sur **Importer la sauvegarde**
8. Attendez la fin de l'importation (progression affichée)

**Stratégies de gestion des doublons :**
- **Ignorer** : ignorer les éléments qui existent déjà (recommandé dans la plupart des cas)
- **Remplacer** : écraser les éléments existants avec des versions de sauvegarde
- **Fusion** : créez de nouvelles copies de tous les éléments (peut créer des doublons)

**Cas d'utilisation :**

| Scénario | Approche recommandée |
|----------|-----------|
| **Migrer vers un nouvel ordinateur** | Exporter avec des fichiers, importer sur une nouvelle machine |
| **Sauvegarde avant les changements majeurs** | Sauvegarde rapide des métadonnées uniquement |
| **Synchronisation entre appareils** | Flux de travail d'exportation/importation |
| **Partager des collections** | Exporter des collections spécifiques |
| **Archiver les anciennes données** | Exporter et stocker à long terme |
| **Restaurer après reformatage** | Importer une sauvegarde complète avec des fichiers |**Remarques importantes :**
- **Préservation de la planification** : toutes les données de planification (stabilité, difficulté, dates d'échéance) pour tous les types d'algorithmes sont conservées exactement
- **Chemins de fichiers** : lors de l'importation sans fichiers, vous devrez réimporter les documents originaux. Incrementum les fera correspondre par hachage de contenu et restaurera les métadonnées
- **Compatibilité des versions** : les sauvegardes sont rétrocompatibles mais peuvent ne pas fonctionner avec les anciennes versions de l'application
- **Stockage** : protégez les sauvegardes : elles contiennent vos données d'apprentissage personnelles

#### Options de sauvegarde héritées

**Sauvegardes automatiques :**
- Fréquence de sauvegarde (quotidienne, hebdomadaire)
- Sauvegardes maximales à conserver (5-50)
- Emplacement de sauvegarde

**Sauvegarde manuelle :**
- Paramètres → Sauvegarde → Créer une sauvegarde
- Choisissez l'emplacement
- Comprend toutes les données et paramètres

**Restaurer :**
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
| `Ctrl+N` | Importer un document (alternative) |

#### Personnalisation

1. Paramètres → Raccourcis clavier
2. Sélectionnez l'action à remapper
3. Appuyez sur une nouvelle combinaison de touches
4. Enregistrez les modifications

**Réinitialiser les paramètres par défaut :** Cliquez sur le bouton « Réinitialiser tout »

### Paramètres d'intégration

#### Intégration Anki

**Configuration :**
1. Paramètres → Intégrations → Anki
2. Configurez l'URL AnkiConnect (par défaut : `http://localhost:8765`)
3. Tester la connexion
4. Activer la synchronisation bidirectionnelle

**Options de synchronisation :**
- Synchronisation avec Anki lors de la création de cartes
- Intervalles de synchronisation d'Anki
- Cartographie du deck (catégorie Incrementum → deck Anki)
- Synchronisation des balises

#### Intégration d'obsidienne

**Configuration :**
1. Paramètres → Intégrations → Obsidienne
2. Définir le chemin du coffre-fort
3. Configurer le modèle
4. Activer la synchronisation

**Fonctionnalités de synchronisation :**
- Exporter des cartes vers des notes Obsidian
- Importer des notes sous forme de cartes
- Intégration des notes quotidiennes
- Synchronisation des balises bidirectionnelles

#### Intégration NotebookLM

Utilisez NotebookLM dans Incrementum pour rechercher, générer des artefacts d'étude et enregistrer des extraits révisables.

**Configuration :**
1. Paramètres → Fonctionnalités → activer **NotebookLM**
2. Paramètres → Intégrations → **NotebookLM**
3. Cliquez sur **Connect** et choisissez le fournisseur (`mock` pour les tests, `cli` pour Live NotebookLM)
4. Sélectionnez ou créez un bloc-notes actif

**Ce que vous pouvez faire :**
- Posez des questions dans le chat NotebookLM directement depuis Incrementum
- Exécuter des invites de recherche (recherche de cahiers assistée par Web)
- Générer des artefacts :
  - Cartes mémoire
  - Quiz
  - Rapport / Guide d'étude
  - Carte mentale
  - Tableau de données
  - Aperçu audio
  - Aperçu vidéo
- Prévisualisez les artefacts dans l'application (y compris les lecteurs audio/vidéo lorsque le média est disponible)
- Synchronisez les flashcards/éléments de quiz générés dans la file d'attente de révision Incrementum

**Enregistrer les réponses au chat sous forme d'extraits :**
1. Ouvrez le chat de l'espace de travail NotebookLM
2. Sur n'importe quelle réponse de l'assistant, cliquez sur **Enregistrer en tant qu'extrait**.
3. Facultatif : mettez d'abord en surbrillance une partie de la réponse pour enregistrer uniquement le texte sélectionné.
4. Incrementum crée un extrait lié à NotebookLM avec des métadonnées thread/source
5. Les réponses enregistrées affichent un indicateur **déjà enregistré** pour éviter les doublons

**Questions et réponses sur les documents + flux de travail NotebookLM :**
1. Ouvrez un document dans Incrementum
2. Utilisez **Document Q&A** avec le mode de recherche NotebookLM
3. Modifier/affiner le texte de réponse généré en ligne
4. Créez des extraits de la réponse affinée
5. Générez des flashcards/cloze/éléments de questions-réponses à partir de ces extraits**Dépannage :**
- Si l'aperçu de l'artefact indique que le média n'est pas disponible, attendez la fin de la génération NotebookLM et rouvrez l'artefact.
- Si vous utilisez le fournisseur `cli`, assurez-vous que le side-car/CLI NotebookLM est disponible dans votre build.
- Si vous avez changé de fournisseur ou si l'authentification a expiré, reconnectez-vous dans Intégrations → NotebookLM.

#### Serveurs MCP

**Serveurs MCP (Model Context Protocol) :**

Connectez jusqu'à 3 serveurs MCP pour des fonctionnalités basées sur l'IA :

1. Paramètres → AI → Serveurs MCP
2. Ajouter l'URL du serveur
3. Configurer l'authentification
4. Activez les fonctionnalités :
   - Génération de carte à puce
   - Résumé du contenu
   - Aide aux questions et réponses
   - Marquage automatique

### Paramètres IA

#### Fournisseurs d'assurance qualité

Configurez les fournisseurs d'IA pour la génération de cartes :

**Fournisseurs pris en charge :**
-OpenAI (GPT-4, GPT-3.5)
- Anthropique (Claude)
- LLM locaux (Ollama, LM Studio)
- Points de terminaison d'API personnalisés

**Paramètres par fournisseur :**
- Clé API
- Nom du modèle
- Température (créativité)
- Nombre maximum de jetons
- Invite système

#### Génération automatique

**Génération de carte :**
- Activer la génération automatique à partir d'extraits
- Nombre de cartes par extrait
- Seuil de qualité
- Exiger une approbation manuelle

**Résumé :**
- Résumer automatiquement de longs extraits
- Longueur du résumé (court, moyen, long)
- Inclure dans le contenu de la carte

#### Fenêtre contextuelle

**Limites des jetons :**
- Max jetons par demande
- Contexte des cartes associées
- Longueur de l'extrait de document

---

## Fonctionnalités avancées

### Graphique de connaissances

Visualisez les liens entre vos connaissances :

**Vue graphique 2D :**
- Nœuds : Documents, extraits, fiches
- Bords : Relations (même catégorie, tags, références)
- Disposition dirigée par la force
- Navigation interactive

**Sphère de connaissances 3D :**
- Visualisation 3D immersive
- Rotation, zoom, panoramique
- Code couleur par catégorie
- Cliquez sur les nœuds pour afficher le contenu

**Caractéristiques :**
- Rechercher et filtrer
- Mettre en surbrillance les éléments associés
- Exporter sous forme d'image
- Identifier les lacunes dans les connaissances

### Lecteur RSS

Apprenez de vos flux préférés :

#### Répertoire des newsletters

Découvrez et abonnez-vous aux newsletters populaires directement dans Incrementum :

**Accédez au répertoire des newsletters :**
1. Cliquez sur l'onglet **RSS**
2. Cliquez sur l'**icône Newsletter** (📬) dans l'en-tête.
3. Parcourez les newsletters organisées par catégorie

**Catégories de newsletter :**
- **Technologie** : Actualités technologiques, programmation, IA
- **Science** : Recherche, découvertes, connaissances scientifiques
- **Finance** : Investissements, marchés, finances personnelles
- **Business** : Entrepreneuriat, stratégie, création d'entreprise
- **Santé** : Bien-être, médecine, mode de vie sain
- **Lifestyle** : Culture, voyages, gastronomie, développement personnel
- **Politique** : Politique, gouvernance, actualité
- **Arts et littérature** : livres, art, musique, écriture créative
- **Éducation** : apprentissage, enseignement, connaissances académiques
- **Crypto & Web3** : Blockchain, DeFi, actualités cryptomonnaies

**Abonnement aux newsletters :**
1. Parcourez l'annuaire ou recherchez une newsletter
2. Cliquez sur **S'abonner** sur n'importe quelle newsletter
3. Le flux est automatiquement ajouté à vos abonnements RSS
4. De nouveaux numéros apparaîtront dans votre lecteur RSS

**Découverte du flux de newsletter :**

Incrementum peut découvrir automatiquement les flux RSS des plateformes de newsletter populaires :

- **Substack** : ajoutez `/feed` à n'importe quelle URL de sous-pile
  - Exemple : `https://author.substack.com` → `https://author.substack.com/feed`
- **Beehiiv** : découvre automatiquement le point de terminaison `/feed`
- **Blogs fantômes** : découverte automatique du point de terminaison `/rss/`
- **Buttondown** : Ajoutez `/feed` à l'URL de la newsletter
- **Générique** : découvre automatiquement les flux RSS à partir des balises HTML `<link>`

**Abonnez-vous rapidement à partir de l'URL :**
1. Copiez n'importe quelle URL de newsletter
2. Cliquez sur **Ajouter un flux** dans l'onglet RSS
3. Collez l'URL
4. Incrementum découvre automatiquement le flux RSS
5. Cliquez sur **Ajouter un flux** pour vous abonner

**Recherche des flux RSS de la newsletter :**

La plupart des plateformes de newsletter publient des flux RSS :

| Plateforme | Modèle de flux RSS | Exemple |
|--------------|--------|---------|
| Sous-pile | `https://[auteur].substack.com/feed` | `https://stratechery.substack.com/feed` |
| Beehiiv | `https://[newsletter].beehiiv.com/feed` | `https://banklesshq.beehiiv.com/feed` |
| Fantôme | `https://[blog].ghost.io/rss/` | `https://blog.ghost.io/rss/` |
| Boutonnée | `https://buttondown.email/[nom]/feed` | `https://buttondown.email/newsletter/feed` |

**Plateformes prises en charge :**
- Sous-pile (la plupart des newsletters)
- Beehiiv
- Blogs fantômes
- Boutonné
- ConvertKit
-Revue
- Publications moyennes
- Sites WordPress (génériques)

**Abonnements à la newsletter d'importation/exportation :**
- **OPML Import** : Importer depuis d'autres lecteurs RSS
- **Export OPML** : sauvegardez vos abonnements à la newsletter
- Partager des abonnements entre appareils

#### Gestion des flux

1. Cliquez sur l'onglet **RSS**
2. Cliquez sur **Ajouter un flux**
3. Saisissez l'URL du flux
4. Définir l'intervalle de mise à jour
5. Activer l'importation automatique dans la file d'attente

**Fonctionnalités du flux :**
- Sondage automatique pour les nouveaux articles
- Importer des articles sous forme de documents
- Extraire automatiquement les points clés
- Créer des cartes à partir de flux**Flux recommandés :**
- Sites d'information (BBC, CNN, etc.)
- Blogs dans votre domaine
- Revues de recherche
- Actualité technologique (Hacker News, Ars Technica)

### Intégration YouTube

**Importation vidéo :**
1. Copiez l'URL de YouTube
2. Importer en tant que document
3. Incrementum récupère :
   - Métadonnées vidéo
   - Transcription (si disponible)
   - Informations sur le chapitre
   - Commentaires (facultatif)

**Caractéristiques de la transcription :**
- Transcription complète consultable
- Créer des extraits de transcription
- Synchroniser la transcription avec la vidéo
- Créer des cartes avec des horodatages

**Panneau de fonctionnalités vidéo :**
- Ouvrez le bouton **Panneaux** dans la visionneuse vidéo
- Onglets pour les signets, les chapitres, la transcription
- Les signets enregistrent les horodatages pour des sauts rapides
- Les chapitres peuvent être récupérés sur YouTube

**Extraits vidéo :**
1. Ouvrez les **Panneaux** → **Extraits vidéo**.
2. Cliquez sur **Nouveau**
3. Définir le début/la fin et le texte de transcription facultatif
4. Enregistrez pour créer un clip réutilisable

**Intégration SponsorBlock :**
- Sauter automatiquement les segments sponsorisés
- Filtrage par catégorie
- Contribuer à SponsorBlock

**Suivi des progrès :**
- Reprendre de la dernière position
- Marquer les sections regardées
- Regarder l'historique

### Transcription vidéo locale (application de bureau)

Générez des transcriptions pour les fichiers vidéo locaux dans l'application de bureau Tauri.

1. Ouvrez une vidéo locale
2. Ouvrez les **Panels** → **Transcription**.
3. Choisissez un modèle et une langue
4. Cliquez sur **Générer une transcription**

Remarques :
- La transcription s'exécute localement sur votre machine
- Nécessite un chemin de fichier local (non disponible pour les vidéos Web uniquement)

### Transcription de livres audio (application de bureau)

Créez des transcriptions pour les livres audio afin de permettre la sélection et la synchronisation du texte.

1. Importer un livre audio
2. Ouvrez la visionneuse de livres audio
3. Cliquez sur **Démarrer la transcription locale**
4. Surveillez les progrès et ouvrez le panneau de transcription

Remarques :
- La transcription s'exécute localement sur votre machine
- Les modèles sont gérés dans **Paramètres → Transcription audio**

### OCR (reconnaissance optique de caractères)

Extraire le texte des images :

**Fournisseurs pris en charge :**
- Google Cloud Vision
- Texte AWS
- Mistral OCR
- Mathpix (pour les équations mathématiques)
-GPT-4o
-Claude Vision
- OCR locale (Tesseract)

**Cas d'utilisation :**
- Capture d'écran
- Documents numérisés
- Images avec texte
- Notes manuscrites

**Configuration :**
1. Paramètres → ROC
2. Choisissez le fournisseur
3. Configurer la clé API
4. Sélectionnez la ou les langues
5. Testez avec un exemple d’image

**OCR mathématique :**
- Gestion spécialisée des équations
- Sortie LaTeX
- Reconnaissance des symboles
- Idéal pour : articles scientifiques, manuels scolaires

### Palette de commandes

Accès rapide à toutes les commandes :

**Ouvrir :** `Ctrl+K` (ou `Cmd+K` sur Mac)

**Caractéristiques :**
- Recherche floue
- Navigation au clavier
- Commandes récemment utilisées
- Recherche par nom ou raccourci
- Les résultats de la recherche accèdent à l'emplacement correspondant dans les documents et mettent en surbrillance la requête (PDF, EPUB, Web Imports)
- Les correspondances de transcription YouTube recherchent l'horodatage et démarrent la lecture
- Survolez le résultat d'un document pour voir des correspondances supplémentaires du même document

**Commandes communes :**
- "Importer un document"
- "Démarrer la révision"
- "Créer une carte"
- "Ouvrir les paramètres"
- "Exporter des données"

### Mode Vimium

Navigation au clavier de style Vim pour les utilisateurs expérimentés :

**Activer :** Paramètres → Raccourcis clavier → Activer Vimium

**Navigation :**
- `j` / `k` : Défiler vers le bas/vers le haut
- `h` / `l` : Défilement vers la gauche/droite
- `gg` : Aller en haut
- `G` : Aller en bas
- `/` : Recherche
- `n` / `N` : résultat de recherche suivant/précédent

**Actions :**
- `f` : astuces de lien (éléments cliquables)
- `i` : entrez en mode de saisie
- `Escape` : Quitter le mode de saisie

**Personnalisation :**
- Remapper les clés
- Créer des commandes personnalisées
- Partager les configurations de raccourcis clavier

### Recherche et filtrage

Recherche avancée sur tout le contenu :**Recherche en texte intégral :**
- Rechercher le contenu de la carte, les extraits, les documents
- Opérateurs booléens (ET, OU, NON)
- Recherche d'expression ("expression exacte")
- Caractères génériques (carte*)

**Filtres de recherche :**
- `category:programming` : Recherche dans la catégorie
- `tag:urgent` : Recherche par tag
- `type:cloze` : Recherche par type de carte
- `due:today` : recherche des cartes dues
- `rating:again` : recherche par note

**Recherches enregistrées :**
1. Effectuer une recherche
2. Cliquez sur « Enregistrer la recherche »
3. Nommez et enregistrez
4. Accès depuis le menu déroulant de recherche

### Extension du navigateur

Connectez Incrementum à la navigation Web :

**Caractéristiques :**
- Mettre en surbrillance des pages Web
- Créer des extraits d'articles
- Synchronisation avec l'application de bureau
- Ajout rapide à la file d'attente
- Avis basés sur un navigateur

**Configuration :**
1. Installer l'extension (Chrome/Firefox)
2. Associez-le à l'application de bureau
3. Accorder des autorisations
4. Commencez à utiliser !

**Utilisation :**
- Sélectionnez le texte sur la page Web
- Cliquez sur l'icône d'extension
- Choisissez "Ajouter à l'incrémentum"
- Se synchronise automatiquement

---

## Conseils et bonnes pratiques

### Création de cartes

**FAIRE :**
- Rendre les cartes spécifiques (un fait par carte)
- Utiliser un langage simple et clair
- Inclure le contexte dans les réponses
- Ajouter des exemples pertinents
- Utilisez Cloze pour les relations
- Gardez les questions concises

**À NE PAS FAIRE :**
- Mettez plusieurs faits sur une seule carte
- Utiliser des termes vagues
- Posez des questions trop faciles ou trop difficiles
- Copier de gros blocs de texte
- Utiliser des abréviations sans définition

**Exemple – Mauvaise carte :**
```
Q : Quelle est la fonction des mitochondries et comment
est-ce lié à la production d'ATP dans la respiration cellulaire ?
R : [Explication du paragraphe]
```

**Exemple – Bonnes cartes :**
```
Carte 1 :
Q : Quelle est la fonction principale des mitochondries ?
A : Produire de l'ATP par la respiration cellulaire

Carte 2 :
Q : Quel processus les mitochondries utilisent-elles pour produire de l’ATP ?
A : Respiration cellulaire (aérobie)

Carte 3 :
Q : Quelle est la monnaie énergétique produite par les mitochondries ?
A : ATP (adénosine triphosphate)
```

### Programme d'étude

**Horaire quotidien (20-30 min) :**
1. **Matin** : Révision des cartes dues (15 min)
2. **Tout au long de la journée** : créez des extraits de lecture
3. **Soirée** : Créez des cartes à partir d'extraits (10-15 min)

**Horaire hebdomadaire :**
- **Lun-Ven** : révisions régulières et création de cartes
- **Samedi** : séances d'étude plus longues (1-2 heures)
- **Dimanche** : examinez les analyses, ajustez les objectifs, organisez

**Gestion de gros volumes :**
- Définir une limite de révision quotidienne (par exemple, 50 cartes)
- Prioriser par catégorie (se concentrer sur un sujet)
- Utilisez des files d'attente intelligentes pour répartir les tâches
- Faites des pauses toutes les 20-30 minutes

### Optimisation de la rétention

**Améliorer le taux de rétention :**
- Évaluez honnêtement (ne gonflez pas les notes)
- Révisez de manière cohérente (quotidiennement, c'est mieux)
- Dormez suffisamment (la mémoire se consolide pendant le sommeil)
- Rappel actif (ne regardez pas, réfléchissez d'abord)
- Revues espacées (ne pas bourrer)

**Faire face à l'oubli :**
- Normal d'oublier 10-20 % (en fonction de la rétention cible)
- Les cartes "Encore" sont des opportunités d'apprentissage
- En cas d'oubli fréquent (>30 %), pensez à :
  - Diminution de la rétention souhaitée (85-90%)
  - Créer des cartes plus simples
  - Ajout de plus de contexte
  - Réviser plus fréquemment

### Organisation de la catégorie

**Meilleures pratiques :**
- Commencez large, puis subdivisez
- Exemple : `Programmation` → `Programmation/Python` → `Programmation/Python/Async`
- Utiliser une dénomination cohérente
- N'en créez pas trop (5-10 est gérable)
- Fusionner les catégories inutilisées

**Exemple de structure de catégorie :**
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

**Directives prioritaires :**
- **100 (Critique)** : Préparation aux examens, projets de travail urgents
- **80-90 (Élevé)** : Cours actuels, apprentissage actif
- **60-70 (Moyen)** : Intérêts continus, connaissances générales
- **40-50 (Bas)** : Agréable à savoir, supplémentaire
- **0-20 (Archive)** : référence uniquement, rarement examiné

**Planification prioritaire :**
- Concentrez-vous sur la priorité 80+ pour les examens quotidiens
- Révisez 60-70 tous les quelques jours
- Révision 40-50 par semaine
- Révision 0-20 mensuellement ou à la demande

### Utilisation des intervalles d'aperçu

La fonction **Intervalle de prévisualisation** vous indique exactement quand chaque carte apparaîtra ensuite pour les quatre évaluations.

**Comment utiliser :**
1. Lisez la carte
2. Vérifiez les intervalles d'aperçu sous les boutons d'évaluation
3. Choisissez la note en fonction de :
   - Votre rappel actuel
   - Dans combien de temps tu veux le revoir
   - Votre emploi du temps (par exemple, examen à venir)**Exemple de stratégie :**
- Examen dans 2 semaines : Notez « Facile » sur les cartes importantes pour les revoir bientôt
- Journée chargée : notez "Bon" ou "Facile" pour espacer les avis
- Vous voulez maîtriser : notez "Difficile" pour réviser plus fréquemment

### Gérer le dépassement de soi

**Trop de cartes dues ?**
1. Définir la limite de révision (Paramètres → Révision → Max par jour)
2. Concentrez-vous sur les éléments hautement prioritaires
3. Suspendre temporairement les catégories peu prioritaires
4. Envisagez de réduire légèrement la rétention souhaitée

**Trop de contenu à traiter ?**
1. Importez les documents progressivement
2. Extrayez uniquement les points clés (pas tout)
3. Créez des cartes de manière sélective
4. Utilisez des catégories pour organiser

**Burn-out ?**
1. Faites une pause (c'est bon !)
2. Réduisez les limites quotidiennes
3. Suspendre les catégories non critiques
4. Concentrez-vous sur une catégorie à la fois

---

## Dépannage

### Problèmes courants

#### Les cartes n'apparaissent pas dans la révision

**Causes possibles :**
- Toutes les cartes examinées pour aujourd'hui
- Cartes suspendues
- Filtrer les cartes masquées actives

**Solutions :**
1. Vérifiez le nombre de « échéances » dans l'onglet Révision.
2. Vérifier la file d'attente → Assurez-vous que les cartes ne sont pas suspendues
3. Effacer les filtres
4. Vérifiez la date de révision (peut-être les cartes prévues pour le futur)

#### Mauvais taux de rétention

**Symptômes :** Oubli de nombreuses cartes, évaluations fréquentes « Encore »

**Solutions :**
1. **Évaluer la qualité des cartes** : Les cartes sont-elles claires ? Un fait par carte ?
2. **Rétention souhaitée inférieure** : essayez 85 % au lieu de 90 %
3. **Révisez plus fréquemment** : critiques quotidiennes, pas de bourrage
4. **Ajouter un contexte** : plus d'informations dans les réponses
5. **Simplifier les cartes** : divisez les cartes complexes en cartes plus simples

#### Conflits de synchronisation

**Symptômes :** Cartes en double, incohérences de données après la synchronisation

**Solutions :**
1. Choisissez la stratégie de résolution des conflits (Paramètres → Sync)
   - **Gains locaux** : conservez vos modifications
   - **Gagnements à distance** : Acceptez les modifications du serveur
   - **Demander** : résoudre manuellement chaque conflit
2. Synchronisez régulièrement pour minimiser les conflits
3. Utilisez un appareil principal

#### Échecs de l'importation

**Symptômes :** L'importation de documents échoue ou contient des erreurs

**Solutions :**
1. **Vérifiez le format du fichier** : assurez-vous que le format est pris en charge (PDF, EPUB, etc.)
2. **Vérifier la taille du fichier** : les fichiers très volumineux peuvent expirer
3. **Vérifiez l'URL** : certains sites bloquent l'accès automatisé
4. **Vérifiez Internet** : l'importation d'URL nécessite une connexion
5. **Essayez une alternative** : utilisez le copier-coller pour le contenu Web

#### Problèmes de performances

**Symptômes :** Chargement lent, décalage, blocage

**Solutions :**
1. **Grande base de données** : Archivez les anciennes cartes (Paramètres → Données → Archiver)
2. **Beaucoup d'images** : les images ralentissent le chargement
3. **Ressources système** : fermez les autres applications
4. **Reconstruire la base de données** : Paramètres → Données → Reconstruire (dernier recours)

#### L'OCR ne fonctionne pas

**Symptômes :** L'OCR échoue ou produit des résultats médiocres

**Solutions :**
1. **Vérifiez la clé API** : valide et dispose de crédits
2. **Vérifiez la qualité de l'image** : les images claires et haute résolution fonctionnent mieux
3. **Vérifier la langue** : Corriger la langue sélectionnée
4. **Essayez un fournisseur alternatif** : certains fonctionnent mieux pour certains contenus
5. **OCR local** : utilisez Tesseract en cas de problèmes Internet

### Obtenir de l'aide

**Ressources :**
- **Documentation** : consultez le dossier `docs/` pour des guides détaillés
- **Problèmes GitHub** : signaler les bugs et les demandes de fonctionnalités
- **Communauté** : rejoignez les discussions, posez des questions
- **Raccourcis clavier** : appuyez sur « ? » dans l'application pour une référence rapide

**Mode débogage :**
Activez la journalisation du débogage (Paramètres → Avancé → Mode débogage) pour résoudre les problèmes.

**Exportation de données :**
Exportez vos données avant les changements majeurs (Paramètres → Sauvegarde → Exporter)

### Récupération

**Suppression accidentelle :**
1. Vérifiez les sauvegardes (Paramètres → Sauvegarde)
2. Restaurer à partir d'une sauvegarde récente
3. Contactez le support si aucune sauvegarde n'est disponible

**Base de données corrompue :**
1. Exportez les données immédiatement
2. Reconstruire la base de données (Paramètres → Données → Reconstruire)
3. Importer les données exportées
4. Vérifiez toutes les données présentes

**Progrès perdu :**
1. Vérifiez Analytics → Exporter pour les données historiques
2. Restaurer à partir d'une sauvegarde si nécessaire
3. Synchronisez avec le fournisseur de cloud si activé

---

## Glossaire

**Extrait** : élément de contenu extrait d'un document, matériel de carte potentiel

**Élément d'apprentissage** : tout élément à apprendre (flashcard, cloze, questions-réponses, etc.)

**File d'attente** : tous les éléments dont l'examen est programmé, organisés par priorité

**Séance de révision** : une période de rappel actif et de cartes d'évaluation

**FSRS** : Free Spaced Repetition Scheduler, algorithme moderne optimisant le timing de révision (FSRS-5 est la version actuelle)

**Intervalle** : délai entre les examens (par exemple, 7 jours)

**Stabilité** : durée d'une mémoire (métrique FSRS)

**Difficulté** : la difficulté d'un élément pour vous, sur une échelle de 1 à 10 (métrique FSRS)

**Récupérabilité** : probabilité actuelle de rappel, 0 à 100 % (métrique FSRS)

**Rétention souhaitée** : taux de rétention cible (généralement 90 %)

**Intervalle de prévisualisation** : fonctionnalité affichant la prochaine date de révision pour chaque option de notation

**Cloze** : type de carte à remplir

**Suspendre** : masquer temporairement l'article des avis

**Catégorie** : Domaine de l'organisation

**Tag** : étiquette personnalisée pour une organisation intercatégorielle

**Priorité** : importance définie par l'utilisateur (0 - 100)

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
| `Ctrl/Cmd + N` | Importer un document (alternative) |
| `Ctrl/Cmd + /` | Afficher les raccourcis clavier |
| `?` | Afficher les raccourcis clavier (sans modificateur) |

### Raccourcis du mode Révision

| Raccourci | Actions |
|--------------|--------|
| `Espace` | Afficher la réponse |
| '1' | Notez "Encore" |
| '2' | Noter "Difficile" |
| '3' | Noter « Bon » |
| '4' | Noter "Facile" |
| `Ctrl/Cmd + Entrée` | Afficher la réponse (alternative) |
| `Ctrl/Cmd + 1/2/3/4` | Évaluer sans afficher la réponse |
| `Échap` | Fin de séance |
| `Ctrl/Cmd + E` | Modifier la carte actuelle (pas encore implémenté) |
| `Ctrl/Cmd + D` | Supprimer la carte actuelle (aussi utilisé globalement pour « Aller au tableau de bord ») |
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

**Q : Comment ajouter des newsletters à Incrementum ?**
R : Vous pouvez ajouter des newsletters de deux manières :
1. **Répertoire des newsletters** : cliquez sur RSS → Icône de newsletter (📬) → Parcourez et abonnez-vous aux newsletters organisées
2. **URL directe** : copiez n'importe quelle URL de newsletter (Substack, Beehiiv, etc.) → RSS → Ajouter un flux → Coller l'URL. Incrementum découvrira automatiquement le flux RSS.

**Q : Quelles plateformes de newsletter sont prises en charge ?**
R : Incrementum prend en charge les flux RSS des sites Substack, Beehiiv, Ghost blogs, Buttondown, ConvertKit, Revue, Medium et WordPress. La plupart des newsletters publient des flux RSS – consultez le site Web de la newsletter pour un lien RSS ou essayez d'ajouter « /feed » à l'URL.

**Q : Combien de cartes dois-je examiner par jour ?**
R : Commencez avec 20 à 50 par jour. Ajustez en fonction de votre emploi du temps et de vos objectifs. La cohérence est plus importante que le volume.

**Q : Combien de cartes puis-je créer par jour ?**
R : Autant que vous le souhaitez, mais concentrez-vous sur la qualité plutôt que sur la quantité. 10 à 20 cartes bien faites valent mieux que 50 mauvaises.

**Q : Quel taux de rétention dois-je cibler ?**
R : 90 % est la valeur par défaut recommandée. Ajustez à 85 % si vous avez trop d'avis, ou à 95 % pour le matériel critique.

**Q : Puis-je utiliser Incrementum pour les langues ?**
R : Absolument ! C'est excellent pour les cartes de vocabulaire, de grammaire et de phrases. Utilisez des cartes Cloze pour les modèles de grammaire.

**Q : Comment gérer les équations mathématiques ?**
R : Utilisez la syntaxe LaTeX dans les cartes. Pour l'OCR, utilisez le fournisseur Mathpix pour obtenir de meilleurs résultats avec le contenu mathématique.

**Q : Puis-je synchroniser avec Anki ?**
R : Oui ! Configurez AnkiConnect dans Paramètres → Intégrations → Anki pour la synchronisation bidirectionnelle.

**Q : Quelle est la différence entre la suspension et la suppression ?**
R : La suspension masque temporairement les cartes (peut être rétablie). La suppression supprime définitivement (peut être restaurée à partir d'une sauvegarde).

**Q : À quelle fréquence dois-je réviser ?**
R : L’idéal est de le faire quotidiennement. Si vous manquez des jours, les cartes s'accumuleront mais ne seront pas « perdues » - rattrapez-les quand vous le pouvez.

**Q : Puis-je utiliser Incrementum sur plusieurs appareils ?**
R : Pas encore directement, mais vous pouvez synchroniser les données via Dropbox/Google Drive ou utiliser l'extension du navigateur.

**Q : Mes données sont-elles privées ?**
R : Oui ! Toutes les données stockées localement. La synchronisation cloud est cryptée. Aucune donnée envoyée aux serveurs, à l'exception des fournisseurs d'IA configurés.

**Q : Comment exporter mes cartes ?**
R : Paramètres → Sauvegarde → Exporter, ou utilisez la synchronisation Anki pour exporter au format .apkg.

---

## Journal des modifications

Voir [CHANGELOG.md](../CHANGELOG.md) pour l'historique des versions et les mises à jour.

---

## Assistance et communauté

- **Documentation** : [docs/](./)
- **GitHub** : [incrementum-tauri](https://github.com/melpomenex/incrementum-tauri)
- **Problèmes** : [Signaler des bugs](https://github.com/melpomenex/incrementum-tauri/issues)
- **Discussions** : [Poser des questions](https://github.com/melpomenex/incrementum-tauri/discussions)

---

**Bon apprentissage ! 🚀**

Construit avec ❤️ en utilisant Tauri + React + Rust
