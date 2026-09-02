# Guide de l'organisatrice

Ce guide décrit, dans l'ordre d'un événement, tout ce que vous pouvez faire dans **Jumelage**.
Il s'adresse à la personne qui organise les rencontres de réseautage et à son équipe.

## 1. Se connecter

- Adresse : `https://votre-domaine/admin/login`.
- Deux façons d'entrer : **mot de passe** ou **lien magique** (un courriel avec un lien valable
  15 minutes). Après 5 mots de passe erronés, le compte se verrouille progressivement.
- Mot de passe oublié : « Mot de passe oublié? » sous le formulaire.
- Deux rôles : **Propriétaire** (tout, y compris les réglages et les comptes) et **Équipe** (les
  événements, les inscrits, le jour J; les réglages en lecture seule).

## 2. Préparer l'organisation (une fois)

Menu **Réglages** :

| Onglet | À faire |
| --- | --- |
| **Organisation** | Nom, nom de la plateforme (affiché aux participants), courriel du responsable de la confidentialité, courriel de réponse, fuseau horaire, deux couleurs avec aperçu en direct, logo (PNG, JPEG ou WebP, 2 Mo max). |
| **Secteurs** | La liste des secteurs proposée à l'inscription. Réordonnez, renommez, désactivez. |
| **Affinités** | La matrice « qui a intérêt à rencontrer qui », de 0 à 100. Elle guide le jumelage. |
| **Règles** | Les poids du jumelage (complémentarité, affinité, région…) et le nombre de rencontres par personne. Les valeurs par défaut conviennent à la plupart des événements. |
| **Consentement** | L'avis de collecte de renseignements personnels (Loi 25). Chaque version est conservée; adopter un nouveau texte oblige les participants à l'accepter de nouveau avant d'être jumelés. |
| **Comptes** | Invitez votre équipe par courriel (lien valable 7 jours). Changez un rôle, désactivez une personne. Il reste toujours au moins un propriétaire actif. |
| **Facturation** | Lecture seule : le relevé figé de chaque événement terminé (inscrits, présents, no-shows, ajouts sur place). |

## 3. Créer l'événement

**Événements › Nouvel événement** : nom, date et heure, lieu, capacité, nombre de tables, places
par table, nombre de tours et durée d'un tour, rencontres souhaitées par personne.

L'événement naît en **Brouillon**. Passez-le à **Ouvert** pour que la page publique accepte les
inscriptions. Le bouton **QR** de l'onglet Détails donne une affiche à imprimer.

## 4. Les inscriptions

- La page publique `/<organisation>/<événement>` : le participant remplit son profil (offres,
  besoins, « Avec qui voulez-vous collaborer? »), accepte l'avis de confidentialité et reçoit un
  courriel de confirmation avec son **lien personnel**.
- **Onglet Inscrits** : recherche, filtres par statut, ajout manuel, **import CSV** (modèle
  fourni, aperçu avant import, doublons détectés), renvoi du lien personnel, notes internes.
- Le participant garde son profil à jour lui-même depuis son lien personnel (« Mon profil »).

## 5. Le jumelage

**Onglet Jumelage** : « Calculer les jumelages » propose, pour chaque inscrit, les meilleures
rencontres, avec les raisons en français (« Elle offre ce que vous cherchez : … »).

- **Épingler** une paire pour la garder à tout prix; **exclure** une paire à ne jamais proposer.
- Recalculer autant de fois que vous voulez : les paires épinglées et exclues sont respectées.
- Les inscrits sans consentement à jour ne sont pas jumelés; l'onglet Publication permet de leur
  redemander leur accord en un clic.

## 6. Les tables

**Onglet Tables** : le placement automatique répartit les gens par tour pour maximiser les
rencontres jumelées à la même table. Glissez-déposez pour ajuster; un cadenas fige une place.
**Imprimer** ouvre la feuille de placement sans menu (Enregistrer en PDF).

## 7. Publier

**Onglet Publication** : « Publier » envoie à chaque inscrit son courriel de jumelages (partenaires,
raisons, table par tour, fichier calendrier). Les envois partent par lots de 20 avec une barre de
progression; relancer n'envoie que ce qui manque. Une republication après un changement n'écrit
qu'aux personnes concernées. Le **rappel** (la veille) s'envoie de la même façon.

Sans fournisseur de courriel configuré, les messages apparaissent dans **Courriels** (boîte de
test) au lieu de partir.

## 8. Le jour J

**Onglet Jour J** : liste des inscrits avec recherche, **Arrivé** en un tap, ajout d'une personne
sur place (elle reçoit tout de suite ses jumelages si les places le permettent). Le **mode plein
écran** est prévu pour une tablette à l'accueil.

À la fin : **Terminer l'événement**. Les absents passent en no-show et le **relevé de facturation**
est figé. Il ne changera plus.

## 9. Les participants, après l'événement

- **Participants** : l'annuaire de toutes les personnes, tous événements confondus, avec fiche
  (profil, inscriptions, jumelages, consentements) et export JSON.
- **Demandes de suppression** : la file des demandes faites par les participants depuis
  « Mes données ». Vous avez 30 jours pour répondre (voir `docs/LOI25.md`). « Anonymiser » efface
  la personne mais conserve le décompte pour la facturation; « Refuser » exige un motif, conservé.

## 10. Questions fréquentes

**Un participant n'a pas reçu son lien.** Onglet Inscrits › sa ligne › « Renvoyer le lien ». Vérifiez
aussi la boîte **Courriels** si aucun fournisseur n'est configuré.

**Je veux changer l'avis de confidentialité.** Réglages › Consentement, puis Publication ›
« Demander le consentement » pour les personnes concernées.

**Quelqu'un a quitté l'équipe.** Réglages › Comptes › Désactiver : la personne est déconnectée
partout immédiatement.

**Puis-je modifier un événement terminé?** Non : les statuts et le relevé de facturation sont figés.
Dupliquez-le pour la prochaine édition.

**Où sont mes données?** Dans une base PostgreSQL hébergée (Neon ou Supabase) au Canada ou aux
États-Unis selon la région choisie; voir la section Sauvegarde du `README.md`.
