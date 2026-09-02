# Références de design (Mobbin)

Benchmark réalisé le 2 septembre 2026 pour guider l'interface de la Phase 1. Chaque écran est
lié à sa fiche Mobbin. Verdict en tête, détails par écran ensuite.

## Verdict

- **Référence principale : Luma** (page d'événement mobile, onglet « Guests » et mode check-in
  web). C'est le produit le plus proche du nôtre : événements, inscrits, statuts, check-in,
  interface sobre et lisible qui se transpose bien en français et en shadcn/ui.
- **StubHub (idée initiale) : à retenir pour deux écrans seulement.** Le résumé de billet
  (« Your tickets » avec la carte de l'événement et « Your seats & view ») est un très bon modèle
  pour la carte « Ma table » du participant, et l'en-tête d'événement (date, lieu, badge de
  demande) inspire notre « Il reste N places ». Le reste de StubHub est une interface de
  marketplace (prix, frais, compte à rebours, ventes incitatives) qui ne correspond pas à un
  outil de réseautage où la valeur, ce sont les personnes.
- **LinkedIn « People you may know »** pour les cartes de jumelage : nom, entreprise, une ligne
  « Pourquoi » sous chaque personne, un seul bouton d'action.

## Par écran de notre application

### Page publique d'événement (`/e/[org]/[event]`)
- [Luma — page d'événement](https://mobbin.com/screens/b7f76ef3-edb6-4a19-9e8c-ca2e5bb48dcf) :
  titre, date, hôte, carte du lieu, bouton « Register » fixe en bas. À reprendre : le bouton
  d'inscription toujours visible sur mobile, la carte cliquable vers Google Maps.
- [Luma — actions Invite / Check In](https://mobbin.com/screens/d3262a48-7d1a-44d0-857f-b02d797df3c6) :
  rangée de tuiles d'action sous le titre (utile côté participant : « Calendrier », « Itinéraire »).
- [StubHub — en-tête d'événement](https://mobbin.com/screens/30cada07-7c59-47e6-8ad6-3f5e35dd9506) :
  hiérarchie titre / date / lieu et badge « High demand » → notre badge « Il reste N places ».

### Formulaire d'inscription en 3 étapes
- Modèle « une question par écran, barre de progression fine en haut, un seul bouton principal en
  bas », visible dans les flux d'onboarding
  [Wanderlog](https://mobbin.com/flows/43df4d6b-29ef-484e-98bc-2164e5c193b7) et
  [Evernote](https://mobbin.com/flows/4f4d734f-364e-4506-917e-6a5a17fbadff).
  Notre formulaire suit déjà ce modèle; améliorations possibles : barre de progression collée
  au haut de l'écran et bouton « Continuer » fixé au bas sur mobile.

### Mes jumelages (participant) et vue par participant (admin)
- [LinkedIn — People you may know](https://mobbin.com/screens/a31da39a-e466-4193-a524-0ad3f0b7dd7c) :
  grille de cartes avec nom, titre, une ligne de justification (« Based on your profile ») et un
  bouton. À reprendre : la ligne de justification devient nos 2-3 phrases « Pourquoi ce
  jumelage »; côté admin, le bouton devient « Épingler » / « Exclure ».
- [Hinge — carte avec « prompts »](https://mobbin.com/screens/980caf25-0925-4bb5-ac4f-6f919a61a6dd) :
  blocs « question + réponse » très lisibles. À reprendre pour présenter « Ce qu'ils offrent »,
  « Ce qu'ils cherchent » et « Pourquoi vous » comme trois blocs distincts, sans photo.

### Ma table (participant)
- [StubHub — Your tickets](https://mobbin.com/screens/633c5a06-a0f6-40f1-913c-53e9e6ac65a7) et
  [StubHub — résumé de billet](https://mobbin.com/screens/84fe7b00-09bb-493b-8333-49ba2e9e897b) :
  carte d'événement en haut, puis bloc « Section / Row / Seats » en gros caractères. Transposé :
  « Table 4 · Ronde 1 · 18 h 00 », une ligne par ronde, numéro de table très grand, lisible
  debout dans une salle bruyante.

### Onglet Inscrits (admin)
- [Luma — onglet Guests](https://mobbin.com/screens/77625847-95c6-46b2-b900-1b8647c84ed4) :
  bloc « At a glance » (inscrits / capacité avec barre), tuiles d'action (Inviter, Check-in,
  Liste), puis liste filtrable avec pastilles de statut. À ajouter chez nous : la barre de capacité
  et les tuiles d'action en tête de l'onglet.
- [Posh — table des participants](https://mobbin.com/screens/8e7eb4eb-8f17-4a13-a487-05852bae353c) :
  recherche pleine largeur, boutons Filtre / Étiquette à droite, pastilles dans la colonne
  « Tags ». Notre tableau actuel est déjà aligné sur ce modèle.

### Onglet Tables (admin)
- Aucune référence directe de plan de tables sur Mobbin. Le modèle le plus proche est le tableau
  kanban ([Slack Lists](https://mobbin.com/screens/fd9a81ad-6a72-4916-8eed-5092bd02ad17),
  [Trello](https://mobbin.com/screens/9304c5b2-1fa8-41c9-ad48-5a646b0d6731)) : une colonne par
  table, une carte par participant (nom, entreprise, pastille de secteur, cadenas), colonne
  « Non placés » à droite, indicateurs de places libres et de conflits dans l'en-tête de colonne.

### Jour J (admin, tablette)
- [Luma — fiche de check-in](https://mobbin.com/screens/a68e7be6-6516-485e-9779-5dda7d08a8f1) :
  nom, statut, entreprise, réponses d'inscription, gros bouton vert « Check In ».
- [Luma — confirmation « Checked in »](https://mobbin.com/screens/fc3826ca-0719-4e8f-a59e-c7c0c798641a) :
  toast de confirmation et compteur « Checked in / Going » avec barre de progression. À reprendre
  tel quel pour le mode plein écran.
- [Luma — code QR du participant](https://mobbin.com/screens/46e06266-500a-471c-812c-18cbecdd98f5) :
  un QR par participant pour un check-in par lecture est une idée pour la Phase 2
  (noté dans `IDEES_PHASE2.md`).

## Principes retenus

1. Une seule action principale par écran, fixée au bas sur mobile.
2. Justifier chaque jumelage en une ou deux phrases, jamais avec un score.
3. Gros chiffres pour ce qui se lit debout (numéro de table, heure de la ronde, compteur du jour J).
4. Pastilles de statut cohérentes partout (mêmes libellés côté admin et côté participant).
5. Pas d'éléments de marketplace (prix, compte à rebours, ventes incitatives).

## Icônes animées (règles d'usage)

Librairie : [`@animated-color-icons/lucide-react`](https://github.com/gorkem-bwl/animated-icons)
(icônes Lucide, animations CSS, bicolores selon la marque de l'organisation). Composant :
`src/components/ui/animated-icon.tsx` (`<AnimatedIcon name="sparkles" play />`), registre des noms
dans le même fichier. Feuille de style : `src/styles/animated-icons.css`.

- **Une seule animation « au chargement » par écran** (`play`) : l'icône du titre, de l'état vide
  ou de la page « Merci ». Le reste s'anime **au survol** de sa carte ou de son bouton (classe
  `al-group` sur le parent), jamais en boucle, sauf un état de chargement (`loop`).
- **Toujours un sens** : l'icône illustre le contenu (jumelage → poignée de main, courriel →
  enveloppe, table → fauteuil). Pas d'icône décorative sans lien avec le texte.
- **Accessibilité** : `prefers-reduced-motion` désactive toutes les animations; les icônes sont
  `aria-hidden` sauf si un `title` leur est donné.
- Composants prêts : `EmptyState` (icône + titre + explication + action) et `StatCard` (chiffre clé
  avec icône) dans `src/components/shared/`.
