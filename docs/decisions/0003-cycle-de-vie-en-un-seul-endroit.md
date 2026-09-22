# 0003 — Un seul endroit décide des passages

- Date : 2026-09-22
- Statut : Accepté, par l'Académie

## Le problème

Une réservation traverse six situations : demandée, confirmée, arrivée faite,
terminée, annulée, refusée. Si plusieurs fichiers se permettent de changer sa
situation, chacun finit par appliquer sa propre interprétation des règles.

On voit alors apparaître des séjours terminés que personne n'a acceptés, sans
pouvoir dire lequel des fichiers en est la cause.

## La décision

**Les passages autorisés sont décrits dans un seul objet, et une seule méthode
les applique.** Elle lève une erreur quand le passage demandé n'est pas permis.
Aucun autre code ne modifie la situation d'une réservation.

## Ce que ça coûte

Un détour : un service qui veut confirmer une réservation ne peut pas écrire le
nouvel état directement, il doit passer par cette méthode.

## Ce qui a été écarté

**Un `if` à chaque endroit qui change l'état.** C'est plus rapide à écrire les
trois premières fois. Au dixième, plus personne ne sait quelles règles
s'appliquent réellement, et les corriger demande de toutes les retrouver.
