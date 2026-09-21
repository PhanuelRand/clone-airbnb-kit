# Kit de départ — Clone Airbnb

Ce dossier contient le **harnais de vérification** du parcours « Clone Airbnb »
(ADR-0016). Il est publié dans le dépôt modèle GitHub dont chaque participant
part, et la plateforme compare son empreinte à chaque remise.

## Ce qui est versionné ici

| Chemin | Rôle |
|---|---|
| `.github/workflows/academie.yml` | Exécute les suites de conformité à chaque push, dans l'intégration continue du participant |
| `academie/checks/**` | Les suites écrites par la plateforme, cumulatives d'un module au suivant |
| `academie/run.mjs` | Lanceur local : `node academie/run.mjs 3` reproduit exactement ce que fait l'intégration continue |

Ces fichiers sont les seuls dont l'empreinte est vérifiée. Le reste du dépôt
modèle — `src/`, `tsconfig.json`, `academie/cours/`, `academie/rapports/` —
n'est pas comparé.

`academie/cours/` contient le cours de chaque module : c'est là que le parcours
enseigne, quand la consigne du portail se contente de spécifier. Son plan et ses
règles d'écriture sont dans [academie/cours/README.md](./academie/cours/README.md).

## Le contrat passe par un adaptateur

Contrairement au kit « Clone Uber », les suites de ce parcours n'importent
jamais les fichiers du participant directement. Elles importent un adaptateur
par module, `src/academie/module-N.ts`, que le participant écrit et qui
réexporte son code sous les noms attendus.

Le participant garde donc la liberté de son architecture — noms de classes, de
fichiers, de tables — tout en présentant au harnais une surface stable. C'est
ce qui permet à la consigne de promettre « vous choisissez votre chemin » sans
que les vérifications la contredisent.

Chaque contrat est écrit à deux endroits qui doivent rester d'accord :
l'en-tête du fichier de check, et la section « Contrat de vérification » de la
consigne publiée sur le portail.

## Pourquoi l'empreinte est vérifiée

Le harnais vit dans le dépôt du participant, donc il peut le modifier. La
plateforme relit ces fichiers au commit remis et compare leur empreinte à la
version canonique publiée ici.

Une différence ne prononce pas l'échec : elle confie la remise à un mentor, qui
voit la modification dans l'historique Git et tranche. C'est le bon niveau pour
un produit éducatif; ce n'est pas un système anti-fraude.

## Faire évoluer le harnais

1. modifier les fichiers ici;
2. relever `kit.version` dans la bibliothèque de parcours
   (`packages/core/src/modules/catalog/infrastructure/course-library.ts`);
3. exécuter `pnpm catalog:sync`, qui recalcule les empreintes depuis ce dossier;
4. publier le dépôt modèle GitHub à jour.

Les participants déjà inscrits gardent la version du kit figée à leur
inscription : réviser le harnais ne change pas ce qui leur a été demandé.
