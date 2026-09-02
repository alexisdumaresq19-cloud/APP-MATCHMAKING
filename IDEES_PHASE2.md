# IDEES_PHASE2.md — Idées hors portée (à ne pas construire en Phase 1)

- Mise à niveau Next.js 16 (Turbopack build, `proxy.ts`) et Prisma 7 (générateur `prisma-client`, adaptateur `@prisma/adapter-pg`).
- CSP stricte par nonce (middleware) au lieu de `'unsafe-inline'`.
- Fusion de doublons de participants (même personne, deux courriels).
- Liste d'attente quand la capacité est atteinte.
- Vue matrice (heatmap secteur × secteur des scores moyens) dans l'onglet Matching, si non livrée en semaine 2.
- Sélection d'organisation à la connexion quand un même courriel est organisateur dans plusieurs organisations (Phase 1 : première organisation active dont le mot de passe correspond).
- Rétention automatique des données (purge après N mois d'inactivité), avec avis préalable.
- Sous-domaines personnalisés par organisation et thèmes complets (marque blanche avancée).
- Interface super-admin AD Création (liste des organisations, compteurs, activation).
- Paiement des billets, billetterie, CRM, infolettre, comptabilité.
- Messagerie entre participants; carte géographique; application native.
- Génération de PDF vectoriel (`@react-pdf/renderer`) si la page HTML imprimable ne suffit pas.
- Invitations « amenez un partenaire » : un participant recommande une entreprise complémentaire.
- Sondage post-événement (« Avez-vous conclu une affaire ? ») pour mesurer la valeur des jumelages et ajuster la matrice d'affinité.
- Check-in par lecture d'un code QR personnel (affiché dans l'espace participant), à la façon de Luma.

## Issues de la ligne directrice de la cliente (septembre 2026)

Retenu en Phase 1 : « Avec qui aimeriez-vous collaborer? » avec secteurs pré-cochés (D-26). Le reste :

- Annuaire géolocalisé des entreprises de la région importées de Google Places (`is_registered`), avec tri « premium d'abord puis distance » (`is_premium`, payant).
- Messagerie directe entre entreprises inscrites; bouton « Message » conditionnel à l'inscription des deux parties.
- Carnet d'adresses personnel (« Ajouter à mes contacts ») après un jumelage.
- Paiement intégré des billets (Stripe). Livré en Phase 1 : lien de billetterie externe (« Acheter mon billet ») et ajout au calendrier (`.ics` Apple/Outlook + Google Agenda) sur la page publique et dans l'espace participant.
- Filtrage collaboratif : apprendre des acceptations (ex. 80 % des garderies acceptent les traiteurs) pour ajuster automatiquement les suggestions et la matrice d'affinité.
- Score « 70 % étiquettes / 30 % distance » avec géolocalisation (latitude/longitude) plutôt que la région administrative.

## Après la semaine 4 (septembre 2026)

- Sentry (ou équivalent) branché sur `SENTRY_DSN` pour les erreurs serveur et client; pour l'instant, journaux pino sur Vercel.
- Mesure Lighthouse automatisée (Lighthouse CI dans GitHub Actions) sur la page publique du domaine final; objectif ≥ 90 mobile.
- Purge automatique des profils inactifs (ex. 24 mois après le dernier événement), avec préavis par courriel.
- Stockage externe (Vercel Blob ou Supabase Storage) si la cliente veut des images plus lourdes qu'un logo (bannières d'événement).
- Double authentification (TOTP) pour les comptes propriétaires.
- Export de l'annuaire complet en CSV (avec filtre) depuis `/admin/participants`.
- Registre des incidents de confidentialité tenu dans l'application plutôt qu'à côté.
