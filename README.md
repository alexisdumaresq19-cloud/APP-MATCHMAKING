# Jumelage — plateforme de matchmaking pour événements de réseautage

Application web de jumelage d'entrepreneurs pour des événements de réseautage. Propriété
d'AD Création (Gaspé, Québec), licenciée à des organisateurs d'événements. Multi-organisation
dans le modèle de données; une organisation servie à la fois dans l'interface (Phase 1).

Documents de travail : [`PLAN.md`](PLAN.md) (jalons et tâches), [`TODO.md`](TODO.md) (avancement),
[`DECISIONS.md`](DECISIONS.md) (décisions d'architecture), [`IDEES_PHASE2.md`](IDEES_PHASE2.md).

## Pile technique

Next.js 15 (App Router, Server Actions), TypeScript strict, Tailwind CSS 4 + shadcn/ui,
PostgreSQL + Prisma 6, Auth.js v5 (organisateurs), jetons signés HS256 (participants),
react-email + Resend/SMTP, Zod, Vitest, Playwright, pino. Voir `DECISIONS.md` pour les choix.

## Prérequis

- Node.js 22 (≥ 20.9) et pnpm 10 (`corepack enable`)
- PostgreSQL 14+ (local, Docker, Supabase ou Neon)

## Essayer rapidement

Guide pas à pas (ordinateur ou Vercel + Neon) : [`docs/ESSAYER.md`](docs/ESSAYER.md). En résumé,
après `pnpm install` : `pnpm first-run` puis `pnpm dev`.

## Installation locale

```bash
pnpm install
cp .env.example .env          # puis remplir DATABASE_URL, DIRECT_URL, AUTH_SECRET, PARTICIPANT_TOKEN_SECRET
pnpm db:migrate               # applique les migrations (crée la base au besoin)
pnpm db:seed                  # organisation de démonstration « demo »
pnpm dev                      # http://localhost:3000
```

Secrets : `openssl rand -base64 32` (un pour `AUTH_SECRET`, un autre pour `PARTICIPANT_TOKEN_SECRET`).
S'ils sont absents, un secret de secours est dérivé de la chaîne de connexion à la base (pratique
pour les essais; obligatoire de les définir explicitement en production, un avertissement est
journalisé).

Sans `RESEND_API_KEY` ni `SMTP_HOST`, les courriels ne sont pas envoyés : ils sont journalisés
dans la console du serveur et consultables, liens cliquables inclus, dans l'admin sous
« Courriels (test) » (`/admin/courriels`). Cette boîte disparaît dès qu'un service d'envoi est
configuré; le corps des courriels n'est jamais conservé en production.

### Données de démonstration

`pnpm db:seed` crée l'organisation **Démo Réseautage** (slug `demo`) :

| Élément | Valeur |
|---|---|
| Connexion organisateur | `owner@demo.local` / `Demo-1234!` (OWNER) · `staff@demo.local` / `Demo-1234!` (STAFF) |
| Page publique d'inscription | `/e/demo/rencontres-affaires-printemps` |
| Événements | 1 passé (COMPLETED, 60 inscrits, snapshot de facturation), 1 ouvert (85 inscrits), 1 brouillon |
| Participants | 120, répartis sur 18 secteurs et les régions du Québec |

Pour repartir de zéro : `pnpm db:reset && pnpm db:seed`.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Développement (Turbopack) / build de production / serveur |
| `pnpm lint`, `pnpm typecheck`, `pnpm format` | ESLint, TypeScript, Prettier |
| `pnpm test` | Tests unitaires et d'intégration (Vitest; l'intégration utilise `.env.test`) |
| `pnpm test:e2e` | Tests Playwright (démarre `pnpm dev` ou réutilise un serveur sur :3000) |
| `pnpm db:migrate`, `pnpm db:deploy`, `pnpm db:reset`, `pnpm db:seed`, `pnpm db:studio` | Prisma |
| `pnpm first-run [--database-url …]` | Crée `.env` (secrets générés), applique les migrations et charge la démo |
| `pnpm create-org --slug x --name "…" --owner-email … --owner-name "…"` | Crée une organisation et son compte OWNER (mot de passe temporaire affiché) |
| `pnpm billing:report --month AAAA-MM` | Rapport de facturation CSV (relevés figés du mois) |

Un hook Husky exécute `lint` + `typecheck` avant chaque commit.

### Tests

- Unitaires : `tests/unit` (normalisation, régions, dates, jetons, .ics, templates de courriel).
- Intégration : `tests/integration` contre la base `matchmaking_test` (`.env.test`) :
  isolation entre organisations, rate limiting en base. Appliquez d'abord les migrations :
  `DATABASE_URL=… DIRECT_URL=… pnpm db:deploy`.
- Bout en bout : `tests/e2e` (inscription publique en 3 étapes, espace participant, connexion
  organisateur, liste des inscrits). Requiert une base migrée et le seed. Variables lues depuis
  l'environnement (`set -a; . ./.env; set +a; pnpm test:e2e`). Pour réutiliser un Chromium
  système : `PW_CHROMIUM_PATH=/chemin/vers/chromium`.

## Structure

```
prisma/              schéma, migrations, seed
src/app/             routes (public /e, participant /p, organisateur /admin, API)
src/components/      ui/ (shadcn), shared/, public/, participant/, admin/
src/lib/             auth/, db/, email/, validation/, matching/ (semaine 2), regions, normalize, dates…
src/server/          actions/ (server actions), queries/, services/
scripts/             create-org.ts, billing-report.ts
tests/               unit/, integration/, e2e/
```

## Sécurité (résumé)

Validation Zod côté serveur partout; isolation par organisation via `src/lib/db/org-scope.ts`
(test d'intégration); jetons participants HS256 avec `tokenVersion`; mots de passe argon2id;
verrouillage progressif après 5 échecs; en-têtes de sécurité (CSP, HSTS, X-Frame-Options DENY);
rate limiting (Upstash ou table `RateLimit`); honeypot + délai minimal sur le formulaire public;
liens magiques consommés en POST seulement; aucune donnée personnelle dans les URL ni les journaux.

## Déploiement (Vercel + Supabase/Neon)

1. Créer la base (Supabase : copier l'URL « Transaction pooler » dans `DATABASE_URL` et l'URL
   directe dans `DIRECT_URL`; Neon : la même URL dans les deux).
2. Sur Vercel, importer le dépôt, définir toutes les variables de `.env.example` (production),
   `AUTH_URL` et `APP_BASE_URL` = URL finale en HTTPS.
3. Vercel utilise automatiquement `pnpm vercel-build` (migrations, démo si la base est vide et que
   `SEED_DEMO` n'est pas `false`, puis build). Les variables injectées par l'intégration Neon/Postgres de Vercel
   (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL_UNPOOLED`…) sont reconnues sans
   configuration; `APP_BASE_URL` et `AUTH_URL` sont déduites du domaine Vercel si absentes.
4. Créer l'organisation réelle : `pnpm create-org …` (avec les variables de production), puis se
   connecter et changer le mot de passe temporaire.
5. Configurer Resend (domaine vérifié) et `EMAIL_FROM`.

La procédure détaillée, la sauvegarde/restauration et la checklist de mise en service seront
complétées à la semaine 4 (voir `PLAN.md`).

## Licence

Code propriétaire — © AD Création. Tous droits réservés.
