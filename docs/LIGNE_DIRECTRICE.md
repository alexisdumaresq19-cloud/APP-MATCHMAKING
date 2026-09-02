# Ligne directrice de la cliente — vérification point par point

Document de référence : « Copie de Matchmaking » (septembre 2026), rédigé par l'Organisatrice avec
l'aide d'un assistant. Ce tableau reprend chaque demande dans l'ordre du document et indique ce
qui est livré en Phase 1, où le trouver, et ce qui est planifié en Phase 2 (`IDEES_PHASE2.md`).

Légende : ✅ livré · 🟡 livré autrement (même résultat, mécanisme différent) · ⏭️ Phase 2

## Ses mots à elle (le cœur de la demande)

| Demande | État | Où / comment |
| --- | --- | --- |
| « Je ne veux pas pour les match que les entreprises doivent écrire ce qu'ils recherchent » | ✅ | Le champ « Ce que vous cherchez » est facultatif; il suffit de cocher des secteurs (`needsOrSectors` dans `src/lib/validation/registration.ts`). |
| « Mettre à l'inscription une liste de services qu'ils pourront cocher, à savoir les types d'entreprise avec lesquels ils sont ouverts à collaborer » | ✅ | Étape « Avec qui aimeriez-vous collaborer? » du formulaire public et de « Mon profil » (`SectorChecklist`). |
| « Je veux aussi que l'application réfléchisse seule, exemple une garderie connecte avec entretien ménager et animateur » | ✅ | Les secteurs sont pré-cochés d'après la matrice d'affinité (≥ 65, 5 max). Garderie → Ressources éducatives, Entretien ménager, Animation et loisirs, Restauration et traiteur, RH et formation. Le jumelage utilise aussi la matrice (poids « affinité »). |

## Section 1 — Annuaire géolocalisé et profils

| Demande | État | Où / comment |
| --- | --- | --- |
| Entreprises de la région importées de Google (sans inscription) | ⏭️ | Import Google Places : coût par requête, conditions d'utilisation de Google et géolocalisation à concevoir. Phase 2. |
| Tri payant `is_premium` puis distance | ⏭️ | Dépend de l'annuaire public et d'un paiement. Phase 2. |
| Bouton « Message direct » si l'entreprise est inscrite | ⏭️ | Messagerie entre entreprises : Phase 2 (consentement à partager les coordonnées à prévoir, voir `docs/LOI25.md`). |
| Profils : nom, logo, adresse, secteur, mots-clés, description | 🟡 | Profil participant : nom, entreprise, poste, secteur, ville, région, site web, offres, besoins, secteurs recherchés, description (300 caractères). Pas de logo par entreprise ni de latitude/longitude en Phase 1 (région administrative à la place). |
| Annuaire consultable | 🟡 | Annuaire interne `/admin/participants` (recherche, filtre par secteur, fiche complète) pour l'organisation; pas d'annuaire public des entreprises en Phase 1. Les entreprises ont toutefois une vitrine publique des événements (`/<organisation>`) et, dans leur espace, la liste des événements ouverts avec inscription en un clic. |

## Section 2 — Algorithme de matchmaking

