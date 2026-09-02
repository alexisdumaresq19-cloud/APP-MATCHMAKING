# DECISIONS.md — Journal des décisions d'architecture

Format : `D-nn — Titre` · Contexte · Décision · Raison · Conséquences.

## D-01 — Next.js 15.5 (et non 16)
- **Contexte** : le cahier des charges impose Next.js 15. Next.js 16 est la version « latest »
  depuis fin 2025; 15.5 reste maintenue (étiquette `backport`, correctifs réguliers).
- **Décision** : Next.js 15.5.x, App Router, TypeScript strict, Turbopack en dev, webpack en build.
- **Raison** : respect du cahier des charges; écosystème (Auth.js v5, shadcn/ui, Prisma) éprouvé
  sur 15; aucune fonctionnalité de 16 nécessaire à la Phase 1.
- **Conséquences** : migration vers 16 (`middleware.ts` → `proxy.ts`, Turbopack build) notée dans
  `IDEES_PHASE2.md`.

## D-02 — Prisma 6.19 (et non 7)
- **Contexte** : Prisma 7 remplace le générateur `prisma-client-js` par `prisma-client`, exige un
  adaptateur de pilote et déplace l'URL de connexion dans `prisma.config.ts`.
- **Décision** : Prisma 6.19.x avec le schéma exactement tel que fourni (`prisma-client-js`,
  `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`).
- **Raison** : le schéma du cahier des charges est écrit pour Prisma 6; 6.19 est stable et
  maintenue; la migration vers 7 est mécanique et isolée dans `src/lib/db/prisma.ts`.

## D-03 — Lien magique et réinitialisation sans le provider Email d'Auth.js
- **Contexte** : le provider Email d'Auth.js exige un adaptateur (`User`, `Account`,
  `VerificationToken`) qui suppose un courriel unique globalement. Notre modèle `Organizer` est
  unique par `(organizationId, email)` pour permettre le multi-organisation.
- **Décision** : Auth.js v5 avec deux providers Credentials : `password` (courriel + mot de
  passe) et `magic-link` (jeton à usage unique). Les jetons (lien magique, réinitialisation,
  invitation) vivent dans la table `OrganizerToken` (hash SHA-256 du jeton, usage, expiration,
  `usedAt`). Les courriels sont envoyés par notre couche courriel (Resend/SMTP).
- **Raison** : pas d'adaptateur à tordre; un seul modèle d'organisateur; jetons révocables et
  audités. Sessions JWT (obligatoires avec Credentials) en cookie httpOnly/secure/sameSite=lax.
- **Conséquences** : la session porte `organizerId`, `organizationId`, `role`, `sessionVersion`;
  le callback `jwt` revalide `sessionVersion`/`isActive` en base au plus toutes les 5 minutes.

## D-04 — Jetons participants : JWT HS256 via `jose`
- **Décision** : `/p/[token]` reçoit un JWT HS256 signé avec `PARTICIPANT_TOKEN_SECRET`, claims
  `sub` (participantId), `org`, `v` (tokenVersion), `exp` (fin du dernier événement inscrit + 30
  jours, minimum 60 jours). Vérification : signature, expiration, `v === participant.tokenVersion`,
  `deletedAt === null`.
- **Raison** : `jose` est déjà une dépendance transitive d'Auth.js, compatible Edge, format
  standard. Révocation = incrémenter `tokenVersion`.
- **Conséquences** : le même mécanisme (avec `purpose`) sert au lien « inscription en un clic »
  pour un profil existant (`purpose: "register"`, `eventId`, expiration 7 jours).

## D-05 — Hachage des mots de passe : argon2id via `@node-rs/argon2`
- **Raison** : binaires précompilés (pas de node-gyp), fonctionne sur Vercel, paramètres par
  défaut conformes (argon2id, m=19 MiB, t=2, p=1).

