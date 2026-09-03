# Plan — Phase 2

Phase 1 est en production (quatre semaines, voir `PLAN.md`). La Phase 2 reprend, dans l'ordre
de valeur pour l'Organisatrice et les entreprises, ce qui avait été mis de côté
(`IDEES_PHASE2.md`, `docs/LIGNE_DIRECTRICE.md`). Même méthode : incréments qui compilent, tests à
chaque étape, français partout dans l'interface, décisions consignées dans `DECISIONS.md`.

## Ce que la Phase 2 change pour une entreprise

Aujourd'hui, une entreprise existe seulement à travers un lien personnel reçu par courriel. En
Phase 2, elle a **une présence** : une fiche publique si elle le souhaite, un moyen de retrouver
son accès, un carnet de contacts, une messagerie avec les entreprises rencontrées, et des
événements payants réservables sans quitter la plateforme.

## Jalons

| Jalon | Contenu | Prérequis côté cliente |
| --- | --- | --- |
| **P2-S1 — Présence des entreprises** | Connexion par courriel (« Mon accès »), annuaire public des entreprises inscrites (opt-in, recherche par secteur, région et mots-clés), fiche publique, export CSV de l'annuaire admin, navigation publique (Événements · Entreprises · Mon accès). | Aucun |
| **P2-S2 — Contacts et messagerie** | « Ajouter à mes contacts » depuis les jumelages et l'annuaire, page « Mes contacts » avec export; messagerie interne entre entreprises (fil par paire, notification courriel, blocage), bouton « Message » sur la fiche d'une entreprise inscrite, comme le demande la ligne directrice. | Aucun |
| **P2-S3 — Apprentissage et exploitation** | Sondage post-événement (« Avez-vous conclu une affaire? »), statistiques d'acceptation par paire de secteurs avec suggestions d'ajustement de la matrice (filtrage collaboratif simple), purge automatique des profils inactifs (24 mois, préavis), Lighthouse en CI, double authentification (TOTP) pour les propriétaires, Sentry optionnel. | Compte Sentry si souhaité |
| **P2-S4 — Monétisation et données externes** | Mise en avant payante dans l'annuaire (`is_premium`) via Stripe Checkout, billets payés dans la plateforme (Stripe), import Google Places des entreprises non inscrites avec tri « premium puis distance » et géolocalisation. | Compte Stripe (qui encaisse?), clé et facturation Google Maps Platform, tarif de la mise en avant |

P2-S1 et P2-S2 se livrent sans rien demander à personne. P2-S4 attend trois décisions de la cliente
(compte Stripe, clé Google, prix) : le code est prêt à les recevoir par variables d'environnement.

## Règles qui ne changent pas

- Loi 25 : tout ce qui rend une entreprise visible ou joignable est **opt-in**, explicite,
  révocable en un clic, et journalisé (`docs/LOI25.md`).
- Aucune coordonnée personnelle (courriel, téléphone) n'est montrée à une autre entreprise : la
  messagerie interne remplace l'échange d'adresses.
- Les courriels sortants restent traçables (`EmailLog`) et limités en débit.
- Le jumelage reste déterministe et révisable par l'Organisatrice.

## Hors Phase 2

Application native iOS/Android (la version web installable couvre le besoin), multi-langue,
intégration comptable, tarification par abonnement pour d'autres organisations (le modèle
multi-organisation est prêt, la vente est une décision d'affaires).
