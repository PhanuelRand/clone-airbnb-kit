# Module 7 — Réservation sans double réservation

## Ce que vous allez construire

Un voyageur choisit des dates et confirme. Si le logement est libre sur toutes
ces nuits, la réservation est créée. S'il ne l'est pas — même partiellement —
elle est refusée avec un motif lisible.

Et quand cinq voyageurs confirment les mêmes nuits à la même seconde, un seul
obtient le logement. Les quatre autres reçoivent un refus, pas une erreur
serveur, et surtout pas une confirmation.

## Pourquoi c'est plus difficile qu'il n'y paraît

Voici ce que presque tout le monde écrit d'abord. Lisez-le : il est faux, mais
pas d'une façon qui se voit.

```ts
// NE FAITES PAS ÇA.
const conflit = await db.query(
  `SELECT 1 FROM reservations
     WHERE logement_id = $1
       AND statut <> 'CANCELLED'
       AND NOT (fin <= $2 OR debut >= $3)`,
  [logementId, arrivee, depart],
)

if (conflit.rowCount > 0) {
  return { accepted: false, reason: 'Ces dates ne sont plus disponibles.' }
}

await db.query(
  `INSERT INTO reservations (id, logement_id, debut, fin, statut)
     VALUES ($1, $2, $3, $4, 'REQUESTED')`,
  [randomUUID(), logementId, arrivee, depart],
)

return { accepted: true }
```

La requête de chevauchement est juste. La logique est juste. Et pourtant ce code
vend deux fois la même nuit.

### Pourquoi il passe en local

Sur votre machine, vous êtes seul. Vos tests s'exécutent l'un après l'autre.
Entre le `SELECT` et l'`INSERT`, il ne se passe rien, parce qu'il n'y a personne
d'autre. Vous pouvez lancer cette suite cent fois de suite : elle sera verte
cent fois.

### Pourquoi il casse en production

Entre le `SELECT` et l'`INSERT`, il y a un intervalle de temps. Quelques
millisecondes, mais un intervalle. Deux requêtes qui arrivent en même temps s'y
glissent toutes les deux :

```text
Requête A                          Requête B
─────────────────────────────      ─────────────────────────────
SELECT … → aucun conflit
                                   SELECT … → aucun conflit
INSERT  → réservation créée
                                   INSERT  → réservation créée

                  Deux réservations. Mêmes nuits.
```

Aucune des deux n'a tort de son point de vue : au moment où chacune a regardé,
la place était libre. Le problème n'est pas dans votre requête, il est dans le
fait d'avoir **regardé puis agi** au lieu d'agir une seule fois.

C'est une classe de bogues entière, qu'on appelle *lecture puis écriture*
(« read-then-write »). Elle ne se reproduit pas à la demande, ne se voit pas en
développement, et se manifeste le premier jour où deux personnes cherchent les
mêmes dates. Vous découvrirez le problème par un courriel d'hôte, pas par un
test rouge.

### Les réponses qui ne conviennent pas

**Verrouiller la table** (`LOCK TABLE reservations`) fonctionne, et met toutes
les réservations de la plateforme en file d'attente, y compris celles de
logements sans aucun rapport. Vous échangez un bogue rare contre une lenteur
permanente.

**Passer la transaction en `SERIALIZABLE`** est correct, mais déplace le travail
sans le supprimer : PostgreSQL vous rendra des échecs de sérialisation que vous
devrez détecter et rejouer vous-même, partout.

**Un verrou dans votre code JavaScript** — une promesse, une file, un mutex —
fait passer les tests et constitue le piège le plus dangereux du module. Voyez
la section des erreurs fréquentes.

La bonne réponse ne demande ni verrou ni relecture : on décrit l'invariant à la
base de données, et on la laisse refuser.

## Les notions

### `daterange`, un intervalle comme valeur

PostgreSQL sait manipuler un intervalle comme une seule valeur, au lieu de deux
colonnes `debut` et `fin` que rien ne relie.

```sql
SELECT daterange('2026-09-10', '2026-09-14', '[)');
```

Le troisième argument donne les bornes. `'[)'` signifie **borne basse incluse,
borne haute exclue** — exactement la convention du parcours : la nuit d'arrivée
est comprise, le jour de départ ne l'est pas.

C'est grâce à ça qu'un séjour du 10 au 14 et un séjour du 14 au 18 ne se
chevauchent pas. Si vous écrivez `'[]'`, ils se chevaucheront, et vous refuserez
des réservations parfaitement valides.

### L'opérateur `&&`

`&&` répond à « ces deux intervalles se chevauchent-ils ? ».

