# Besoins API frontend restants

Les parcours Flutter de connexion, inscription, restauration de session, déconnexion et choix facultatif d’université utilisent les routes et contrats présents dans `api/` et `api/openapi.yaml` :

- `POST /api/auth/register` accepte `fullName` (1–120 caractères après trim), `email` (254 caractères maximum, normalisé en minuscules), `password` (8–128 caractères) et `universityId` facultatif. Une université fournie doit exister et être active.
- `POST /api/auth/login`, `POST /api/auth/refresh` et `POST /api/auth/logout` sont intégrés. Le refresh token est conservé en stockage sécurisé ; l’access token reste en mémoire.
- `GET /api/users/me` restaure les informations publiques du compte avec un Bearer access token. Au redémarrage, Flutter renouvelle d’abord le refresh token conservé, puis charge le profil courant.
- `GET /api/universities?page=…&limit=100` alimente le champ facultatif. Flutter charge chaque page et présente les états chargement, erreur/reprise, liste vide et liste chargée.

## Récupération de mot de passe — reportée

L’interface affiche « Bientôt disponible ». L’API ne définit pas de route de récupération, de corps de requête ni de réponse pour ce parcours. Aucun appel n’est effectué et ce parcours reste hors de l’issue #22.
