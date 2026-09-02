# TODO.md — État d'avancement

Légende : `[x]` fait · `[ ]` à faire · `[~]` en cours · `[!]` bloqué

## Semaine 1 — Fondations
- [x] S1-01 Initialisation du projet, outillage (Next 15.5, TS strict, Tailwind 4, ESLint, Prettier, Husky)
- [x] S1-02 shadcn/ui + police Inter auto-hébergée
- [x] S1-03 Schéma Prisma + migration initiale (`20260902133700_init`)
- [x] S1-04 Bibliothèques transverses (regions, normalize, logger, env, audit, rate-limit, dates, ics, crypto)
- [x] S1-05 Isolation par organisation + test d'intégration A/B
- [x] S1-06 Jetons participants (HS256) / jetons organisateur à usage unique
- [x] S1-07 Auth.js organisateur (mot de passe argon2id, lien magique, verrouillage progressif, réinitialisation, `sessionVersion`, middleware)
- [x] S1-08 Couche courriel (Resend → SMTP → console) + 6 templates react-email testés
- [x] S1-09 Layout public + marque par organisation + en-têtes de sécurité (CSP, HSTS…)
- [x] S1-10 Page publique + formulaire d'inscription en 3 étapes (consentement intégral, honeypot, délai ≥ 3 s, rate limit)
- [x] S1-11 Flux « courriel déjà connu » (même message, courriel avec lien signé, inscription en un clic)
- [x] S1-12 Espace participant (accueil, profil, page d'événement, .ics, consentement en attente, lien expiré + renvoi)
- [x] S1-13 Page `/[orgSlug]/confidentialite`
- [x] S1-14 Layout admin + tableau de bord + événements (liste, création, détails, ouvrir/fermer, dupliquer, archiver, lien public + QR)
- [x] S1-15 Onglet Inscrits (recherche, filtres, tri, pagination serveur, drawer profil/notes, statut, renvoi du lien, retrait)
- [x] S1-16 Seed de démonstration (org `demo`, 18 secteurs, matrice, 120 participants, 3 événements, snapshot) + `create-org`
- [x] S1-17 CI GitHub Actions (lint, typecheck, tests + Postgres, build, E2E, audit) + 12 tests Playwright
- [x] S1-18 README + résumé du jalon (voir la description de la PR)
- [x] S1-19 Autocomplétion des tags (livrée en S2-13)

## Semaine 2 — Matching
- [x] S2-01 Similarité de chaînes (Dice sur bigrammes, seuil 0,85, mémoïsée)
- [x] S2-02 Score de paire + raisons JSON + exclusions + régions voisines
- [x] S2-03 Phrases en français à partir des raisons (jamais de score)
- [x] S2-04 Sélection par participant (quota minimum visé, symétrie, seuil, abaissement par paliers)
- [x] S2-05 Placement aux tables (glouton + recherche locale itérée, verrous, secteur, multi-rondes, PRNG)
- [x] S2-06 Tests Vitest obligatoires, dont performance 300 / 15 tables / 3 rondes < 2 s
- [x] S2-07 Service `runMatchingForEvent` (candidats, rencontres passées, affinités, persistance, audit)
- [x] S2-08 Paramètres › Secteurs (ajout, renommage, ordre, désactivation)
- [x] S2-09 Paramètres › Matrice d'affinité (grille symétrique, tout à 50, import/export CSV)
- [x] S2-10 Paramètres › Règles de matching (jeux nommés, défaut, sliders expliqués)
- [x] S2-11 Onglet Matching (résumé, pondérations, lancer/recalculer, vue par participant, épingler, exclure, jumelage manuel)
- [x] S2-12 Inscrits : ajout manuel (MANUAL + courriel de consentement), import CSV (modèle, rapport d'erreurs), export CSV/XLSX
- [x] S2-13 Autocomplétion des étiquettes (tags de l'organisation)
- [x] S2-14 Seed : matching lancé sur l'événement OPEN
- [ ] S2-15 (reporté en S3) Envoi groupé des demandes de consentement après un import (file d'envoi)
- [ ] S2-16 (optionnel) Vue matrice secteur × secteur des scores moyens
- [x] S2-17 « Avec qui aimeriez-vous collaborer? » : secteurs recherchés pré-cochés depuis la matrice d'affinité (inscription, profil, fiche admin, ajout manuel, import/export, moteur, courriel, seed, tests) — D-26
- [x] S2-19 Composants beUI (motion) : chiffres animés, titres révélés, apparitions au défilement, curseurs à bulle, badge de statut, 404, échange de libellé, coche dessinée, onglets et menu qui glissent — D-27
- [x] S2-18 Icônes animées (`@animated-color-icons/lucide-react`, wrapper `AnimatedIcon`) prêtes pour la passe « wow »

## Semaine 3 — Tables, publication, jour J
- [x] S3-01 Onglet Tables : configuration (tables, places, rondes, minutes, noms), « Placer automatiquement » (respecte les verrous), vue par ronde
- [x] S3-02 Glisser-déposer (dnd-kit), verrouillage automatique au déplacement, cadenas, indicateurs (places libres, conflits de secteur, score moyen), colonne « Non placés »
- [x] S3-03 Exports du plan : Excel (une feuille par ronde) et page imprimable (une page par table et par ronde, gros caractères)
- [x] S3-04 Onglet Publication : aperçu du courriel, « Publier » (→ PUBLISHED, lots de 20 avec reprise, EmailLog, confirmation), republication intelligente (empreinte par inscrit), rappel, demandes de consentement groupées (S2-15) — D-28
- [x] S3-05 Vue participant : « Ma table » par ronde, « Mes jumelages » (cartes, raisons, coordonnées quand les deux sont présents)
- [x] S3-06 Onglet Jour J : liste alphabétique, recherche instantanée, « Présent » / annuler, compteur, ajout sur place, mode plein écran tablette, « Terminer l'événement » — D-29
- [x] S3-07 `billing.ts` : relevé immuable + test d'intégration prouvant l'absence de mise à jour; `pnpm billing:report --month AAAA-MM` — D-30
- [x] S3-08 Dupliquer / archiver / QR (livrés en S1-S2)
- [x] S3-09 Playwright : parcours complet (inscription → matching → tables → publication → participant → check-in → clôture)
- [x] S3-10 Seed : matching et placement sur l'événement ouvert et sur l'événement passé

## Semaine 4 — Finition et production
- [x] S4-01 Réglages › Organisation : nom, plateforme, courriels, fuseau, couleurs avec aperçu, logo (base de données, MIME vérifié, 2 Mo — D-31)
- [x] S4-02 Réglages › Consentement : éditeur, versions (SHA-256), historique, restauration
- [x] S4-03 Réglages › Comptes : invitation par courriel (jeton 7 jours), rôle, désactivation, garde-fous (D-32)
- [x] S4-04 Réglages › Facturation (lecture seule)
- [x] S4-05 Loi 25 : « Mes données » (JSON + CSV), demande de suppression → file admin → anonymisation + audit + courriel; export depuis la fiche
- [x] S4-06 Annuaire `/admin/participants` (recherche, secteur, pagination) + fiche complète
- [x] S4-07 Tableau de bord (livré en S2-S3; compteur de demandes de suppression ajouté)
- [x] S4-08 Squelettes de chargement, manifeste PWA + icônes, états vides, toasts; Lighthouse : à mesurer sur le domaine final (IDEES_PHASE2)
- [x] S4-09 Documentation : README (déploiement pas à pas, sauvegarde, checklist, FAQ), `docs/GUIDE_ORGANISATRICE.md`, `docs/LOI25.md`
- [x] S4-10 Production : Vercel + Neon en ligne (app-matchmaking.vercel.app), `pnpm create-org`, `pnpm remove-demo` · [ ] domaine final + organisation réelle (action de la cliente)

## Ligne directrice de la cliente (septembre 2026)
- [x] Vérification point par point : `docs/LIGNE_DIRECTRICE.md` (livré / partiel / Phase 2)
- [x] Règle « ET/OU » des secteurs recherchés dans le score (D-34), défauts couvrant ses exemples
- [x] Lien de billetterie externe + ajout au calendrier (`.ics`, Google Agenda)
- [x] Vitrine publique `/<organisation>`, « Autres événements ouverts » + inscription en un clic, « Inviter les participants passés » avec désabonnement (D-35)

## Liste de vérification sécurité (section 9)
- [x] Toutes les entrées validées avec Zod côté serveur (`src/lib/validation`)
- [x] Isolation par organisation sur chaque requête + test A/B (`tests/integration/org-scope.test.ts`)
- [x] Jetons participants signés (HS256), expiration, `tokenVersion`
- [x] Mots de passe argon2id; journaux pino avec `redact` (mots de passe, jetons, cookies)
- [x] En-têtes de sécurité (CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy)
- [x] Rate limiting : inscription publique, login, lien magique, réinitialisation, renvoi de lien participant, demande de suppression (3/participant/jour, 10/IP/jour)
- [x] Honeypot + délai minimal ≥ 3 s sur le formulaire public
- [x] CSRF : server actions + cookies sameSite; liens magiques consommés en POST; aucun GET qui modifie l'état
- [x] Uploads : MIME détecté par les octets (PNG/JPEG/WebP, SVG refusé), 2 Mo max, nom jamais réutilisé (`src/lib/uploads.ts`, test unitaire + E2E)
- [x] Aucune donnée personnelle dans les URL (sauf jeton opaque) ni dans les journaux
- [x] `pnpm audit --audit-level=high` dans la CI (surcharges pnpm, voir D-19)
- [x] Procédure de sauvegarde/restauration documentée (README › Sauvegarde)

## Bloqué / questions ouvertes
- Nom d'affichage de la plateforme (`[NOM_APP]`) : « Jumelage » utilisé par défaut.
- Domaine de production : à fournir par la cliente (Vercel › Domains), puis mettre `AUTH_URL` et
  `APP_BASE_URL` à jour. Base de données : Neon (décidé, en ligne).
