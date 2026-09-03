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

## Déploiement (Vercel + Neon) pas à pas

L'application tourne en production sur Vercel avec une base PostgreSQL Neon; Supabase fonctionne
aussi (mêmes étapes, URL « Transaction pooler » dans `DATABASE_URL` et URL directe dans
`DIRECT_URL`).

1. **Base de données** — Sur [neon.tech](https://neon.tech), créer un projet (région la plus
   proche : `us-east`). Copier la chaîne de connexion. Avec Neon, la même URL sert pour
   `DATABASE_URL` et `DIRECT_URL`.
2. **Vercel** — Importer le dépôt GitHub. Dans *Settings › Environment Variables* (Production),
   définir :
   - `DATABASE_URL`, `DIRECT_URL` (ou installer l'intégration Neon, dont les variables sont
     reconnues automatiquement);
   - `AUTH_SECRET` et `PARTICIPANT_TOKEN_SECRET` (`openssl rand -base64 32`, deux valeurs
     différentes);
   - `AUTH_URL` et `APP_BASE_URL` = l'URL finale en HTTPS (déduites du domaine Vercel si absentes);
   - `RESEND_API_KEY` et `EMAIL_FROM` (voir l'étape 5), `SEED_DEMO=false` pour une base réelle.
3. **Build** — Vercel exécute `pnpm vercel-build` : migrations Prisma, démonstration si la base est
   vide et `SEED_DEMO` n'est pas `false`, puis `next build`. Chaque `git push` redéploie.
4. **Organisation réelle** — Depuis votre poste, avec les variables de production dans `.env` :

   ```bash
   pnpm create-org --slug allyson --name "Nom de l'organisation" \
     --owner-email proprietaire@exemple.com --owner-name "Prénom Nom" \
     --privacy-email confidentialite@exemple.com
   ```

   Le script affiche un mot de passe temporaire; se connecter sur `/admin/login`, le changer, puis
   inviter l'équipe (Réglages › Comptes). Retirer la démonstration : `pnpm remove-demo --yes`.
5. **Courriels** — Sur [resend.com](https://resend.com), vérifier votre domaine (enregistrements DNS
   fournis), créer une clé d'API, puis `EMAIL_FROM="Jumelage <no-reply@votre-domaine>"`. Sans
   domaine vérifié, `onboarding@resend.dev` n'écrit qu'à votre propre adresse.
6. **Domaine** — Vercel › *Domains* : ajouter le domaine, suivre les instructions DNS; HTTPS est
   automatique. Mettre `AUTH_URL` et `APP_BASE_URL` à jour, puis redéployer.
7. **Tâche planifiée** — définir `CRON_SECRET` (`openssl rand -base64 32`) dans les variables
   Vercel : `vercel.json` déclare la purge hebdomadaire des profils inactifs (`/api/cron/retention`,
   lundi 9 h UTC, D-39). Sans le secret, la route refuse de s'exécuter. À la main : `pnpm retention`.

## Sauvegarde et restauration

Neon conserve un historique point-dans-le-temps (7 jours en formule gratuite, plus en payant) et
Supabase des sauvegardes quotidiennes. Pour une copie que vous contrôlez :

```bash
# Sauvegarde complète (schéma + données, logo inclus) — à programmer chaque semaine
pg_dump "$DIRECT_URL" --format=custom --file="jumelage-$(date +%F).dump"

# Restauration dans une base vide
pg_restore --clean --if-exists --no-owner --dbname "$DIRECT_URL" jumelage-2026-09-02.dump
```

Après une restauration, exécuter `pnpm db:deploy` pour appliquer les migrations manquantes.
Gardez les fichiers `.dump` chiffrés (ils contiennent des renseignements personnels) et supprimez
ceux de plus de 12 mois.

## Checklist de mise en service

- [ ] `AUTH_SECRET` et `PARTICIPANT_TOKEN_SECRET` distincts, générés pour la production
- [ ] `SEED_DEMO=false` et `pnpm remove-demo --yes` exécuté (plus d'organisation « demo »)
- [ ] Organisation réelle créée, mot de passe temporaire changé, équipe invitée
- [ ] Domaine Resend vérifié, courriel de test reçu (Réglages › Comptes › Renvoyer l'invitation)
- [ ] Réglages › Organisation : logo, couleurs, courriel du responsable de la confidentialité
- [ ] Réglages › Consentement : texte relu et adopté (voir `docs/LOI25.md`)
- [ ] Domaine final en HTTPS; `AUTH_URL` et `APP_BASE_URL` à jour
- [ ] `CRON_SECRET` défini (purge automatique des profils inactifs)
- [ ] Première sauvegarde `pg_dump` faite et rangée
- [ ] Un événement de test créé, une inscription faite, le courriel reçu, puis l'événement archivé

## FAQ

**Les courriels n'arrivent pas.** Sans `RESEND_API_KEY` ni `SMTP_*`, rien ne part : les messages
sont visibles dans `/admin/courriels`. Avec Resend, vérifiez le domaine et `EMAIL_FROM`.

**« Lien expiré » pour un participant.** Onglet Inscrits › « Renvoyer le lien ». Les liens sont
révoqués quand le profil est anonymisé ou que `PARTICIPANT_TOKEN_SECRET` change.

**Plus aucun propriétaire ne peut se connecter.** `pnpm create-org` ne sert qu'aux nouvelles
organisations; pour réinitialiser un mot de passe, utilisez « Mot de passe oublié » (courriels
requis) ou, en dernier recours, mettez `passwordHash` à `NULL` en base et renvoyez une invitation
depuis un autre compte propriétaire.

**Changer de fournisseur de base.** `pg_dump` chez l'ancien, `pg_restore` chez le nouveau, mettre
`DATABASE_URL`/`DIRECT_URL` à jour, redéployer.

**Où est le guide d'utilisation?** `docs/GUIDE_ORGANISATRICE.md`; le fonctionnement du jumelage
est dans `docs/MATCHING.md`; la conformité Loi 25 dans `docs/LOI25.md`.

## Licence

Code propriétaire — © AD Création. Tous droits réservés.