## D-06 — Courriels : transport en cascade Resend → SMTP → console
- **Décision** : `RESEND_API_KEY` présent → Resend; sinon `SMTP_HOST` présent → Nodemailer; sinon
  transport « console » (journalise le courriel, écrit `EmailLog.status = "sent"` avec
  `providerId = "console"`). Templates `react-email` rendus en HTML + texte brut.
- **Raison** : développement et tests sans clé; production sans changement de code.

## D-07 — Rate limiting : Upstash si configuré, sinon table `RateLimit` en base
- **Décision** : `rateLimit(key, { limit, windowSeconds })` avec fenêtre fixe. Implémentation en
  base par `UPSERT` atomique sur `(key)` avec `windowStart`; Upstash `@upstash/ratelimit` si les
  variables sont présentes.
- **Raison** : aucune dépendance obligatoire à Redis en Phase 1.

## D-08 — Ajouts au schéma Prisma (aucun retrait)
- `Organization.timezone` (`America/Toronto`) et `Organization.consentVersion` (hash SHA-256 du
  texte courant, recalculé à chaque modification) — versionnage du consentement.
- `Organizer.sessionVersion`, `failedLoginCount`, `lockedUntil` — déconnexion partout et
  verrouillage progressif.
- `Participant.consentedAt` — dénormalisation du dernier consentement (badge « en attente »).
- Modèle `OrganizerToken` (lien magique, réinitialisation, invitation).
- Modèle `DeletionRequest` (demande de suppression Loi 25 : participant → confirmation admin).
- Modèle `RateLimit` (D-07).
- `EventRegistration.publishedMatchesHash` et `publishedAt` — republication intelligente (S3-04).
- `Event.reminderSentAt` — rappel J-1.
- `AuditAction` : ajout de `LOGIN_FAILED`, `CHECK_IN`, `STATUS_CHANGE`.

## D-09 — Isolation par organisation
- **Décision** : `src/lib/db/org-scope.ts` expose `requireOrganizer()` (session → orgId) et des
  accesseurs `orgEvent(orgId, eventId)`, `orgParticipant(orgId, id)`, `orgRegistration(...)` qui
  lèvent `NotFoundError` si l'entité n'appartient pas à l'organisation. Les entités sans
  `organizationId` (inscriptions, matchs, tables) sont filtrées via `event.organizationId`.
- **Raison** : règle d'intégrité du cahier des charges; un test d'intégration (org A / org B) le
  prouve.

## D-10 — Texte d'interface en français directement dans les composants
- **Décision** : pas de bibliothèque i18n; chaînes fr-CA en dur dans les composants, vouvoiement.
- **Raison** : une seule langue en Phase 1; une bibliothèque ajouterait de la friction sans
  bénéfice. Les dates sont formatées avec `Intl` (`fr-CA`, fuseau `Organization.timezone`).

## D-11 — Police Inter auto-hébergée via `next/font/local`
- **Décision** : fichiers woff2 d'Inter (variable, latin + latin-ext) copiés depuis
  `@fontsource-variable/inter` dans `src/styles/fonts/`, chargés avec `next/font/local`.
- **Raison** : `next/font/google` télécharge au build (réseau requis en CI); aucune ressource
  tierce sur les pages publiques (Loi 25).

## D-12 — Contenu de sécurité (CSP)
- **Décision** : en-têtes via `next.config.ts` : HSTS, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options`,
  `Permissions-Policy` restrictive, CSP `default-src 'self'` avec `'unsafe-inline'` pour
  `script-src`/`style-src` (nécessaire au runtime Next.js sans nonce) et `img-src 'self' data:
  blob: https:` (logos hébergés). `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
- **Conséquence** : passage à une CSP par nonce noté en Phase 2.

## D-13 — Pagination et recherche des inscrits côté serveur
- **Décision** : paramètres d'URL (`?q=&statut=&secteur=&region=&source=&tri=&page=`) lus dans un
  Server Component; recherche `ILIKE` sur nom, entreprise, courriel; 25 lignes par page.
- **Raison** : simple, partageable par lien, pas d'état client à synchroniser.

