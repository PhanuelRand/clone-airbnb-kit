# 0001 — Un séjour se compte en nuits

- Date : 2026-09-22
- Statut : Accepté, par l'Académie

## Le problème

Un séjour du 1er au 4 mars dure-t-il trois jours ou quatre ? Les deux réponses
se défendent, et tant que la question n'est pas tranchée, chaque partie du code
compte à sa façon. Le prix, la disponibilité et la recherche finissent par se
contredire.

## La décision

**La date d'arrivée est comprise dans le séjour, la date de départ ne l'est
pas.** Le nombre de nuits est la différence entre les deux, sans rien ajouter.
Du 1er au 4 mars fait trois nuits.

Deux séjours sont donc refusés dès la construction : celui dont le départ
précède l'arrivée, et celui de zéro nuit.

## Ce que ça coûte

La convention est contre-intuitive à la lecture : « du 1 au 4 » se dit
naturellement quatre jours. Il faut la rappeler dans l'interface, où l'on
affiche des nuits et non des jours.

## Ce qui a été écarté

**Compter les jours, arrivée et départ compris.** Cette façon rend impossible
qu'un voyageur arrive le jour même où un autre repart : les deux séjours
partageraient cette date et l'application croirait à un conflit. Le module 7,
qui interdit la double réservation, devient alors faux ou injuste.
