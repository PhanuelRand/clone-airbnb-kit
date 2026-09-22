# 0002 — Les montants sont des entiers

- Date : 2026-09-22
- Statut : Accepté, par l'Académie

## Le problème

Dans la plupart des langages, `0.1 + 0.2` ne vaut pas `0.3` mais
`0.30000000000000004`. Un montant stocké en nombre à virgule accumule ces
écarts. Ils passent inaperçus à l'écran, et deviennent visibles sur un relevé
bancaire.

## La décision

**Un montant est un entier, exprimé dans la plus petite unité de la monnaie.**
On stocke `2550` pour 25,50. La virgule n'apparaît qu'au moment de l'affichage.

La colonne porte son unité dans son nom, par exemple `montant_total_cents`, et
son type est `integer` ou `bigint`.

## Ce que ça coûte

Toute lecture et toute écriture demandent une conversion. Il faut une seule
fonction pour cela, et s'y tenir, sinon la division apparaît à vingt endroits.

## Ce qui a été écarté

**Le type `numeric` de PostgreSQL**, qui calcule pourtant juste. Il stocke bien
la valeur, mais les bibliothèques la rendent en texte ou en nombre à virgule
selon les cas, et l'erreur revient par le code au lieu d'entrer par la base.
L'entier ne laisse aucune place à l'ambiguïté.
