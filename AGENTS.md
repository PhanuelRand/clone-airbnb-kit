# Instructions pour un assistant

Ce dépôt est le projet d'un étudiant de l'Académie IA : un clone d'Airbnb
construit module après module, en dix-huit modules. L'étudiant débute souvent
en programmation. Ces règles valent pour tout assistant qui écrit du code ici.

Expliquez ce que vous faites en français simple, et définissez un mot technique
la première fois que vous l'employez. Nommez les fichiers, les classes, les
tables et les variables en français, sauf là où ce document dit le contraire.

## Ce qu'il ne faut jamais faire

**Ne modifiez jamais `academie/checks/`, `academie/run.mjs` ni
`.github/workflows/academie.yml`.** Ce sont les vérifications de l'Académie.
Leurs empreintes sont comparées à chaque remise : un fichier modifié envoie le
travail de l'étudiant en revue humaine, même s'il est juste.

Quand une vérification échoue, la réponse n'est jamais de changer le test. Elle
est de corriger le code de l'étudiant, dans `src/`, `web/` ou `migrations/`.

**Ne mettez aucun secret dans le code.** L'adresse de la base et les clés vont
dans `.env`, qui n'est pas versionné. Un mot de passe envoyé sur GitHub reste
lisible dans l'historique après avoir été retiré.

**Ne remplacez pas les choix de l'étudiant sans le lui dire.** S'il a nommé une
table `annonces`, gardez `annonces`.

**N'ajoutez pas de service qui exige une carte bancaire.** Le parcours n'en
emploie aucun : le paiement est simulé, les photos passent par un stockage
simulé en local et par Supabase Storage en production, l'hébergement se fait
sur Render.

## Comment les vérifications atteignent le code

Les suites de `academie/checks/` n'importent jamais les fichiers de l'étudiant.
Elles importent un fichier par module, `src/academie/module-N.ts`, que le cours
appelle le **fichier traducteur**. Il réexporte, sous les noms attendus, ce que
l'étudiant a construit sous ses propres noms.

```ts
// À gauche, le nom attendu. À droite, celui de l'étudiant.
export { Reservation as Booking } from '../domaine/reservation'
```

L'en-tête de chaque fichier de `academie/checks/module-N/` écrit exactement ce
que le fichier traducteur de ce module doit exporter. Lisez-le avant d'écrire
du code pour un module.

## Là où l'anglais est imposé

Partout ailleurs, le français est la règle.

- **Les noms exportés par les fichiers traducteurs**, comme `Booking` ou
  `createAccount`.
- **Les routes vérifiées au module 15** : `GET /health`, `GET /search`,
  `POST /listings`, `POST /bookings`.
- **Les composants de shadcn**, dans `web/src/components/ui`. On garde leur
  convention : c'est celle que toute la documentation emploie.

Les routes de connexion du module 5 sont libres : l'étudiant les déclare dans
son fichier traducteur.

## Les conventions du domaine

Elles sont expliquées dans `docs/decisions/`.

- **Un intervalle de séjour est semi-ouvert.** La date d'arrivée est comprise,
  la date de départ est exclue. Du 1er au 4 mars fait trois nuits.
- **Les montants sont des entiers**, dans la plus petite unité de la monnaie.
  L'ariary n'a pas de centimes : 120 000 Ar se stockent `120000`. Jamais
  `real`, jamais `numeric`, jamais un nombre à virgule.
- **Le cycle de vie d'une réservation est décrit en un seul endroit.** Les
  statuts sont `REQUESTED`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`,
  `CANCELLED` et `DECLINED`.
- **Un même compte peut être voyageur et hôte.** Les rôles sont une liste sur
  le compte.

## La base de données

PostgreSQL, avec la bibliothèque `pg` et du SQL écrit à la main. Pas d'ORM :
la règle centrale du parcours, aucune nuit vendue deux fois, repose sur une
contrainte d'exclusion que les ORM courants n'expriment pas.

Les migrations sont des fichiers `.sql` numérotés dans `migrations/`.
`npm run migrate` les applique, sur la machine comme dans les vérifications de
GitHub. Le code lit l'adresse de la base dans `process.env.DATABASE_URL`.

## La structure

```text
academie/            les vérifications. Ne pas toucher.
src/app.ts           les routes de l'API, en Hono.
src/serveur.ts       le démarrage de l'API.
src/academie/        les fichiers traducteurs.
migrations/          le SQL des tables.
web/                 l'interface, en Vite et React.
docs/                la spécification, les décisions, les rapports.
```

L'interface et l'API sont **deux applications** qui s'installent séparément.
À partir du module 3, les vérifications construisent aussi l'interface avec
`npm run build` : une erreur de type dans `web/` fait échouer le module.

## Les commandes

```bash
npm run academie 5     # les vérifications jusqu'au module 5
npm run migrate        # applique les migrations
npm run dev            # l'API, sur le port 3000
npm run dev:web        # l'interface, sur le port 5173
npm test               # les tests de l'étudiant, dans src/
npm run typecheck      # les types de l'API
node --env-file=.env scripts/approuver-hote.mjs courriel   # approuve un hôte
```

`npm run academie` écrit ses données d'essai dans `DATABASE_URL_VERIFICATION`
quand elle est définie, et y applique d'abord les migrations. Ne pointez jamais
cette variable vers la base de l'application.

Lancez `npm run academie N` avant chaque envoi. Les vérifications sont
cumulatives : au module 5, celles des modules 1 à 4 tournent encore.

Les modules 16 et 17, messagerie et avis, ne concernent que le palier Platine.

## L'interface

Tailwind CSS et [shadcn/ui](https://ui.shadcn.com) sont déjà configurés. Un
composant s'ajoute depuis `web/` :

```bash
npx shadcn@latest add button
```

Le kit en fournit déjà plusieurs : bouton, champ, étiquette, carte, badge,
séparateur, boîte de dialogue, fenêtre flottante, et `calendar`, qui choisit
une plage de dates. Le routeur est `react-router`, câblé dans
`web/src/main.tsx`. Des logements inventés attendent dans
`web/src/donnees/fictives.ts`.

Les écrans se construisent au module 3 sur ces données fictives. Chaque module
suivant branche l'écran qui le concerne sur l'API : remplacez l'import des
données fictives par un appel à l'API, sans réécrire la mise en page.

Les couleurs sont des variables CSS dans `web/src/styles.css`. Ne mettez jamais
une couleur en dur dans un composant.

**N'écrivez pas de composant maison pour ce que shadcn fournit déjà**, en
particulier le sélecteur de plage de dates.