```sql
SELECT daterange('2026-09-10','2026-09-14','[)')
    && daterange('2026-09-13','2026-09-18','[)') AS chevauche;  -- true

SELECT daterange('2026-09-10','2026-09-14','[)')
    && daterange('2026-09-14','2026-09-18','[)') AS chevauche;  -- false
```

Une ligne remplace les quatre comparaisons de dates que vous auriez écrites, et
elle traite correctement les six formes de chevauchement — identique, contenu,
englobant, débordant d'un côté ou de l'autre, d'une seule nuit.

### La contrainte d'exclusion

Une clé unique dit : « ces deux lignes ne peuvent pas avoir la **même** valeur ».
Une contrainte d'exclusion généralise : « ces deux lignes ne peuvent pas avoir
des valeurs qui se **chevauchent** ».

```sql
EXCLUDE USING gist (salle_id WITH =, creneau WITH &&)
```

À lire ainsi : il est interdit que deux lignes aient à la fois le même
`salle_id` **et** des `creneau` qui se chevauchent. PostgreSQL le garantit au
niveau du stockage. Deux transactions simultanées ne peuvent pas la contourner :
la seconde est refusée, quoi qu'elle fasse.

### `btree_gist`

L'index GiST sait comparer des intervalles avec `&&`, mais il ne sait pas
comparer un `uuid` avec `=`. Pour mélanger les deux dans une même contrainte, il
faut l'extension :

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Sans elle, vous obtiendrez l'erreur `data type uuid has no default operator
class for access method "gist"`. Elle est livrée avec PostgreSQL; il suffit de
l'activer, dans une migration, et aussi sur votre base de production au
module 12.

## Un exemple minimal qui tourne

Cet exemple réserve des **salles de réunion**, pas des logements. La technique
est la même; la transposition vers votre domaine est votre travail.

Copiez-le dans un fichier `salles.sql` et exécutez-le sur une base de test :

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE reservations_salle (
  id       uuid PRIMARY KEY,
  salle_id uuid NOT NULL,
  creneau  daterange NOT NULL,
  statut   text NOT NULL DEFAULT 'ACTIVE',

  CONSTRAINT creneau_non_vide CHECK (NOT isempty(creneau)),

  -- Le cœur : deux créneaux actifs de la même salle ne peuvent pas se toucher.
  CONSTRAINT pas_de_double_reservation
    EXCLUDE USING gist (salle_id WITH =, creneau WITH &&)
    WHERE (statut <> 'ANNULEE')
);

-- Première réservation : acceptée.
INSERT INTO reservations_salle (id, salle_id, creneau) VALUES
  ('11111111-1111-4111-8111-111111111111',
   '99999999-9999-4999-8999-999999999999',
   daterange('2026-09-10', '2026-09-14', '[)'));

-- Chevauchement d'une seule journée : REFUSÉE par la base.
INSERT INTO reservations_salle (id, salle_id, creneau) VALUES
  ('22222222-2222-4222-8222-222222222222',
   '99999999-9999-4999-8999-999999999999',
   daterange('2026-09-13', '2026-09-18', '[)'));
-- ERROR:  conflicting key value violates exclusion constraint

-- Créneau adjacent : ACCEPTÉE, grâce à la borne haute exclue.
INSERT INTO reservations_salle (id, salle_id, creneau) VALUES
  ('33333333-3333-4333-8333-333333333333',
   '99999999-9999-4999-8999-999999999999',
   daterange('2026-09-14', '2026-09-18', '[)'));
```

Remarquez la clause `WHERE (statut <> 'ANNULEE')` : la contrainte ne s'applique
qu'aux lignes actives. Une réservation annulée cesse donc de bloquer les dates
**sans qu'aucun code ne s'en occupe**. C'est la base qui tient l'invariant, pas
vous.

### Traduire le refus en réponse métier

Votre code n'a plus à vérifier quoi que ce soit avant d'insérer. Il insère, et
il traduit le refus éventuel :

```ts
import { DatabaseError } from 'pg'

// 23P01 = exclusion_violation. C'est PostgreSQL qui vous dit « c'est pris ».
const EXCLUSION_VIOLATION = '23P01'

try {
  await db.query(
    `INSERT INTO reservations_salle (id, salle_id, creneau)
       VALUES ($1, $2, daterange($3::date, $4::date, '[)'))`,
    [randomUUID(), salleId, debut, fin],
  )
  return { accepted: true }
} catch (error) {
  if (error instanceof DatabaseError && error.code === EXCLUSION_VIOLATION) {
    return { accepted: false, reason: 'Ce créneau n’est plus disponible.' }
  }
  throw error // toute autre erreur reste une erreur : ne l'avalez pas.
}
```

