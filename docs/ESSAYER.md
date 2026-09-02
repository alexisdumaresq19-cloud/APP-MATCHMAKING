# Essayer Jumelage

Deux façons de tester l'application avec de vraies interactions : en ligne sur Vercel sans rien
installer (15 minutes, accessible depuis n'importe quel téléphone), ou sur votre ordinateur (10
minutes, avec un terminal).

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
   - **une base en ligne gratuite, sans installation** (Neon : https://neon.tech) : créez un projet,
     cliquez « Connect », décochez « Connection pooling », copiez la chaîne de connexion et
     passez-la à l'étape 3 avec `--database-url`; ou
   - **Docker Desktop** (https://www.docker.com/products/docker-desktop) puis, dans le dossier du
     projet, `docker compose up -d` : la base est prête sur le port 5432; ou
   - **Postgres.app** sur Mac (https://postgresapp.com) / l'installateur Windows
     (https://www.postgresql.org/download/windows/) avec l'utilisateur `postgres` et le mot de passe
     `postgres`, puis créez la base `matchmaking_dev`.

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

## B. En ligne avec Vercel, sans rien installer (recommandé pour un premier essai)

Tout se passe dans le navigateur; aucune commande à taper.

1. **Compte Vercel** : https://vercel.com, « Sign up » avec votre compte GitHub (celui du dépôt
   `APP-MATCHMAKING`).
2. **Importer le projet** : « Add New… → Project », choisissez `APP-MATCHMAKING`. Dans les réglages
   d'import, laissez « Framework Preset : Next.js » et ne déployez pas tout de suite.
3. **Variables d'environnement** (section « Environment Variables ») : ajoutez seulement

   | Variable | Valeur |
   |---|---|
   | `AUTH_SECRET` | une phrase au hasard d'au moins 40 caractères (ex. tapez n'importe quoi de long) |
   | `PARTICIPANT_TOKEN_SECRET` | une autre phrase au hasard d'au moins 40 caractères |
   | `SEED_DEMO` | `true` (facultatif : sur une base vide, la démo se charge de toute façon; mettez `false` pour l'empêcher) |

4. **Déployer** une première fois (le build échouera avec le message « Aucune base de données » :
   c'est normal, il manque l'étape suivante).
5. **Base de données** : dans le projet, onglet **Storage → Create Database → Neon (Postgres)**,
   plan gratuit, région la plus proche (Ohio ou Virginie). Cliquez « Connect » pour lier la base au
   projet : Vercel ajoute lui-même les variables de connexion.
6. **Redéployer** : onglet « Deployments → … → Redeploy ». Le build applique les migrations, charge
   la démonstration (120 participants) et construit l'application. Comptez 2 à 3 minutes.
7. Ouvrez l'adresse du projet (`https://votre-projet.vercel.app`) :
   - `/e/demo/rencontres-affaires-printemps` pour vous inscrire depuis n'importe quel téléphone;
   - `/admin/login` (`owner@demo.local` / `Demo-1234!`), puis « Courriels (test) » pour cliquer sur
     les liens des participants.

Chaque fois que le code est mis à jour sur la branche, Vercel redéploie automatiquement.

Si vous préférez créer la base vous-même sur https://neon.tech, ajoutez `DATABASE_URL` (chaîne
« pooled ») et `DIRECT_URL` (chaîne « direct », pooling désactivé) aux variables de l'étape 3.

## Dépannage

- `pnpm : commande introuvable` → `corepack enable`, puis rouvrez le terminal.
- `Can't reach database server` → PostgreSQL n'est pas démarré (`docker compose up -d`) ou la
  chaîne de connexion dans `.env` est incorrecte.
- Le port 3000 est occupé → `pnpm dev -p 3001`.
- Repartir de zéro → `pnpm db:reset && pnpm db:seed` (efface toutes les données locales).

## Semaine 3 : des tables au jour J

1. **Tables** (onglet de l'événement) : ouvrez « Configuration » pour fixer tables, places, rondes et
   noms, puis « Placer automatiquement ». Glissez une personne vers une autre table pour corriger :
   la place se verrouille (cadenas) et le placement automatique ne la touchera plus. « Excel »
   donne une feuille par ronde; « Imprimer » ouvre une page par table (choisissez « Enregistrer en
   PDF » dans la boîte d'impression).
2. **Publication** : l'aperçu montre le courriel tel que chaque participant le recevra. « Publier les
   jumelages » ferme les inscriptions et envoie les courriels par lots de 20 avec une barre de
   progression; relancer plus tard n'écrit qu'aux inscrits dont les jumelages ou la table ont
   changé. « Envoyer un rappel » la veille, « Demander les consentements » pour les inscrits
   importés ou ajoutés à la main. En mode test, tout se retrouve dans « Courriels (test) ».
3. **Espace participant** : le lien personnel (dans le courriel) ouvre « Ma table » (gros chiffres,
   par ronde) et « Mes jumelages » (cartes avec les raisons en français). Les coordonnées d'un
   jumelage n'apparaissent qu'une fois les deux personnes arrivées.
4. **Jour J** : recherche instantanée, bouton « Présent », « Ajouter sur place » pour les arrivées
   surprises, « Plein écran (tablette) » pour l'accueil. « Terminer l'événement » marque les absents,
   fige le relevé de facturation et passe l'événement à « Terminé ». Le rapport mensuel :
   `pnpm billing:report --month AAAA-MM`.