## D-14 — Revalidation de session côté serveur plutôt que dans le callback JWT
- **Décision** : `requireOrganizer()` (pages) et `requireOrganizerAction()` (actions) relisent
  l'organisateur en base à chaque requête (mise en cache par requête avec `React.cache`) et
  vérifient `isActive`, `sessionVersion` et l'appartenance à l'organisation. Le middleware ne
  vérifie que la présence d'un JWT valide pour le routage.
- **Raison** : une lecture par clé primaire est négligeable; la déconnexion partout et la
  désactivation d'un compte sont effectives immédiatement, sans dépendre des subtilités du
  callback `jwt` d'Auth.js (retour `null`, fenêtre de 5 minutes).

## D-15 — Liens magiques et réinitialisation consommés en POST
- **Décision** : la page `/admin/connexion?token=…` (et `/admin/reinitialiser`) n'invalide pas le
  jeton au chargement : elle affiche un bouton dont l'envoi (server action) consomme le jeton.
- **Raison** : règle « aucun GET ne modifie l'état » (section 9) et protection contre les
  antivirus/scanners de courriel qui ouvrent les liens et « brûleraient » les jetons.

## D-16 — Composants shadcn/ui « base-nova » (Base UI) et champs natifs sur mobile
- **Contexte** : la CLI shadcn installe désormais des composants bâtis sur Base UI (`@base-ui/react`)
  plutôt que Radix.
- **Décision** : conserver ces composants pour l'admin (dialogues, panneaux, menus) mais utiliser des
  `<select>` et `<input type="checkbox">` natifs (composants `NativeSelect`, `ConsentBox`) dans les
  formulaires publics et participant.
- **Raison** : sélecteurs système sur mobile, soumission en `FormData` sans état client, meilleure
  accessibilité par défaut, cibles tactiles ≥ 44 px.

## D-17 — Formulaire d'inscription en une seule page, étapes masquées
- **Décision** : les trois étapes vivent dans un seul `<form>`; les étapes non courantes sont
  `hidden` (les champs restent soumis). Validation Zod par étape côté client (mêmes schémas que le
  serveur), puis validation complète côté serveur; le serveur renvoie l'étape à afficher en cas
  d'erreur.
- **Raison** : sauvegarde locale en mémoire seulement (exigence 6.2), un seul envoi réseau, aucune
  donnée personnelle dans l'URL.

## D-18 — Police Inter : sous-ensemble latin uniquement
- **Décision** : `next/font/local` avec le seul fichier `inter-latin-wght-normal.woff2` (police
  variable, ≈ 45 ko). Les caractères latin-ext (œ, Œ) tombent sur la police système.
- **Raison** : `next/font/local` ne permet pas de `unicode-range` par fichier; deux fichiers avec
  les mêmes descripteurs s'écraseraient. Compromis jugé acceptable (fréquence de « œ » très faible).

## D-19 — Vulnérabilités transitives : surcharges pnpm
- **Décision** : `pnpm.overrides` force `postcss ≥ 8.5.18` (dépendance interne de Next.js) et
  `deepmerge-ts ≥ 8` (CLI Prisma) afin que `pnpm audit --audit-level=high` passe en CI;
  `nodemailer` 9 est autorisé malgré la plage de pairs d'Auth.js (provider Email non utilisé).
- **Conséquence** : à réévaluer à chaque mise à niveau de Next.js/Prisma.

## D-20 — Boîte de courriels de test dans l'admin
- **Contexte** : sans service d'envoi configuré, les liens personnels des participants n'arrivent
  nulle part, ce qui empêche de tester le parcours complet sans lire les journaux du serveur.
- **Décision** : le transport « console » conserve le corps texte du courriel dans
  `EmailLog.previewText` (avec `organizationId` et `subject`), et l'admin affiche
  `/admin/courriels` (« Courriels (test) ») tant que ce transport est actif. Dès qu'une clé Resend
  ou un SMTP est configuré, rien n'est conservé et la page disparaît (404).