Ce bloc contient tout le module. Il n'y a plus de lecture avant l'écriture, donc
plus d'intervalle dans lequel quelqu'un puisse se glisser.

## Les étapes

1. **Activer l'extension.** Une migration versionnée avec
   `CREATE EXTENSION IF NOT EXISTS btree_gist;`. Notez-la : il faudra la rejouer
   sur la base de production au module 12.
2. **Passer à un intervalle.** Remplacez vos deux colonnes de dates par une
   colonne `daterange`, ou ajoutez-la. Ajoutez la contrainte
   `CHECK (NOT isempty(...))` : elle reprend, côté base, l'invariant que votre
   modèle du module 2 tient déjà côté code.
3. **Ajouter la contrainte d'exclusion**, avec sa clause `WHERE` sur le statut,
   pour que les réservations annulées cessent de bloquer.
4. **Réécrire la création de réservation** : plus de `SELECT` préalable. On
   insère, on attrape `23P01`, on rend un refus motivé.
5. **Implémenter l'annulation** : passez le statut à `CANCELLED` et vérifiez
   qu'une nouvelle réservation sur les mêmes nuits est aussitôt acceptée.
6. **Implémenter la lecture** des réservations d'un logement, en distinguant les
   actives des annulées.
7. **Écrire l'adaptateur** `src/academie/module-7.ts`, qui réexporte
   `createListing`, `requestBooking`, `cancelBooking` et `listBookings` sous les
   noms attendus. Les signatures exactes sont en tête de
   `academie/checks/module-7/booking.test.ts`.
8. **Lancer les vérifications** : `npm run academie 7`. Les suites des modules 1
   à 5 tournent aussi — une régression ailleurs bloque celle-ci.

## Les erreurs fréquentes

**`data type uuid has no default operator class for access method "gist"`**
L'extension `btree_gist` n'est pas activée sur cette base. Vérifiez que la
migration a bien été appliquée, et pas seulement écrite.

**Les séjours adjacents sont refusés.**
Vos bornes sont `'[]'` au lieu de `'[)'`. Le jour de départ est alors compté
comme occupé, et un voyageur qui arrive le jour où le précédent repart se fait
refuser. La suite vérifie ce cas précisément.

**Une réservation annulée continue de bloquer les dates.**
Votre contrainte d'exclusion n'a pas de clause `WHERE`, elle s'applique donc à
toutes les lignes, annulées comprises.

**Le test des cinq demandes simultanées passe, mais vous avez ajouté une file
d'attente en JavaScript.**
C'est le piège du module. Un verrou dans votre processus Node fonctionne tant
qu'il n'y a **qu'un seul processus**. Au module 12, votre hébergeur lancera
peut-être deux instances, chacune avec son propre verrou, chacune persuadée
d'être seule — et le bogue revient, en production, sans qu'aucun test ne
l'annonce. L'invariant doit vivre dans la base, qui est la seule chose que les
deux instances partagent.

**Toutes les erreurs sont converties en `{ accepted: false }`.**
Vous masquez vos vraies pannes : une colonne manquante, une clé étrangère
violée, une base injoignable deviennent « ces dates ne sont plus disponibles ».
N'attrapez que `23P01`, et laissez tout le reste remonter.

## Comment vous saurez que c'est fini

La suite `academie/checks/module-7/booking.test.ts` couvre quatre familles :

- un intervalle libre est accepté, deux logements ne s'opposent jamais, et un
  séjour adjacent est accepté;
- les six formes de chevauchement sont refusées, avec un motif;
- cinq demandes simultanées identiques produisent exactement une réservation, et
  trois demandes qui se chevauchent partiellement aussi;
- une annulation libère les nuits immédiatement.

Un critère de la consigne n'est pas vérifiable automatiquement et sera relu par
un mentor si votre remise est escaladée : **l'unicité doit reposer sur une
garantie de la base**, pas sur une vérification applicative. Un mentor lira
votre migration. Si la contrainte d'exclusion n'y est pas, les tests verts ne
suffiront pas.

## Pour aller plus loin

- [PostgreSQL — Types intervalle (documentation française)](https://docs.postgresql.fr/current/rangetypes.html)
- [PostgreSQL — Contraintes d'exclusion (documentation française)](https://docs.postgresql.fr/current/ddl-constraints.html)
- [PostgreSQL — Codes d'erreur](https://www.postgresql.org/docs/current/errcodes-appendix.html) (en anglais)
