# Instructions pour un assistant

Ce dépôt est le projet d'un étudiant de l'Académie IA : un clone d'Airbnb
construit module après module. Ces règles valent pour tout assistant qui écrit
du code ici.

Le cours est en français, et le code aussi. Nommez les fichiers, les classes,
les tables et les variables en français, sauf là où ce document dit le
contraire.

## Ce qu'il ne faut jamais faire

**Ne modifiez jamais un fichier de `academie/`.** C'est le harnais de
vérification de l'Académie, et c'est la copie de l'examen. Ses empreintes sont
comparées à chaque remise : un fichier modifié envoie le travail de l'étudiant
en revue humaine, même s'il est juste.

Quand une vérification échoue, la réponse n'est jamais de changer le test. Elle
est de corriger le code de l'étudiant, dans `src/` ou dans `web/`.

**Ne mettez aucun secret dans le code.** L'adresse de connexion à la base et
les clés d'API vont dans `.env`, qui n'est pas versionné. Un mot de passe
poussé sur GitHub reste lisible dans l'historique après avoir été retiré.

**Ne remplacez pas les choix de l'étudiant sans le lui dire.** S'il a nommé une
table `annonces`, gardez `annonces`.

## Comment les vérifications atteignent le code

Les suites de `academie/checks/` n'importent jamais les fichiers de l'étudiant
directement. Elles importent un seul fichier par module, qu'il écrit :

```text
src/academie/module-1.ts
src/academie/module-2.ts
```

Ce fichier est un **adaptateur** : il réexporte, sous les noms que le harnais
attend, ce que l'étudiant a construit sous les noms qu'il a choisis.

```ts
// À gauche, le nom attendu. À droite, celui de l'étudiant.
export { Reservation as Booking } from '../domaine/reservation'
```

C'est le seul endroit du dépôt où des noms anglais sont imposés. Partout
ailleurs, le français est la règle.

L'en-tête de chaque fichier de `academie/checks/module-N/` écrit exactement ce
que l'adaptateur de ce module doit exporter. Lisez-le avant d'écrire du code
pour un module.

## Les conventions du domaine

Ces trois règles sont vérifiées par le harnais et expliquées dans
`docs/decisions/`. Les enfreindre fait échouer un module.

- **Un intervalle de séjour est semi-ouvert.** La date d'arrivée est comprise,
  la date de départ est exclue. Du 1er au 4 mars fait trois nuits. Un séjour de
  zéro nuit, ou dont le départ précède l'arrivée, est refusé à la construction.
- **Les montants sont des entiers**, dans la plus petite unité de la monnaie.
  On stocke `2550` pour 25,50. Jamais `real`, jamais `numeric`, jamais un
  nombre à virgule.
- **Le cycle de vie d'une réservation est décrit en un seul endroit.** Les
  passages autorisés vivent dans un seul objet, et une méthode unique les
  applique. Pas de `if` sur un état dispersés dans plusieurs fichiers.

## La structure

```text
academie/            le harnais. Ne pas toucher.
src/                 l'API, en Hono. Et src/academie/ pour les adaptateurs.
web/                 le front, en Vite et React.
docs/decisions/      pourquoi les choses sont ainsi.
```

Le front et l'API sont **deux applications** qui s'installent séparément.
`npm install` à la racine pour l'API et les vérifications, `npm install` dans
`web/` pour le front. À partir du module 3, les vérifications construisent aussi le
front avec `npm run build` : une erreur de type dans `web/` fait échouer le module.

## Les commandes

```bash
npm run academie 2     # les vérifications jusqu'au module 2, cumulatives
npm run dev            # l'API, sur le port 3000
npm run typecheck      # les types de l'API

cd web && npm run dev  # le front, sur le port 5173
```

Lancez `npm run academie N` avant chaque push. Les vérifications sont
cumulatives : au module 5, celles des modules 1 à 4 tournent encore.

## Le front

Tailwind CSS et [shadcn/ui](https://ui.shadcn.com) sont déjà configurés. Un
composant s'ajoute à la commande, depuis `web/` :

```bash
npx shadcn@latest add button
```

Il arrive dans `web/src/components/ui`. C'est un fichier de l'étudiant : il se
modifie librement, et ce n'est pas une dépendance à mettre à jour.

Le kit en fournit déjà plusieurs : bouton, champ, étiquette, carte, badge,
séparateur, boîte de dialogue, fenêtre flottante, et `calendar`, qui choisit
une plage de dates. Le routeur est `react-router`, câblé dans
`web/src/main.tsx`. Des logements inventés attendent dans
`web/src/donnees/fictives.ts`.

Les écrans se construisent au module 3 sur ces données fictives. Chaque module
suivant branche l'écran qui le concerne sur l'API : quand vous aidez à ce
branchement, remplacez l'import des données fictives par un appel à l'API, sans
réécrire la mise en page.

C'est le second endroit, avec l'adaptateur, où des noms anglais sont imposés.
On garde ici la convention de shadcn plutôt que la traduire : c'est celle que
toute la documentation et tous les assistants emploient, et s'en écarter ferait
échouer la moitié des réponses qu'on obtient en demandant de l'aide.

Les couleurs sont des variables CSS dans `web/src/styles.css`. Ne mettez jamais
une couleur en dur dans un composant.

**N'écrivez pas de composant maison pour ce que shadcn fournit déjà**, en
particulier le sélecteur de plage de dates. Écrire un calendrier accessible
prend une semaine et n'apprend rien de ce que le parcours enseigne.
