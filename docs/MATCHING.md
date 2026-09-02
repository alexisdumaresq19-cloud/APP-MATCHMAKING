# Le jumelage, expliqué

## En langage clair (pour l'organisatrice)

Pour chaque paire de participants, l'application calcule un **score de 0 à 100** qui estime le
potentiel d'affaires de leur rencontre. Quatre ingrédients entrent dans ce score, et vous décidez du
poids de chacun dans **Paramètres → Règles de matching** :

| Ingrédient | Ce qu'il mesure | Poids par défaut |
|---|---|---|
| **Complémentarité** | Ce que l'un **offre** correspond-il à ce que l'autre **cherche**? (dans les deux sens) | 40 |
| **Affinité des secteurs** | Vos secteurs d'activité se complètent-ils? (grille **Paramètres → Affinités**, de 0 à 100) | 30 |
| **Région** | Même région (100), régions voisines (60), régions éloignées (20) | 15 |
| **Nouveauté** | Ne se sont jamais rencontrés à l'une de vos rencontres passées (100), sinon 0 | 15 |

Deux règles s'ajoutent :

- **Même secteur** : deux concurrents perdent des points (pénalité réglable). À 100, ils ne sont
  jamais jumelés.
- **Même entreprise** : jamais jumelés (désactivable).

Ensuite, chaque participant reçoit ses **meilleurs jumelages** (le nombre visé se règle dans les
détails de l'événement, 5 par défaut), à condition que le score dépasse le **seuil minimal**. Un
jumelage retenu pour l'un l'est aussi pour l'autre : quelqu'un de très demandé peut donc dépasser le
nombre visé. Si une personne aurait moins de 2 jumelages, le seuil est abaissé pour elle seule, par
paliers, et elle est signalée dans le résumé.

Vos décisions manuelles priment : un jumelage **épinglé** est toujours conservé, un jumelage
**exclu** n'est jamais proposé, même après un recalcul.

Les participants ne voient jamais le score. Ils voient deux ou trois phrases, par exemple :
« Ils offrent « entretien ménager », que vous recherchez. », « Vos secteurs se complètent souvent. »,
« Vous êtes dans la même région. »

## Détails techniques

Code : `src/lib/matching/` (TypeScript pur, sans dépendance à la base de données, testé dans
`tests/unit/matching-*.test.ts`). Branchement à la base : `src/server/services/matching.ts`.

### Score d'une paire (`score.ts`)

```
complementarity = 100 × (besoins de B satisfaits par A + besoins de A satisfaits par B)
                  / max(1, min(4, |besoins A| + |besoins B|)), plafonné à 100
sectorAffinity  = affinité(secteur A, secteur B)   (50 si un secteur manque)
region          = 100 même région · 60 régions voisines (annexe B) · 20 sinon · 50 si inconnue
novelty         = 0 si déjà rencontrés (même table à un événement COMPLETED) · 100 sinon
raw = (wC·complementarity + wS·sectorAffinity + wR·region + wN·novelty) / (wC+wS+wR+wN)
même secteur : penaltySameSector ≥ 100 → paire exclue ; sinon raw −= penaltySameSector × 0,5 (plancher 0)
même entreprise (clé normalisée, suffixes inc./ltée retirés) et excludeSameCompany → paire exclue
score = arrondi(raw borné à [0, 100])
```

Une correspondance offre/besoin est reconnue quand les étiquettes normalisées (minuscules, sans
accents ni ponctuation) sont identiques **ou** dont la similarité de Dice sur bigrammes est ≥ 0,85
(« entretien ménager » ≈ « entretien menagers »). Chaque besoin compte une seule fois.

Le détail est conservé dans `Match.reasons` (JSON) : scores par ingrédient, étiquettes appariées,
région commune ou voisine, rencontre passée, pénalités. `reasons.ts` en tire les phrases affichées.

### Sélection (`select.ts`)

1. Toutes les paires sont notées (O(n²), ~45 000 paires pour 300 inscrits, < 0,5 s).
2. Les paires EXCLUDED sont retirées; les paires PINNED sont forcées (score recalculé).
3. Chaque participant garde ses `matchesPerParticipant` meilleures paires au-dessus de
   `minScoreToPropose`; une paire retenue l'est pour les deux (le quota est un minimum visé).
4. Sous 2 jumelages, le seuil est abaissé de 10 en 10 pour ce participant, jusqu'à 0.
5. Persistance : les PROPOSED de l'événement sont remplacés; PINNED et EXCLUDED conservés.

### Placement aux tables (`seating.ts`)

Objectif : maximiser la somme des scores des jumelages présents à une même table (PINNED compte
double), sous contraintes : capacité, assignations verrouillées, pas deux personnes du même secteur
si `penaltySameSector ≥ 100` (relâché et signalé si impossible), et −50 par paire déjà assise
ensemble à une ronde précédente.

1. Construction gloutonne : chaque table reçoit d'abord le « pivot » le plus fort restant, puis les
   tables sont remplies à tour de rôle avec le participant qui maximise la somme des scores avec les
   personnes déjà assises (répartition égale, puis remplissage des places restantes).
2. Recherche locale itérée : passes d'amélioration (déplacement vers une place libre ou échange
   entre deux tables si le total augmente), puis perturbations aléatoires (PRNG à graine fixe) avec
   ré-optimisation, en conservant la meilleure configuration; arrêt après `maxIterations`
   mouvements (2000) ou quand le budget de temps (500 ms, réparti entre les rondes) est épuisé.
3. Rondes suivantes : même procédé avec la pénalité de répétition.
4. Rapport : score total, tables sous-remplies, conflits de secteur, paires répétées, non placés.

Déterminisme : même graine et même nombre d'itérations ⇒ même résultat. Limite théorique : avec des
tables de 6 après une ronde de blocs de 6, chaque table ultérieure repose forcément sur au moins 2
paires déjà réunies; l'algorithme atteint ce minimum.

### Performance mesurée

300 inscrits, 15 tables de 20, 3 rondes : notation + sélection + placement en moins de 2 s
(test `tests/unit/matching-seating.test.ts`).
