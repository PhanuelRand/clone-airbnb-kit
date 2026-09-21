# Module 2 — Fondations et modèle du domaine

Ce cours se suffit à lui-même : tout ce dont vous avez besoin pour terminer le
module est ici, y compris les outils à installer et les commandes à lancer.

## Ce que vous allez construire

Rien qui s'affiche. C'est le seul module du parcours dont le résultat ne se
regarde pas, et c'est normal : vous posez le vocabulaire sur lequel les sept
autres vont s'appuyer.

À la fin, votre base contient quatre tables et votre code contient un modèle de
réservation qui connaît ses propres règles.

```text
   ┌────────────┐                        ┌────────────┐
   │   hotes    │                        │ voyageurs  │
   └─────┬──────┘                        └──────┬─────┘
         │ 1                                    │ 1
         │ possède                              │ réserve
         │ n                                    │ n
   ┌─────▼──────┐  1                   n  ┌─────▼────────┐
   │  annonces  │◄─────────────────────────│ reservations │
   └────────────┘   porte sur              └──────────────┘
                                              statut
                                              arrivee, depart
                                              montant_total  (entier)
```

Prenez ce module au sérieux même s'il paraît administratif. Une machine à états
bâclée ici se paie au module 7, quand vous chercherez pourquoi une réservation
annulée bloque encore des dates.

## Avant de commencer

### Votre machine

```bash
node --version    # v20.19 ou plus récent
npm --version
git --version
psql --version    # PostgreSQL 14 ou plus récent
```

Si `psql` répond « commande introuvable », installez PostgreSQL localement, ou
lancez-le avec Docker si vous l'avez déjà :

```bash
docker run --name stays -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:18
```

Utilisez la **même adresse de connexion que l'intégration continue**. Vous
éviterez la classe d'erreurs la plus agaçante du parcours — celle où tout passe
chez vous et rien ne passe sur GitHub :

```bash
# .env — ne le commitez pas, il est déjà dans .gitignore
DATABASE_URL=postgres://postgres:postgres@localhost:5432/stays_test
```

Créez la base si elle n'existe pas :

```bash
createdb stays_test    # ou : psql -c "CREATE DATABASE stays_test"
```

Dernier point, et il compte si votre connexion est lente ou facturée : le
premier `npm install` télécharge quelques dizaines de mégaoctets, une fois pour
toutes. Faites-le quand vous avez du réseau. Ensuite, **tout le travail de ce
module se fait hors ligne**, y compris `npm run academie 2`.

### Les outils que vous devez choisir

Le kit ne contient que de quoi faire tourner les vérifications : TypeScript et
Vitest. Le reste vous appartient. C'est voulu — le parcours impose un résultat,
pas une pile.

Il vous manque deux choses pour ce module.

**Un client PostgreSQL.** `pg` est le standard de l'écosystème Node, et c'est
celui que les exemples de ce parcours utilisent :

```bash
npm install pg
npm install -D @types/pg
```

**Un moyen d'appliquer des migrations.** Trois options, par ordre de ce que je
vous recommande pour ce parcours :

| Option | Quand la choisir |
|---|---|
| **Fichiers `.sql` numérotés + un lanceur maison** | Recommandé. Une trentaine de lignes, aucune dépendance, et vous comprenez exactement ce qui s'exécute. Le lanceur est fourni ci-dessous. |
| `node-pg-migrate` | Si vous voulez des migrations réversibles sans les écrire vous-même. |
| Drizzle Kit | Si vous prévoyez d'utiliser Drizzle comme ORM par la suite. |

Quel que soit votre choix, la vérification lit vos fichiers `.sql` : elle ne
s'intéresse pas à l'outil, seulement au contenu des migrations.

### Faire tourner une migration

Si vous prenez l'option recommandée, voici le lanceur. Copiez-le dans
`scripts/migrate.mjs` : il crée un registre des migrations déjà appliquées, puis
joue les nouvelles, chacune dans sa propre transaction.

