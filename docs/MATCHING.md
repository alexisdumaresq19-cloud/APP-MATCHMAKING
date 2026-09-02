# Le jumelage, expliqué

## En langage clair (pour l'organisatrice)

Pour chaque paire de participants, l'application calcule un **score de 0 à 100** qui estime le
potentiel d'affaires de leur rencontre. Quatre ingrédients entrent dans ce score, et vous décidez du
poids de chacun dans **Paramètres → Règles de matching** :

| Ingrédient | Ce qu'il mesure | Poids par défaut |
|---|---|---|
| **Complémentarité** | Ce que l'un **offre** correspond-il à ce que l'autre **cherche**? (dans les deux sens). Les secteurs cochés à « Avec qui aimeriez-vous collaborer? » comptent comme un besoin : il est satisfait quand l'autre appartient à l'un de ces secteurs | 40 |
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
« Ils offrent « entretien ménager », que vous recherchez. », « Vous souhaitiez rencontrer le secteur
« Entretien ménager et commercial ». », « Vos secteurs se complètent souvent. », « Vous êtes dans la
même région. »

### « Avec qui aimeriez-vous collaborer? » (secteurs recherchés)

À l'inscription, après avoir choisi son secteur, chaque entreprise voit la liste de vos secteurs
avec, **pré-cochés**, ceux qui collaborent le plus souvent avec le sien : les secteurs dont
l'affinité avec le sien est **≥ 65** dans votre matrice (5 au maximum, les plus forts d'abord).
Le message nomme les secteurs pré-cochés (« Nous avons pré-coché pour vous : Entretien ménager et
commercial, Animation et loisirs… Souhaitez-vous ajouter d'autres secteurs? »).
Elle peut en ajouter ou en retirer librement. Le champ libre « Ce que vous cherchez » devient
facultatif : il faut au moins un secteur coché **ou** un besoin écrit. Résultat : moins de friction
à l'inscription, et un jumelage qui « réfléchit seul » à partir de votre matrice.

Pour changer ce qui est pré-coché, ajustez la matrice dans **Paramètres → Affinités**.

La règle de la ligne directrice s'applique ensuite telle quelle : une paire est **validée** quand le
secteur de B est dans la liste de A **et/ou** le secteur de A est dans la liste de B. Les deux sens
donnent une complémentarité de 100, un seul sens 70; les étiquettes écrites ne peuvent jamais faire
descendre ce résultat, elles ne peuvent que l'égaler ou le dépasser.

## Détails techniques

Code : `src/lib/matching/` (TypeScript pur, sans dépendance à la base de données, testé dans
`tests/unit/matching-*.test.ts`). Branchement à la base : `src/server/services/matching.ts`.

### Score d'une paire (`score.ts`)

```
étiquettes      = 100 × (besoins de B satisfaits par A + besoins de A satisfaits par B)
                  / min(4, besoins(A) + besoins(B))   · 0 si aucun besoin écrit · plafonné à 100
secteurs        = 100 si secteur(B) ∈ recherchés(A) ET secteur(A) ∈ recherchés(B)
                  · 70 si un seul des deux (règle « ET/OU » de la ligne directrice) · 0 sinon
complementarity = max(étiquettes, secteurs)
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
secteur recherché de part et d'autre (`aSectorSoughtByB`, `bSectorSoughtByA`), région commune ou
voisine, rencontre passée, pénalités. `reasons.ts` en tire les phrases affichées.

Les secteurs pré-cochés viennent de `src/server/services/sought-sectors.ts` (`suggestedSectorsMap`,
affinité ≥ 65, 5 max). Les listes sont figées dans `EventRegistration.soughtSectorsSnapshot` au
moment de l'inscription, comme les offres et besoins.

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
