# Besoins et écarts API côté Flutter

Référence côté client : `api/openapi.yaml`. Les exemples ci-dessous reprennent les schémas publiés ; ils ne définissent pas de nouveaux champs.

## Inscription : contrat documenté non implémenté dans le serveur actuel

OpenAPI décrit `POST /api/auth/register` avec `fullName` obligatoire, `email`, `password` (8 à 128 caractères) et `universityId` facultatif. L’université doit être active. La réponse `201` est `{ "user": { "id", "fullName", "email", "role": "USER", "universityId" }, "accessToken", "refreshToken" }`. Une université omise est rendue `null` dans l’utilisateur.

Or, le serveur actuellement monté valide et persiste seulement `email` et `password` ; le modèle `User` n’a pas de champ `fullName` et le sérialiseur d’authentification renvoie seulement `id`, `email` et `role`. Le client envoie le corps décrit par OpenAPI, sans prétendre que le serveur actuel persistera les deux champs supplémentaires.

**TODO(confirmer avec Dan)** : aligner l’implémentation de `api/` sur OpenAPI ou mettre à jour le contrat convenu avant de brancher une inscription réelle. Ne pas retirer silencieusement `fullName` ou `universityId` côté app.

## Utilisateur courant : route documentée mais absente du montage actuel

OpenAPI décrit `GET /api/users/me`, sans corps, avec `Authorization: Bearer <accessToken>`. Réponse `200` : `{ "user": { "id", "fullName", "email", "role", "universityId" } }`. Le client utilise cette route après avoir renouvelé le refresh token au démarrage.

`api/src/app.ts` ne monte pas de route `/api/users/me` et aucun module users correspondant n’est présent dans le dépôt. La route est donc indisponible dans l’implémentation observée, malgré sa présence dans OpenAPI.

**TODO(confirmer avec Dan)** : implémenter la route documentée ou convenir d’un mécanisme de restauration basé uniquement sur la réponse de `POST /api/auth/refresh`.

## Catalogue d’universités : route documentée mais non montée

OpenAPI décrit `GET /api/universities?page=1&limit=20`, sans authentification, qui renvoie `{ "items": [{ "id", "name" }], "page", "limit", "total" }`. Cette route alimente le choix facultatif d’université du formulaire. L’affiliation est déclarative, jamais présentée comme vérifiée.

La route n’est pas montée dans `api/src/app.ts` et aucun routeur université n’est présent. Le formulaire reste utilisable sans université, mais la liste ne peut être chargée contre le serveur actuel.

**TODO(confirmer avec Dan)** : monter cette route telle que décrite, ou confirmer que l’université pourra rester vide pendant l’inscription initiale.

## Récupération de mot de passe

Aucune route de récupération n’est décrite dans OpenAPI. Le lien de connexion affiche uniquement « Bientôt disponible » ; aucun écran ni appel réseau de récupération n’est implémenté.

## Éléments d’intégration couverts par le contrat

- Connexion : `POST /api/auth/login`, `{ "email", "password" }`, réponse `200` avec `AuthResponse`.
- Renouvellement : `POST /api/auth/refresh`, `{ "refreshToken" }`, réponse `200` avec les nouveaux jetons et l’utilisateur. Les refresh concurrents sont sérialisés côté client ; un échec efface les jetons locaux.
- Déconnexion : `POST /api/auth/logout`, Bearer access token, aucun corps, réponse `204` sans corps.
- Erreurs : enveloppe `{ "error": { "code", "message", "status", "details" } }`, avec détails de validation `{ "path", "message" }`.
- Les refresh tokens restent dans le stockage sécurisé ; l’access token n’est gardé qu’en mémoire.

## Décisions frontend à valider

- `API_BASE_URL` utilise `http://localhost:3000` par défaut pour le développement local ; les autres environnements le fournissent avec `--dart-define`.
- `USE_MOCK_AUTH=true` active le repository mock ; la valeur par défaut utilise l’API.
- Les polices Wix Madefor Display et Instrument Sans sont nommées dans le système de design, mais les fichiers de police ne sont pas fournis avec le document. L’app les déclare dans le thème ; Flutter retombera sur la police système jusqu’à ce que les fichiers soient ajoutés.
- La maquette d’erreur d’inscription suggère une exigence de chiffre ou symbole pour le mot de passe. OpenAPI ne demande que 8 à 128 caractères ; le formulaire applique la règle documentée par l’API.

**TODO(confirmer avec Dan et Figma)** : choix de la police système ou ajout des fichiers de polices, et règle définitive de complexité du mot de passe si le backend doit l’imposer.
