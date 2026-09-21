# Votre code

C'est ici que vous construisez votre clone d'Airbnb. Le dossier est
volontairement vide : c'est votre travail.

## Comment le harnais atteint votre code

Les suites de vérification n'importent **jamais** vos fichiers directement.
Elles importent un seul fichier par module, que vous écrivez :

```text
src/academie/module-1.ts
src/academie/module-2.ts
...
```

Ce fichier est un **adaptateur** : il réexporte, sous les noms attendus par le
harnais, ce que vous avez construit sous les noms que vous avez choisis.

```ts
// src/academie/module-1.ts — vous écrivez ce fichier.
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

Vous nommez vos tables, vos classes et vos dossiers comme vous voulez. Vous
organisez votre architecture comme vous voulez. Le harnais ne connaît que
l'adaptateur, et l'adaptateur dit où regarder.

L'en-tête de chaque fichier de `academie/checks/` écrit noir sur blanc ce que
l'adaptateur de ce module doit exporter. La consigne du module sur le portail
dit la même chose : les deux sont d'accord, il n'y a pas de contrat caché.

## Où est expliqué ce qu'il faut faire

Trois endroits, et ils ne disent pas la même chose :

| Où | Ce que vous y trouvez |
|---|---|
| La consigne, sur le portail | Ce qu'il faut produire, et les critères qui le mesurent |
| `academie/cours/module-N.md` | **Comment y arriver** : les notions, un exemple qui tourne, les étapes, les erreurs fréquentes |
| L'en-tête de `academie/checks/module-N/` | Les signatures exactes que votre adaptateur doit exporter |

Quand vous êtes bloqué, c'est le cours qu'il faut ouvrir. Il est dans ce dépôt,
donc lisible hors ligne, sans connexion.

## Votre boucle de travail

Au premier push, les huit vérifications sont rouges. C'est normal : vous les
faites passer au vert une par une, module après module.

Pour voir où vous en êtes sans attendre l'intégration continue :

```bash
npm install
npm run academie 1
```

La commande lance les suites des modules 1 à N. Elles sont cumulatives : au
module 5, les quatre précédentes tournent encore. Lancez-la avant chaque push.

## Ce que le harnais ne vérifie pas

Certains critères de la consigne ne sont pas exécutables — une mesure de
performance, une justification de conception. Ils sont marqués **« Relu par un
mentor »** dans la consigne, et vous les déposez dans `academie/rapports/`.
Ils n'ouvrent pas le module suivant, mais un mentor les lit si votre remise est
escaladée.
