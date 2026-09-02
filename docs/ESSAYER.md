# Essayer Jumelage

Deux façons de tester l'application avec de vraies interactions : sur votre ordinateur (10 minutes)
ou en ligne sur Vercel (20 minutes, accessible depuis n'importe quel téléphone).

Dans les deux cas, les données de démonstration sont créées automatiquement :

| Quoi | Où |
|---|---|
| Page publique d'inscription | `/e/demo/rencontres-affaires-printemps` |
| Connexion organisatrice | `/admin/login` · `owner@demo.local` / `Demo-1234!` |
| Courriels de test (liens des participants) | `/admin/courriels` (visible tant qu'aucun service d'envoi n'est configuré) |

## A. Sur votre ordinateur

### 1. Installer les outils (une seule fois)

1. **Node.js 22** : https://nodejs.org (version LTS). Vérifiez dans un terminal : `node -v`.
2. **pnpm** : dans le terminal, `corepack enable` (ou `npm install -g pnpm`). Vérifiez : `pnpm -v`.
3. **Git** : https://git-scm.com (sur Mac, `xcode-select --install` suffit).
4. **PostgreSQL**, au choix :
   - **Docker Desktop** (https://www.docker.com/products/docker-desktop) puis, dans le dossier du
     projet, `docker compose up -d` : la base est prête sur le port 5432; ou
   - **Postgres.app** sur Mac (https://postgresapp.com) / l'installateur Windows
     (https://www.postgresql.org/download/windows/) avec l'utilisateur `postgres` et le mot de passe
     `postgres`, puis créez la base `matchmaking_dev`; ou
   - **une base en ligne gratuite** (Neon : https://neon.tech) : copiez la chaîne de connexion et
     passez-la à l'étape 3 avec `--database-url`.

### 2. Récupérer le projet

```bash
git clone https://github.com/alexisdumaresq19-cloud/APP-MATCHMAKING.git
cd APP-MATCHMAKING
git checkout claude/matchmaking-networking-platform-oevm9v
pnpm install
```

### 3. Tout préparer en une commande

```bash
pnpm first-run
# ou, avec une base en ligne :
pnpm first-run --database-url "postgresql://utilisateur:motdepasse@hote/base?sslmode=require"
```

La commande crée le fichier `.env` avec des secrets générés, applique les migrations et charge la
démonstration (120 participants, 3 événements).

### 4. Lancer

```bash
pnpm dev
```

Ouvrez http://localhost:3000/e/demo/rencontres-affaires-printemps sur votre ordinateur. Pour tester
sur votre téléphone, il doit être sur le même réseau Wi-Fi : utilisez l'adresse « Network » affichée
par `pnpm dev` (ex. `http://192.168.1.20:3000/...`).

### 5. Parcours de test suggéré

1. Inscrivez-vous depuis la page publique (les trois étapes, puis le consentement).
2. Ouvrez `/admin/login`, connectez-vous, puis « Courriels (test) » dans le menu : cliquez sur le lien
   « Accéder à mon espace » du courriel de confirmation. C'est l'espace du participant.
3. Modifiez le profil, enregistrez, revenez dans l'admin : onglet « Inscrits » de l'événement.
4. Essayez « Recevoir un lien de connexion » sur la page de connexion : le lien apparaît aussi dans
   « Courriels (test) ».

Pour recevoir de vrais courriels, créez un compte Resend (https://resend.com), ajoutez
`RESEND_API_KEY="re_..."` dans `.env` et, sans domaine vérifié, `EMAIL_FROM="Jumelage <onboarding@resend.dev>"`
(Resend n'envoie alors qu'à l'adresse de votre compte). La boîte « Courriels (test) » disparaît dès
qu'un service d'envoi est configuré.

## B. En ligne (Vercel + Neon), pour tester depuis n'importe où

1. **Base de données** : créez un projet gratuit sur https://neon.tech et copiez la chaîne de
   connexion (« Connection string », avec `?sslmode=require`).
2. **Vercel** : sur https://vercel.com, « Add New… → Project », importez le dépôt GitHub
   `APP-MATCHMAKING` et choisissez la branche `claude/matchmaking-networking-platform-oevm9v`.
3. **Variables d'environnement** (section « Environment Variables » avant de déployer) :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | chaîne Neon |
   | `DIRECT_URL` | la même chaîne Neon |
   | `AUTH_SECRET` | un secret aléatoire (`openssl rand -base64 32`, ou 40 caractères au hasard) |
   | `PARTICIPANT_TOKEN_SECRET` | un autre secret aléatoire (32 caractères minimum) |
   | `AUTH_URL` | `https://VOTRE-PROJET.vercel.app` |
   | `APP_BASE_URL` | `https://VOTRE-PROJET.vercel.app` |
   | `EMAIL_FROM` | `Jumelage <no-reply@example.com>` |
   | `SEED_DEMO` | `true` (charge la démo au premier déploiement seulement) |

4. Déployez. Le script `vercel-build` applique les migrations, charge la démo si la base est vide,
   puis construit l'application. Les mêmes adresses que ci-dessus fonctionnent sur votre domaine
   Vercel, y compris « Courriels (test) » tant que `RESEND_API_KEY` n'est pas défini.

Note : le nom de projet Vercel n'est connu qu'après l'import; si vous ne le connaissez pas encore,
déployez une première fois, puis mettez à jour `AUTH_URL` et `APP_BASE_URL` et redéployez.

## Dépannage

- `pnpm : commande introuvable` → `corepack enable`, puis rouvrez le terminal.
- `Can't reach database server` → PostgreSQL n'est pas démarré (`docker compose up -d`) ou la
  chaîne de connexion dans `.env` est incorrecte.
- Le port 3000 est occupé → `pnpm dev -p 3001`.
- Repartir de zéro → `pnpm db:reset && pnpm db:seed` (efface toutes les données locales).