```js
// scripts/migrate.mjs — lancer avec : node --env-file=.env scripts/migrate.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

// Le registre : sans lui, on ne sait pas ce qui a déjà tourné.
await client.query(`
  CREATE TABLE IF NOT EXISTS migrations_appliquees (
    nom           text PRIMARY KEY,
    appliquee_le  timestamptz NOT NULL DEFAULT now()
  )
`)

const dossier = join(process.cwd(), 'migrations')
const fichiers = readdirSync(dossier)
  .filter((nom) => nom.endsWith('.sql'))
  .sort() // d'où l'intérêt de les numéroter : 001_, 002_…

for (const fichier of fichiers) {
  const { rowCount } = await client.query(
    'SELECT 1 FROM migrations_appliquees WHERE nom = $1',
    [fichier],
  )
  if (rowCount > 0) continue

  console.log(`→ ${fichier}`)
  // Une transaction par migration : elle passe en entier, ou pas du tout.
  await client.query('BEGIN')
  try {
    await client.query(readFileSync(join(dossier, fichier), 'utf8'))
    await client.query('INSERT INTO migrations_appliquees (nom) VALUES ($1)', [fichier])
    await client.query('COMMIT')
  } catch (erreur) {
    await client.query('ROLLBACK')
    throw erreur
  }
}

await client.end()
console.log('Migrations à jour.')
```

Ajoutez le raccourci dans votre `package.json` :

```json
"scripts": {
  "migrate": "node --env-file=.env scripts/migrate.mjs"
}
```

## Comment le harnais vous parle

Trois endroits vous disent quoi faire, et ils ne disent pas la même chose.

| Où | Ce que vous y trouvez |
|---|---|
| La consigne, sur le portail | Ce qu'il faut produire et les critères qui le mesurent |
| Ce cours | Comment y arriver |
| L'en-tête des fichiers de `academie/checks/module-2/` | Les **signatures exactes** attendues |

### L'adaptateur, la pièce à comprendre tout de suite

Les suites de vérification n'importent jamais vos fichiers directement. Elles
importent un seul fichier par module, `src/academie/module-N.ts`, que vous
écrivez. Il ne contient aucune logique : il **traduit** vos noms vers les noms
que le harnais attend.

```ts
// src/academie/module-2.ts
export { Reservation as Booking } from '../domaine/reservation'
export type { EtatReservation as BookingStatus } from '../domaine/reservation'

export const schema = {
  migrationsDir: 'migrations',
  tables: {
    host: 'hotes',
    guest: 'voyageurs',
    listing: 'annonces',
    booking: 'reservations',
  },
  moneyColumns: ['reservations.montant_total'],
}
```

Le chemin complet, de la vérification jusqu'à votre code :

```text
  academie/checks/module-2/              ← écrit par l'Académie
      booking-lifecycle.test.ts             ne le modifiez pas
              │
              │ importe, sous des noms imposés
              ▼
  src/academie/module-2.ts               ← VOUS l'écrivez
      export { Reservation as Booking }     il ne fait que traduire
              │
              │ réexporte
              ▼
  src/domaine/reservation.ts             ← VOUS l'écrivez
      export class Reservation              nommé comme VOUS voulez
```

Vous pouvez donc appeler votre classe `Reservation`, écrire votre code en
français, ranger vos fichiers comme vous voulez, nommer vos tables comme vous
voulez. Le harnais ne connaît que ce fichier.

L'objet `schema` mérite une seconde de plus : il sert aux vérifications qui
**lisent vos migrations** au lieu d'exécuter votre code. Comme elles ne peuvent
pas deviner que votre table de réservations s'appelle `reservations`, vous le
leur déclarez. Elles vérifient ensuite que ces tables existent vraiment et
portent les bonnes contraintes.

### Lire un échec