- **Raison** : essais réalistes en local et sur un déploiement de démonstration, sans jamais stocker
  de corps de courriel en production.

## D-21 — `pnpm first-run` et `vercel-build`
- **Décision** : `scripts/first-run.ts` génère `.env` (secrets aléatoires), applique les migrations
  et charge la démo; `vercel-build` exécute `prisma migrate deploy`, charge la démo une seule fois
  si `SEED_DEMO=true` et la base est vide, puis construit l'application.
- **Raison** : mise en route en une commande pour les essais; à la semaine 4, `SEED_DEMO` est retiré
  de la production et la démo supprimée.

## D-22 — Placement : répartition égale puis recherche locale itérée
- **Contexte** : la construction gloutonne « table par table jusqu'à `seats` » entasse les meilleurs
  pivots dans les premières tables et laisse les dernières vides ou faibles.
- **Décision** : chaque table reçoit d'abord un pivot (le participant au plus fort score total
  restant), puis les tables sont remplies à tour de rôle jusqu'à ⌈n / tables⌉, puis complétées. La
  recherche locale est une descente par premier gain (déplacement ou échange) suivie de
  perturbations aléatoires avec conservation de la meilleure configuration (recherche locale
  itérée), au lieu d'échanges purement aléatoires.
- **Raison** : sur 24 personnes, 6 tables de 4 et 3 rondes, 0 répétition; sur 24 personnes et 4
  tables de 6, le minimum théorique (8 répétitions par ronde) est atteint. Reproductible à graine
  égale; le budget de temps (500 ms au total) n'est qu'un garde-fou.

## D-23 — Statut de l'événement au lancement du matching
- **Décision** : lancer le matching sur un événement OPEN ne change pas son statut (aperçu
  possible pendant les inscriptions); sur un événement CLOSED, il passe à MATCHED.
- **Raison** : l'organisatrice veut voir les jumelages évoluer sans fermer les inscriptions; la
  chaîne OPEN → CLOSED → MATCHED → PUBLISHED reste le parcours nominal.

## D-24 — Import CSV : aucun courriel à l'importation
- **Décision** : l'importation crée les inscriptions (source IMPORT, consentement en attente) sans
  envoyer de courriel. Les demandes de consentement partent individuellement (fiche de l'inscrit)
  ou par lot avec la file d'envoi de la semaine 3.
- **Raison** : envoyer des centaines de courriels dans une action serveur dépasserait les limites
  de temps d'exécution (Vercel); la file d'envoi par lots de 20 est prévue pour la publication.

## D-25 — Participants sans secteur ignorés par le matching
- **Décision** : conformément au cahier des charges, seuls les inscrits non annulés **avec un
  secteur** sont jumelés; les autres sont listés dans l'onglet Matching avec un rappel de compléter
  leur profil. Une région manquante vaut un score neutre (50), pas une exclusion.

## D-26 — « Avec qui aimeriez-vous collaborer? » : besoins exprimés en secteurs, pré-cochés
- **Contexte** : la ligne directrice de la cliente demande que les entreprises n'aient pas à écrire
  ce qu'elles cherchent : une liste de secteurs à cocher, pré-remplie par l'application (« une
  garderie connecte avec entretien ménager et animation »), tout en laissant l'entreprise ajuster.
- **Décision** : chaque participant a une liste de **secteurs recherchés** (`Participant.soughtSectorIds`,
  figée par inscription dans `soughtSectorsSnapshot`). À l'inscription, au profil et dans la fiche
  admin, la liste est pré-cochée à partir de la **matrice d'affinité** existante (affinité ≥ 65, 4
  max), sans nouvelle table de règles. Le champ libre « Ce que vous cherchez » devient facultatif;
  il faut au moins un secteur coché ou un besoin écrit. Dans le score, un secteur recherché compte
  comme un besoin supplémentaire, satisfait quand l'autre participant appartient à ce secteur;
  `reasons.ts` l'explique (« Vous souhaitiez rencontrer le secteur « … ». »).
