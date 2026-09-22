# 0005 — Le front et l'API sont deux applications

- Date : 2026-09-22
- Statut : Accepté, par l'Académie

## Le problème

L'application a besoin d'un serveur qui conserve les données et d'une interface
qui les montre. Les deux peuvent tenir dans un seul programme, ou dans deux.

## La décision

**Deux applications.** `src/` porte l'API, écrite avec Hono. `web/` porte le
front, en Vite et React. Chacune a ses dépendances et se lance séparément.

## Ce que ça coûte

Deux installations, deux commandes pour développer, et deux déploiements au
module 12. Il faut aussi autoriser explicitement votre front à interroger votre
API, puisqu'ils ne sont pas à la même adresse.

En échange, les vérifications des onze premiers modules n'installent jamais le
front : elles restent rapides, et vous ne téléchargez React que lorsque vous en
avez besoin.

## Ce qui a été écarté

**Un cadre qui réunit les deux**, du type de Next.js. Un seul déploiement, une
seule installation, et pas de question d'origines. Mais il impose sa façon de
ranger le code jusque dans le serveur, et il rend moins visible la frontière
entre ce qui tourne chez l'utilisateur et ce qui tourne chez vous. Cette
frontière est précisément ce que le parcours enseigne.