Au premier `npm run academie 2`, tout est rouge. C'est l'état normal de départ,
pas un problème d'installation. Voici les trois messages que vous verrez dans
cet ordre, et ce qu'ils signifient.

**Le fichier adaptateur n'existe pas encore :**

```text
FAIL  academie/checks/module-2/booking-lifecycle.test.ts
Error: Failed to load url ../../../src/academie/module-2
```

Créez `src/academie/module-2.ts`. C'est toujours la première chose à faire dans
un module.

**L'adaptateur existe mais n'exporte pas ce qu'il faut :**

```text
SyntaxError: The requested module does not provide an export named 'Booking'
```

Le nom exporté ne correspond pas. Relisez l'en-tête du fichier de check : il
donne la liste exacte.

**Le code tourne mais la règle n'est pas tenue :**

```text
AssertionError: expected [Function] to throw an error
 ❯ academie/checks/module-2/booking-lifecycle.test.ts:72:12
   refuse de terminer un séjour jamais confirmé
```

Celui-là est un vrai échec métier, et c'est le seul des trois qui vous apprend
quelque chose. Le nom du test dit la règle qui manque.

### Votre boucle de travail

```text
      écrire du code
            │
            ▼
   npm run academie 2 ───── rouge ────► lire le message, corriger ──┐
            │                                                        │
            │ vert                                                   │
            ▼                                                        │
        git push                              ◄─────────────────────┘
            │
            ▼
   onglet Actions du dépôt : academie/module-2 ✓
            │
            ▼
      module 3 déverrouillé
```

Restez à gauche de ce schéma le plus longtemps possible. La boucle locale prend
quelques secondes et ne demande aucun réseau; l'aller-retour par GitHub prend
quelques minutes et en demande.

## Pourquoi c'est plus difficile qu'il n'y paraît

Le piège de ce module n'est pas technique, il est organisationnel. Voici ce que
presque tout le monde écrit d'abord :

```ts
// NE FAITES PAS ÇA.
// Dans la route de confirmation :
if (reservation.statut === 'REQUESTED') {
  reservation.statut = 'CONFIRMED'
}

// Trois fichiers plus loin, dans le traitement du paiement :
reservation.statut = 'COMPLETED'

// Ailleurs encore, dans un script d'administration :
reservation.statut = 'CANCELLED'
```

Ça fonctionne. Le chemin nominal passe, la démonstration est convaincante, et
vous avancez.

### Pourquoi ça se dégrade

Chaque endroit qui écrit `statut` porte sa propre idée des règles. Le premier
vérifie d'où l'on vient, le deuxième ne vérifie rien, le troisième a été écrit
un vendredi. Au bout de trois modules, vous avez des réservations terminées qui
n'ont jamais été confirmées, et personne ne sait laquelle des cinq écritures en
est responsable.

Le problème n'est pas qu'une règle soit fausse : c'est qu'il n'y a **aucun
endroit** où lire les règles. Elles n'existent nulle part en entier.

La réponse est d'écrire les transitions **une seule fois, comme des données**,
et de faire passer toute modification d'état par ce point unique.

### Le deuxième piège, silencieux

Vous allez naturellement stocker deux colonnes, `arrivee` et `depart`. C'est ce
que tout le monde fait, et rien ne vous en empêchera avant le module 7 — où vous
découvrirez que PostgreSQL sait garantir qu'aucune nuit n'est vendue deux fois,
mais seulement si les dates vivent dans **un seul intervalle** et non dans deux
colonnes indépendantes.

Vous n'avez pas besoin de comprendre les intervalles aujourd'hui. Retenez
seulement la convention, et tenez-la partout.

## Les notions

### Une machine à états écrite comme donnée

Trois choses : la liste des états, la table des transitions autorisées, et une
seule fonction qui vérifie et applique. Toute la valeur est dans le mot
« seule ».

Voici le cycle de vie que vous devez implémenter :

