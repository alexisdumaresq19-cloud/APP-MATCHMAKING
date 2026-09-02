# PLAN.md — Plateforme de jumelage pour événements de réseautage (Phase 1)

Projet : `matchmaking-events` · Propriétaire : AD Création · Cliente : l'Organisatrice
Durée : 4 semaines · Portée : section 2 du cahier des charges (Phase 1 uniquement)

Chaque tâche a un identifiant (`S1-03` = semaine 1, tâche 3). L'état d'avancement est
tenu dans `TODO.md`; les décisions non triviales dans `DECISIONS.md`; les idées hors
portée dans `IDEES_PHASE2.md`.

---

## Semaine 1 — Fondations

Objectif : un participant peut s'inscrire depuis un téléphone, recevoir son lien,
modifier son profil; un organisateur peut se connecter et voir la liste des inscrits.

| ID | Tâche | Livrable |
|---|---|---|
| S1-01 | Initialisation du projet Next.js 15 (App Router, TS strict, Tailwind 4, src/), pnpm, ESLint, Prettier, Husky, `.env.example` | `pnpm dev` démarre, `pnpm lint`/`typecheck` passent |
| S1-02 | shadcn/ui (composants de base : button, input, label, select, textarea, checkbox, card, badge, table, dialog, sheet, tabs, toast, dropdown, skeleton, alert) + police Inter auto-hébergée | `src/components/ui/*` |
| S1-03 | Schéma Prisma complet (section 5 + ajouts documentés), première migration, client Prisma singleton | `prisma/schema.prisma`, `prisma/migrations/0001_init` |
| S1-04 | Bibliothèques transverses : `regions.ts`, `normalize.ts` (tags, slug, courriel, téléphone E.164), `logger` (pino), `env.ts` (validation Zod des variables d'env), `audit.ts`, `rate-limit.ts` (Upstash ou base) | `src/lib/*` + tests unitaires |
| S1-05 | Helpers d'isolation par organisation (`src/lib/db/org-scope.ts`) + test d'intégration prouvant l'isolation A/B | Test Vitest contre Postgres |
| S1-06 | Jetons participants signés (HS256 via `jose`, `tokenVersion`, expiration) + jetons organisateur à usage unique (lien magique, réinitialisation, invitation) | `src/lib/auth/participant-token.ts`, `organizer-token.ts` + tests |
| S1-07 | Auth.js v5 organisateur : Credentials (courriel + mot de passe argon2id), lien magique, verrouillage progressif (5 échecs), session JWT 7 jours, `sessionVersion`, middleware de protection `/admin/*`, journal d'audit LOGIN | `/admin/login`, `/admin/mot-de-passe-oublie`, `/admin/reinitialiser` |
| S1-08 | Couche courriel : Resend → SMTP (Nodemailer) → console (dev), templates react-email FR (`registration_confirmed`, `existing_profile_link`, `magic_link`, `password_reset`, `consent_pending`), `EmailLog` | `src/lib/email/*` |
| S1-09 | Layout public avec marque de l'organisation (variables CSS injectées côté serveur), pied « Propulsé par AD Création », en-têtes de sécurité | `src/app/(public)/layout.tsx`, `next.config.ts` |
| S1-10 | Page publique `/e/[orgSlug]/[eventSlug]` : en-tête, infos, états fermé/complet/archivé, formulaire d'inscription en 3 étapes (Zod client + serveur, tags, consentement intégral non pré-coché, honeypot, délai ≥ 3 s, rate limit), page `/merci` | Inscription fonctionnelle bout en bout |
| S1-11 | Flux « courriel déjà connu » : même message de succès, courriel `existing_profile_link` avec lien signé, page d'inscription en un clic | `/e/[orgSlug]/[eventSlug]/inscription-rapide` |
| S1-12 | Espace participant `/p/[token]` : layout de vérification du jeton, « Mon profil » (modifiable sauf courriel), « Mes événements », page d'événement (infos pratiques, lien Google Maps, fichier .ics, acceptation du consentement si en attente, message « jumelages disponibles avant l'événement »), page « lien expiré » avec renvoi de lien | Vue participant mobile-first |
| S1-13 | Page `/[orgSlug]/confidentialite` | Texte de consentement courant + coordonnées du responsable |
| S1-14 | Layout admin (navigation, session, déconnexion), liste des événements, création/édition d'un événement (onglet Détails : champs, slug auto, ouverture/fermeture des inscriptions, lien public à copier) | `/admin`, `/admin/events`, `/admin/events/[id]/details` |
| S1-15 | Onglet Inscrits : tableau (recherche, filtres statut/secteur/région/source, tri, pagination serveur), drawer profil, changement de statut, notes internes, renvoi du lien, retrait (→ CANCELLED) | `/admin/events/[id]/inscrits` |
| S1-16 | Seed de démonstration (organisation `demo`, OWNER/STAFF, 18 secteurs, matrice d'affinité, règles par défaut, 120 participants faker fr_CA, 3 événements, snapshot de facturation du passé) + script `create-org` | `pnpm db:reset && pnpm db:seed` |
| S1-17 | CI GitHub Actions (lint, typecheck, tests unitaires + intégration avec service Postgres, build, `pnpm audit`), Playwright configuré + test E2E d'inscription | `.github/workflows/ci.yml`, `tests/e2e/registration.spec.ts` |
| S1-18 | README (installation locale, commandes), résumé du jalon | `README.md` |

**Terminé quand** : le parcours inscription → courriel (console en dev) → lien participant →
modification du profil fonctionne sur mobile; `owner@demo.local` se connecte et voit les
inscrits de l'événement OPEN; CI verte.

---

## Semaine 2 — Matching

Objectif : l'organisatrice lance le matching sur le seed et obtient des matchs cohérents avec
raisons lisibles; PIN/EXCLUDE fonctionnent; tests verts.

| ID | Tâche |
|---|---|
| S2-01 | `src/lib/matching/normalize.ts` (déjà en S1) + `similarity.ts` (Dice sur bigrammes ≥ 0,85) |
| S2-02 | `score.ts` : score de paire (section 7.2), raisons JSON (7.3), exclusions (même entreprise, même secteur si pénalité ≥ 100), table des régions voisines (Annexe B) |
| S2-03 | `reasons.ts` : génération de 2-3 phrases en français à partir des raisons (jamais de score numérique) |
| S2-04 | `select.ts` : sélection par participant (quota = minimum visé, symétrie, seuil global, abaissement par paliers de 10 pour < 2 matchs, rapport) |
| S2-05 | `seating.ts` : construction gloutonne + amélioration locale (swaps, sièges vides, `maxIterations`/500 ms), verrous, contrainte même secteur, multi-rondes avec pénalité −50, rapport; PRNG déterministe (`seed`) |
| S2-06 | Tests Vitest obligatoires (section 7.5) incluant performance 300 participants / 15 tables / 3 rondes < 2 s |
| S2-07 | Service serveur `runMatching(eventId)` : construit les `Candidate` depuis Prisma (rencontres passées = même table à un événement COMPLETED), persiste (supprime PROPOSED, conserve PINNED/EXCLUDED), `matchedAt`, audit MATCH_RUN |
| S2-08 | Paramètres › Secteurs : liste triable, ajout/renommage/désactivation |
| S2-09 | Paramètres › Matrice d'affinité : grille éditable symétrique, « tout mettre à 50 », import/export CSV |
| S2-10 | Paramètres › Règles de matching : jeux nommés, un par défaut, sliders avec explication |
| S2-11 | Onglet Matching : résumé, panneau de pondérations, « Lancer le matching », résumé du calcul (score moyen, < 2 matchs, exclusions), vue par participant (Épingler / Exclure / jumelage manuel → PINNED) |
| S2-12 | Onglet Inscrits : ajout manuel (source MANUAL, courriel `consent_pending`, badge « Consentement en attente »), import CSV (modèle, validation ligne par ligne, rapport d'erreurs), export CSV/XLSX de la liste filtrée |
| S2-13 | Autocomplétion des tags à partir des tags existants dans l'organisation |
| S2-14 | Seed : lancer le matching sur l'événement OPEN |

---

## Semaine 3 — Tables, publication, vue participant complète, jour J

Objectif : de bout en bout, de l'inscription au check-in, sans toucher à la base;
Playwright couvre le parcours.

| ID | Tâche |
|---|---|
| S3-01 | Onglet Tables : configuration (tables, places, rondes, labels), « Placer automatiquement » (respecte `isLocked`), vue par ronde en grille |
| S3-02 | Glisser-déposer (`@dnd-kit`), verrouillage automatique au déplacement manuel, cadenas cliquable, indicateurs (places libres, conflit de secteur, score de table), liste des non placés |
| S3-03 | Exports du plan de tables : XLSX (une feuille par ronde) et PDF imprimable (une page par table, gros caractères, page HTML `print`) |
| S3-04 | Onglet Publication : aperçu du courriel, « Publier les jumelages » (→ PUBLISHED, file d'envoi par lots de 20 avec retry, `EmailLog`, modale de confirmation), republication intelligente (hash des matchs par inscrit), « Envoyer un rappel » |
| S3-05 | Vue participant : « Mes jumelages » (cartes avec raisons lisibles, coordonnées après CHECKED_IN), « Ma table » (par ronde, horaire), infos pratiques |
| S3-06 | Onglet Jour J : plein écran tablette, liste alphabétique + recherche instantanée, bouton « Présent », compteur, ajout rapide MANUAL, « Terminer l'événement » (→ COMPLETED, `BillingSnapshot`, NO_SHOW, confirmation) |
| S3-07 | `billing.ts` : snapshot immuable + test prouvant l'absence d'update; script `pnpm billing:report --month AAAA-MM` |
| S3-08 | Dupliquer / archiver un événement; QR code PNG de la page publique |
| S3-09 | Playwright : parcours complet (inscription → connexion → matching → tables → publication → check-in) |
| S3-10 | Seed : placement aux tables sur l'événement OPEN |

---

## Semaine 4 — Finition et mise en production

Objectif : application en production sur le domaine final, organisation réelle créée,
seed retiré, checklist de mise en service remplie.

| ID | Tâche |
|---|---|
| S4-01 | Paramètres › Organisation : nom, nom de plateforme, logo (upload Supabase Storage, MIME vérifié, 2 Mo), couleurs avec aperçu en direct, courriels |
| S4-02 | Paramètres › Consentement : éditeur, versionnage par hash, historique |
| S4-03 | Paramètres › Comptes (OWNER) : invitation STAFF par courriel, désactivation, rôle, garde-fou auto-désactivation |
| S4-04 | Paramètres › Facturation (lecture seule) |
| S4-05 | Loi 25 : « Mes données » (export JSON + CSV), demande de suppression → file admin « Demandes de suppression » → anonymisation + audit + courriel `deletion_confirmed`; export depuis l'admin |
| S4-06 | Annuaire `/admin/participants` avec fiche (historique d'inscriptions et de matchs) |
| S4-07 | Tableau de bord `/admin` : cartes, inscriptions 7 jours, tâches à faire, filtres de la liste |
| S4-08 | États vides, squelettes, toasts, accessibilité (contraste AA, cibles 44 px, focus), Lighthouse ≥ 90 mobile sur la page publique, PWA installable minimale (manifeste) |
| S4-09 | Documentation : `README.md` (déploiement Vercel + Supabase pas à pas, sauvegarde/restauration, checklist, FAQ), `docs/GUIDE_ORGANISATRICE.md`, `docs/MATCHING.md`, `docs/LOI25.md` |
| S4-10 | Production : DB Supabase/Neon, Vercel, domaine + HTTPS, Sentry optionnel, `create-org` pour l'organisation réelle, retrait du seed de démo |

---

## Risques et parades

- **Volume de la portée** : découpage en incréments qui compilent; les onglets non livrés
  affichent un état « bientôt » plutôt que d'être cachés.
- **Courriels en développement** : transport « console » par défaut, aucun envoi réel sans clé.
- **Multi-organisation** : isolation testée dès la semaine 1; toute nouvelle requête passe par
  les helpers de `src/lib/db/org-scope.ts`.
- **Matching** : bibliothèque pure, testée unitairement avant tout branchement UI.
- **Versions** : Next 15.5 / Prisma 6 (voir `DECISIONS.md` D-01, D-02); mise à niveau vers
  Next 16 / Prisma 7 planifiée en Phase 2.