- **Raison** : une seule source de vérité (la matrice, déjà éditable par l'organisatrice) nourrit
  à la fois la suggestion et le score; la formule de la section 7.2 reste inchangée pour les
  étiquettes libres. Le reste de la ligne directrice (annuaire Google Places, tri payant, messagerie,
  carnet d'adresses, billetterie) est hors Phase 1 et consigné dans IDEES_PHASE2.md.

## D-27 — Mouvement : beUI copié dans le projet, boutons et cases natives conservés
- **Contexte** : la cliente veut une interface « wow ». beUI fournit des composants animés (motion)
  de qualité; mais remplacer nos boutons (shadcn base-nova) et nos cases à cocher natives par les
  siens casserait l'uniformité visuelle, les formulaires en actions serveur et les tests.
- **Décision** : on copie les composants beUI utiles dans `src/components/motion/` (registre
  shadcn, code sous notre contrôle) et on reprend seulement le *motif* de mouvement là où le
  composant beUI imposerait sa propre structure : échange de libellé des boutons (`ActionSwap`),
  coche dessinée par-dessus une case native (`CheckMark`), indicateurs qui glissent (`layoutId`).
  Toute animation respecte `prefers-reduced-motion` et n'anime que `transform`/`opacity`.
- **Raison** : un seul langage visuel, formulaires inchangés (FormData, validation, Playwright),
  et des sources modifiables (textes français, marque) sans dépendre d'un paquet tiers.

## D-28 — Publication : file d'envoi pilotée par le navigateur, par lots de 20
- **Contexte** : publier à 300 inscrits, c'est 300 courriels; une seule action serveur dépasserait la
  limite de temps d'une fonction Vercel, et une file de tâches (Redis, cron) ajouterait une
  infrastructure hors Phase 1.
- **Décision** : « Publier » ne fait que passer l'événement à PUBLISHED. L'onglet Publication appelle
  ensuite l'action `sendBatch` en boucle; chaque appel envoie au plus 20 courriels (un essai +
  une reprise chacun), met à jour l'empreinte `publishedMatchesHash` des inscrits servis et renvoie
  ce qui reste. La barre de progression suit; un lot entièrement en échec arrête la boucle. Les
  rappels et les demandes de consentement groupées utilisent la même mécanique. L'empreinte
  (partenaires + places, hachage SHA-256) fait qu'une republication n'écrit qu'aux inscrits
  concernés.
- **Raison** : aucune infrastructure supplémentaire, reprise naturelle (relancer n'envoie que ce qui
  manque), et une trace par courriel dans `EmailLog`.

## D-29 — Jour J : mode plein écran dans un groupe de routes sans menu
- **Décision** : `/admin/events/[id]/jour-j/plein-ecran` et `/admin/events/[id]/tables/imprimer`
  vivent dans le groupe `(kiosk)` : même authentification que l'admin, aucune barre latérale ni
  onglet, gros contrôles. Le check-in et l'ajout sur place sont les mêmes actions serveur que
  l'onglet Jour J.
- **Raison** : sur une tablette à l'entrée, chaque pixel compte et rien ne doit distraire; une page
  d'impression sans chrome donne un PDF propre via « Enregistrer en PDF » sans bibliothèque PDF.

## D-30 — Relevé de facturation figé; rappel horodaté au lancement
- **Décision** : `BillingSnapshot` est écrit une seule fois par « Terminer l'événement » (même
  transaction que NO_SHOW et COMPLETED); il n'existe aucune fonction de mise à jour et une
  seconde écriture échoue (contrainte unique). Un test d'intégration modifie les inscriptions après
  coup et vérifie que le relevé ne bouge pas. `Event.reminderSentAt` marque le début de la dernière
  campagne de rappel; les inscrits déjà servis sont reconnus par leurs entrées `EmailLog` postérieures.
- **Raison** : la facturation (section 9) doit être auditable et stable; un marqueur par campagne
  évite un champ de plus par inscription.