| Demande | État | Où / comment |
| --- | --- | --- |
| Croisement Offre/Besoin par mots-clés et tags | ✅ | Étiquettes « ce que nous offrons » / « ce que nous cherchons », appariées avec tolérance aux fautes (`src/lib/matching/similarity.ts`). |
| Score de compatibilité (70 % tags, 30 % proximité) | 🟡 | Score pondéré ajustable dans Réglages › Règles : complémentarité 40, affinité de secteurs 30, région 15, nouveauté 15 par défaut. La proximité utilise la région administrative et ses voisines (annexe B), pas la distance GPS. Mettez complémentarité 70 / région 30 pour reproduire exactement la formule du document. |
| Matrice des connexions logiques (secteur A → secteurs B, C, D) | ✅ | Réglages › Affinités (matrice 0–100). Défauts couvrant ses exemples : garderie → entretien ménager, animation et loisirs, traiteur, formateurs (RH et formation), ressources éducatives; restaurant → producteurs locaux, livraison (transport), agences marketing, entretien d'équipements; cabinet d'avocats → comptables, sécurité informatique (technologies), secrétariat/traduction (services administratifs). |
| Inscription en deux étapes : « Qui êtes-vous? » puis « Avec qui voulez-vous collaborer? » avec liste pré-cochée et message « Nous avons pré-sélectionné… souhaitez-vous ajouter d'autres secteurs? » | ✅ | Même parcours; le message nomme les secteurs pré-cochés : « Nous avons pré-coché pour vous : … Souhaitez-vous ajouter d'autres secteurs? ». Les autres secteurs se déplient en un clic. |
| Validation du match « si le secteur de B est dans la liste de A ET/OU si le secteur de A est dans la liste de B » | ✅ | Règle appliquée telle quelle dans le score : les deux sens = 100, un sens = 70; les étiquettes ne peuvent pas faire baisser ce résultat (D-34, `src/lib/matching/score.ts`, test unitaire). Les raisons affichées le disent en français : « Vous souhaitiez rencontrer le secteur « … » » / « Ils cherchaient justement des entreprises de votre secteur. » |
| L'algorithme tourne « chaque fois qu'une entreprise se connecte » | 🟡 | Le jumelage se calcule par événement, à la demande de l'organisatrice (bouton « Calculer les jumelages »), pour rester déterministe, révisable (épingler/exclure) et publié une seule fois. |
| Actions post-match : « Ajouter au carnet d'adresses » | ⏭️ | Phase 2 : suppose de partager les coordonnées entre participants (consentement à prévoir). En Phase 1, les partenaires, leurs entreprises et les raisons sont dans l'espace participant et le courriel de jumelages. |
| Actions post-match : « Envoyer un message » | ⏭️ | Messagerie : Phase 2. |
| Évolution : filtrage collaboratif (« 80 % des garderies acceptent… ») | ⏭️ | Phase 2; nécessite un historique d'acceptations. La matrice se règle déjà à la main d'après ce que vous observez. |

## Section 3 — Événements en présentiel

| Demande | État | Où / comment |
| --- | --- | --- |
| Ajout au calendrier (.ics, Google Calendar, Apple Calendar) | ✅ | Page publique et espace participant : « Ajouter à mon calendrier » (.ics pour Apple, Outlook…) et « Google Agenda ». Le courriel de confirmation d'inscription offre les deux mêmes liens. |
| Achat de billets (Stripe) ou redirection vers Eventbrite | 🟡 | Champ « Lien de billetterie » sur l'événement → bouton « Acheter mon billet » sur la page publique et dans l'espace participant (Eventbrite, Zeffy…). Paiement intégré Stripe : Phase 2. |
| Liste des participants inscrits | ✅ | Onglet Inscrits (recherche, filtres, import CSV, export CSV). |
| Faire connaître les événements aux entreprises | ✅ | Vitrine publique `/<organisation>` (tous les événements à venir, « S'inscrire », calendrier), « Autres événements ouverts » dans l'espace participant, et « Inviter les participants passés » (courriel avec inscription en un clic, désabonnement en un clic). |

## Choix technologiques

| Demande | État | Où / comment |
| --- | --- | --- |
| Base relationnelle (PostgreSQL) | ✅ | PostgreSQL (Neon) avec Prisma. |
| Application mobile iOS/Android (React Native, Flutter) | 🟡 | Application web « mobile d'abord », installable sur l'écran d'accueil (manifeste PWA). Une application native est hors Phase 1. |
| Backend Node.js pour l'algorithme | ✅ | Next.js (Node) : l'algorithme est en TypeScript pur, testé unitairement. |

## Ce qu'il faut retenir

Tout ce que la cliente décrit avec ses propres mots (cocher au lieu d'écrire, pré-sélection
intelligente, matrice par secteur, règle « ET/OU ») est livré et testé. Les trois grands blocs
laissés en Phase 2 sont des produits en soi : l'annuaire public avec Google Places et tri payant,
la messagerie et le carnet d'adresses, le paiement intégré. Chacun a des implications de coût
(API Google, frais Stripe) et de confidentialité (partage de coordonnées) qui méritent une décision
explicite avant de commencer.