```text
                    ┌─────────────┐
                    │  REQUESTED  │  le voyageur a demandé
                    └──────┬──────┘
           l'hôte accepte  │  l'hôte refuse
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐           ┌─────────────┐
       │  CONFIRMED  │           │  DECLINED   │ ●
       └──────┬──────┘           └─────────────┘
              │
  le voyageur │ arrive
              ▼
       ┌─────────────┐
       │ CHECKED_IN  │
       └──────┬──────┘
              │ le séjour se termine
              ▼
       ┌─────────────┐
       │  COMPLETED  │ ●
       └─────────────┘

   REQUESTED ──┐
               ├──► ┌─────────────┐
   CONFIRMED ──┘    │  CANCELLED  │ ●   l'une des deux parties annule
                    └─────────────┘

   ● état terminal : aucune transition n'en sort.
```

Deux règles que ce schéma encode et que la vérification contrôle :

- **refuser** (`DECLINED`) n'est possible que depuis `REQUESTED`. C'est la
  réponse d'un hôte à une demande. Une fois la réservation confirmée, la sortie
  s'appelle une annulation — et le module 8 leur appliquera des règles d'argent
  différentes;
- aucun état terminal ne se rouvre. Une réservation terminée ne repasse pas en
  cours, une annulation ne se reprend pas.

Le schéma ne dit rien de l'annulation après l'arrivée : c'est votre décision, et
la vérification ne l'impose pas. Si vous l'autorisez, faites-le explicitement.

### L'intervalle semi-ouvert

La nuit d'arrivée est comprise, le jour de départ est **exclu**.

```text
   arrivée : 1ᵉʳ mars                        départ : 4 mars
        │                                          │
        ▼                                          ▼
        ┌────────────┬────────────┬────────────┐
        │  nuit du   │  nuit du   │  nuit du   │
        │  1 au 2    │  2 au 3    │  3 au 4    │
        └────────────┴────────────┴────────────┘
        [──────────────  3 nuits  ──────────────)
        1ᵉʳ mars                            4 mars
        inclus                               exclu

   Le 4 mars au matin, le logement est libre : un autre séjour
   peut commencer ce jour-là, sans chevauchement.
```

Le nombre de nuits est donc la différence entre les deux dates, **sans ajouter
un**. C'est une convention arbitraire — mais tenue partout, elle supprime une
famille entière de bogues de décalage d'un jour, et elle rend le module 6
possible.

### Les montants en entiers

`0.1 + 0.2` ne vaut pas `0.3` en virgule flottante, dans tous les langages.
Vingt-cinq dollars s'écrit `2500`, pas `25.0`. Le jour où vous verserez de
l'argent à un hôte au module 8, un centime d'écart sera un vrai centime, sur un
vrai relevé.

En base, cela veut dire `integer` ou `bigint` — jamais `real` ni `double`, et
pas non plus `numeric`, qui est exact mais invite à écrire des décimales.

Nommez la colonne avec son unité : `montant_total_cents` vaut mieux que
`montant_total`. C'est une habitude peu coûteuse qui évite des erreurs de
facteur cent.

### Une migration versionnée

Un fichier `.sql` numéroté, ajouté et **jamais modifié une fois appliqué**. Pas
une génération automatique à partir de votre code : quand vous déploierez au
module 9, il faudra rejouer exactement ces fichiers, dans cet ordre, sur une
base que vous ne pouvez pas effacer.

Si vous vous trompez, vous n'éditez pas la migration fautive : vous en ajoutez
une nouvelle qui corrige.

## Un exemple minimal qui tourne

L'exemple porte sur le **prêt de matériel**, pas sur des réservations. La
technique est la même; la transposition est votre travail.

