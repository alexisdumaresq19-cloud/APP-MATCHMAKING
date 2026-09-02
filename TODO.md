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
- [x] S2-18 Icônes animées (`@animated-color-icons/lucide-react`, wrapper `AnimatedIcon`) prêtes pour la passe « wow »

## Semaine 3 — Tables, publication, jour J
- [ ] S3-01 … S3-10 (voir PLAN.md)

## Semaine 4 — Finition et production
- [ ] S4-01 … S4-10 (voir PLAN.md)

## Liste de vérification sécurité (section 9)
- [x] Toutes les entrées validées avec Zod côté serveur (`src/lib/validation`)
- [x] Isolation par organisation sur chaque requête + test A/B (`tests/integration/org-scope.test.ts`)
- [x] Jetons participants signés (HS256), expiration, `tokenVersion`
- [x] Mots de passe argon2id; journaux pino avec `redact` (mots de passe, jetons, cookies)
- [x] En-têtes de sécurité (CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy)
- [x] Rate limiting : inscription publique, login, lien magique, réinitialisation, renvoi de lien participant · [ ] demande de suppression (S4)
- [x] Honeypot + délai minimal ≥ 3 s sur le formulaire public
- [x] CSRF : server actions + cookies sameSite; liens magiques consommés en POST; aucun GET qui modifie l'état
- [ ] Uploads : MIME vérifié côté serveur, taille limitée, nom régénéré (S4-01)
- [x] Aucune donnée personnelle dans les URL (sauf jeton opaque) ni dans les journaux
- [x] `pnpm audit --audit-level=high` dans la CI (surcharges pnpm, voir D-19)
- [ ] Procédure de sauvegarde documentée (S4-09)

## Bloqué / questions ouvertes
- Nom d'affichage de la plateforme (`[NOM_APP]`) : « Jumelage » utilisé par défaut.
- Domaine de production et fournisseur de base de données (Supabase vs Neon) : à confirmer
  avant la semaine 4; aucun impact sur le code.
