# Les cours du parcours

Un fichier par module : `module-1.md` à `module-8.md`.

C'est ici que le parcours **enseigne**. La consigne du portail dit ce qu'il faut
produire et à quoi ça sera mesuré; le cours explique comment y arriver.

## Pourquoi dans le dépôt, et pas sur le portail

- Le participant a déjà cloné le dépôt : le cours est **lisible hors ligne**,
  pendant une coupure de courant, sans consommer de données mobiles.
- Il se lit dans l'éditeur, à côté du code, et non dans un autre onglet.
- Il est versionné et relu en revue comme les suites de vérification.

Ce dossier n'est **pas** dans les chemins dont l'empreinte est vérifiée
(ADR-0016) : seuls `.github/workflows/academie.yml`, `academie/run.mjs` et
`academie/checks/**` le sont. Le participant peut donc annoter son cours sans
que sa remise parte en revue mentor.

## Le plan imposé

Chaque fichier suit ce plan, dans cet ordre. Il n'est pas décoratif : c'est la
progression qui amène quelqu'un de bloqué jusqu'au code qui passe.

```markdown
# Module N — Titre

## Ce que vous allez construire
## Pourquoi c'est plus difficile qu'il n'y paraît
## Les notions
## Un exemple minimal qui tourne
## Les étapes
## Les erreurs fréquentes
## Comment vous saurez que c'est fini
## Pour aller plus loin
```

### L'exception du module 1

Le module 1 porte deux sections supplémentaires, placées juste après « Ce que
vous allez construire » :

- **Avant de commencer.** Ce qu'il faut installer, et comment aligner son
  `DATABASE_URL` local sur celui de l'intégration continue.
- **Comment le harnais vous parle.** L'adaptateur, et surtout **la lecture d'un
  échec** : les sorties rouges que le participant verra, et ce qu'elles
  signifient.

Elles n'apparaissent qu'une fois, dans le premier module du parcours. Les autres
cours y renvoient au lieu de les répéter.

### Ce que chaque section doit contenir

**Ce que vous allez construire.** Un paragraphe concret, au présent. Pas de
promesse pédagogique, pas de « vous apprendrez à ». Ce que l'utilisateur final
verra.

**Pourquoi c'est plus difficile qu'il n'y paraît.** La section qui justifie le
prix du parcours. On y montre **l'approche naïve, en code**, puis on démonte
pourquoi elle échoue. Si elle échoue seulement en production, on dit pourquoi
elle passe en local : c'est exactement ce que le participant vivra.

**Les notions.** Ce qu'il faut savoir, expliqué ici et non délégué à un lien.
Un lien sert à approfondir, jamais à remplacer l'explication.

**Un exemple minimal qui tourne.** Du SQL et du TypeScript que le participant
peut copier dans un fichier et exécuter en trente secondes. Il porte sur un cas
**voisin** du sien, jamais sur la solution complète : on enseigne la technique,
on ne livre pas la remise.

**Les étapes.** Une liste ordonnée et cochable, de six à neuf entrées, de la
migration jusqu'à `npm run academie N`. C'est ce que lit un participant bloqué
un mardi soir, et ça doit suffire à le débloquer.

**Les erreurs fréquentes.** Sous la forme *symptôme observé → cause → ce qu'il
faut changer*. On y met les vrais messages d'erreur, ceux qu'on colle dans un
moteur de recherche.

**Comment vous saurez que c'est fini.** Le lien explicite avec les suites de
`academie/checks/module-N/`, et ce qui relève d'une relecture par un mentor.

**Pour aller plus loin.** Trois liens au maximum. **En français quand une
version française existe**, l'anglais seulement à défaut, et on le signale.

## Le registre d'écriture

Décidé le 2026-09-20 : tous les cours s'écrivent dans le registre
**pédagogique**, en **français neutre**.

Le registre pédagogique annonce ce qui vient, définit un terme avant de
l'employer, illustre, puis justifie. Il vouvoie le participant, emploie « on »
et « nous », et fait des phrases complètes sans vocabulaire littéraire.

Le français est neutre : ni québécismes, ni familiarités parisiennes. Le
lancement vise Madagascar, où l'enseignement suit la norme de France.

Un second registre, plus sec, convient aux passages qui ne se lisent pas mais
se consultent : les listes d'étapes, les tableaux de messages d'erreur, les
tableaux d'outils. Phrases courtes, aucune transition, aucune image. La
conversation n'a pas sa place dans une liste d'étapes.

### La liste d'interdits

Un texte généré se reconnaît à sa forme avant son contenu. Ces huit règles
existent pour cette raison, et elles s'appliquent aussi à ce fichier.

1. Jamais deux phrases « ce n'est pas X, c'est Y » dans le même cours.
2. Pas de tiret cadratin. Une virgule, un deux-points, ou deux phrases.
3. Aucun paragraphe qui se termine par une formule frappante. On termine sur
   une information.
4. Casser les rythmes de trois. Deux éléments, ou quatre.
5. Vocabulaire courant. Un mot qu'on n'entendrait pas dans une conversation de
   bureau se remplace.
6. Aucun objet technique ne « veut », ne « protège » ni ne « décide ».
7. Varier la longueur des phrases.
8. Lire à voix haute. Ce qui ne se dit pas se réécrit.

Le registre pédagogique a un défaut propre : il glisse vers le français
administratif, du type « il serait inutile d'y consacrer une soirée entière ».
Relire pour ça.

## Règles de contenu

- On ne donne jamais la solution du module. On donne la technique sur un cas
  voisin. Le critère est net : si le code du cours peut être collé dans `src/`
  et faire passer une suite, il est trop proche.
- Tout bloc de code est étiqueté par son langage et doit s'exécuter tel quel.
- Les liens de la section « Pour aller plus loin » sont en français quand une
  version française existe, et signalés comme anglais sinon.
- Un cours qui dépasse trois cents lignes est probablement deux cours. Le
  module 1 fait exception : il porte l'accueil du parcours.