```ts
// src/exemple/pret.ts — copiez, exécutez, modifiez.
export type EtatPret = 'DISPONIBLE' | 'EMPRUNTE' | 'RENDU' | 'PERDU'

// Les règles, écrites UNE fois, et lisibles d'un coup d'œil.
const TRANSITIONS: Record<EtatPret, readonly EtatPret[]> = {
  DISPONIBLE: ['EMPRUNTE'],
  EMPRUNTE: ['RENDU', 'PERDU'],
  RENDU: [],
  PERDU: [],
}

export class TransitionInterdite extends Error {
  constructor(depuis: EtatPret, vers: EtatPret) {
    super(`Transition interdite : ${depuis} → ${vers}`)
  }
}

export class Pret {
  private constructor(
    readonly id: string,
    private etat: EtatPret,
  ) {}

  static creer(id: string): Pret {
    return new Pret(id, 'DISPONIBLE')
  }

  get statut(): EtatPret {
    return this.etat
  }

  // Le point de passage unique. Aucun autre endroit ne touche `etat`.
  transitionVers(suivant: EtatPret): void {
    if (!TRANSITIONS[this.etat].includes(suivant)) {
      throw new TransitionInterdite(this.etat, suivant)
    }
    this.etat = suivant
  }
}
```

Le test qui compte n'est pas celui du chemin nominal, c'est celui du refus :

```ts
// src/exemple/pret.test.ts — lancer avec : npx vitest run src/exemple
import { describe, expect, it } from 'vitest'
import { Pret } from './pret'

describe('prêt de matériel', () => {
  it('refuse de rendre un matériel jamais emprunté', () => {
    expect(() => Pret.creer('p1').transitionVers('RENDU')).toThrow()
  })

  it('refuse de réemprunter un matériel perdu', () => {
    const pret = Pret.creer('p1')
    pret.transitionVers('EMPRUNTE')
    pret.transitionVers('PERDU')
    expect(() => pret.transitionVers('EMPRUNTE')).toThrow()
  })
})
```

Et la migration correspondante, avec les quatre choses que la vérification lira
dans la vôtre — clé primaire, clé étrangère, colonnes obligatoires, montant
entier :

```sql
-- migrations/001_prets.sql
CREATE TABLE materiels (
  id  uuid PRIMARY KEY,
  nom text NOT NULL
);

CREATE TABLE prets (
  id            uuid PRIMARY KEY,
  materiel_id   uuid NOT NULL REFERENCES materiels (id),
  etat          text NOT NULL,
  caution_cents integer NOT NULL,        -- entier, jamais numeric ni real
  CONSTRAINT caution_positive CHECK (caution_cents >= 0)
);
```

Appliquez-la pour vérifier que votre chaîne fonctionne de bout en bout :

```bash
npm run migrate
psql "$DATABASE_URL" -c '\d prets'
```

## Les étapes

1. **Préparer la machine** : Node, PostgreSQL, la base `stays_test`, le fichier
   `.env`. Puis `npm install` dans le dépôt, et `npm install pg`.
2. **Créer l'adaptateur vide** : `src/academie/module-2.ts`. Lancez
   `npm run academie 2` tout de suite, pour voir le premier échec et comprendre
   la boucle avant d'avoir du code à déboguer.
3. **Mettre en place les migrations** : le lanceur `scripts/migrate.mjs`, le
   script `npm run migrate`, et l'exemple ci-dessus pour valider la chaîne.
4. **Écrire la migration initiale** : les quatre tables, clés primaires, clés
   étrangères, `NOT NULL`, et le montant en entier.
5. **Écrire la machine à états** : les états, la table des transitions, le point
   de passage unique.
6. **Écrire la fabrique** `Booking.request(...)` : elle refuse un intervalle
   vide ou inversé, et expose le nombre de nuits.
7. **Écrire vos propres tests** sur les règles qui vous semblent fragiles — pas
   ceux du harnais, les vôtres.
8. **Compléter l'adaptateur** : les deux exports et l'objet `schema` renseigné
   avec vos vrais noms de tables et de colonnes.
9. **`npm run academie 2`**, puis pousser. La vérification `academie/module-2`
   doit passer au vert dans l'onglet Actions de votre dépôt.

## Les erreurs fréquentes

**`Failed to load url ../../../src/academie/module-2`**
L'adaptateur n'existe pas, ou n'est pas exactement à ce chemin. Vérifiez
l'orthographe et l'extension `.ts`.

**`does not provide an export named 'Booking'`**
Vous exportez sous un autre nom. Utilisez un alias plutôt que de renommer votre
classe : `export { Reservation as Booking } from '...'`.

**`dossier de migrations introuvable : migrations`**
Votre `schema.migrationsDir` ne correspond pas au dossier réel. Le chemin est
relatif à la racine du dépôt.

**`table « annonces » (listing) absente des migrations`**
Vous avez déclaré dans `schema.tables` un nom que la migration n'utilise pas —
souvent un singulier contre un pluriel. Les deux doivent être identiques.

**`la colonne « … » doit être un entier, pas numeric`**
Le montant est déclaré en `numeric` ou `real`. Passez en `integer` ou `bigint`.

**`error: password authentication failed for user "postgres"`**
Votre `DATABASE_URL` ne correspond pas à votre installation locale. Vérifiez
l'utilisateur et le mot de passe, et que la base `stays_test` existe.

**Le test du nombre de nuits échoue d'une unité.**
Vous ajoutez un au calcul. Du 1ᵉʳ au 4 mars, il y a trois nuits : le voyageur
dort les nuits du 1, du 2 et du 3, et repart le 4.

**Tout passe en local, rien ne passe sur GitHub.**
Presque toujours une base différente : l'intégration continue utilise
`stays_test` sur `localhost:5432`. Alignez votre `DATABASE_URL`.

## Comment vous saurez que c'est fini

Deux suites composent `academie/module-2`.

`booking-lifecycle.test.ts` exécute votre code : naissance à l'état demandé,
chemin nominal complet, refus de terminer sans confirmer, refus de rouvrir un
séjour terminé, refus de reprendre une annulation, distinction entre refuser et
annuler, nombre de nuits, et montant entier.

`schema.test.ts` ne l'exécute pas : elle lit vos migrations et vérifie que les
tables déclarées existent, qu'il y a des clés primaires, des clés étrangères,
des colonnes obligatoires, et que vos colonnes de montant sont entières.

Un critère sera relu par un mentor si votre remise est escaladée : **le cycle de
vie est écrit une seule fois et fait autorité**. Une machine à états correcte
doublée de trois écritures directes de `statut` ailleurs dans le code passe les
tests et ne passe pas la relecture.

## Ressources

### Les paquets à installer

| Paquet | Rôle | Commande |
|---|---|---|
| `pg` | Client PostgreSQL | `npm install pg` |
| `@types/pg` | Types TypeScript | `npm install -D @types/pg` |
| `node-pg-migrate` | Migrations, si vous ne prenez pas le lanceur maison | `npm install -D node-pg-migrate` |

Vitest et TypeScript sont déjà dans le kit : n'y touchez pas.

### La documentation dont vous aurez besoin

- [PostgreSQL — `CREATE TABLE` (traduction française)](https://docs.postgresql.fr/current/sql-createtable.html)
- [PostgreSQL — Contraintes (traduction française)](https://docs.postgresql.fr/current/ddl-constraints.html)
- [PostgreSQL — Types date et heure (traduction française)](https://docs.postgresql.fr/current/datatype-datetime.html)
- [node-postgres — Se connecter et requêter](https://node-postgres.com/) (en anglais)
- [Vitest — Écrire des tests](https://vitest.dev/guide/) (en anglais)

### Pour approfondir

- [Martin Fowler — State Machine](https://martinfowler.com/bliki/StateMachine.html) (en anglais)
- [PostgreSQL — Types numériques, et pourquoi éviter le flottant pour l'argent](https://docs.postgresql.fr/current/datatype-numeric.html)
