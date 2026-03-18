# Manquants par rapport au sujet (etat actuel)

Ce document liste ce qui manque par rapport aux demandes du PDF, en se basant sur le code present dans le repo.

## 1) Contraintes techniques globales

- [ ] **ORM interdit**: non conforme actuellement (Drizzle ORM est utilise dans l'API).
  - Exemples: `api/src/db/schema.ts`, `api/src/routes/*.ts`.
- [x] **Script de migrations manuel**: OK (`scripts/migrate.py`).
- [x] **Scripts CI/CD lancables en local**: en grande partie OK (`scripts/deploy.py`, `scripts/deploy-api.py`, `scripts/deploy-assets.py`).
- [x] **Lambda Hono lancable en local**: OK (`api/src/index.ts`, serveur Bun local).
- [~] **Logs CloudWatch**: instrumentation applicative OK (`hono/logger`, `console.error`), mais verification IAM/deploiement reste a faire.
- [ ] **Cognito comme source de verite users**: non conforme actuellement.
  - La table `user` est en base applicative (`api/migrations/001_initial.sql`) et auth via Better Auth.
- [ ] **API qui appelle Cognito pour nom/email user**: non fait.
- [ ] **Connexion front via package Cognito**: non fait.
- [ ] **Service `aws_cognito` (get_user_by_sub, get_user_by_email, update_user_by_sub, ...)**: non fait.

## 2) Structure de repo demandee

Demande:
- `code/api`
- `code/crons`
- `code/domain` (partage API + crons)
- `code/emails`
- `code/www-assets`
- `code/www-user`
- `code/www-admin`

Etat actuel:
- [~] API presente mais en `api/` (pas `code/api`).
- [ ] `code/crons` absent (aucun dossier `crons/`).
- [ ] `code/domain` partage absent (domain present seulement dans `api/src/domain`).
- [~] Emails presents mais en `emails/` (pas `code/emails`).
- [~] Assets presents mais en `assets/` (pas `code/www-assets`).
- [ ] `code/www-user` absent (front user integre dans `code/src/app/(user)`).
- [ ] `code/www-admin` absent (front admin integre dans `code/src/app/(admin)`).

## 3) Services AWS demandes

- [x] **Lambda Hono + Bun + API Gateway**: en place cote code/deploy.
- [~] **Service propre aws_rds**: acces DB existe (`api/src/db/index.ts`) mais pas de service dedie nomme `aws_rds`.
- [x] **Service propre aws_ses**: present (`api/src/services/ses.ts`).
- [ ] **Service propre aws_cognito**: absent.

## 4) Rendu scripts obligatoire

- [x] Dockerfile + Docker Compose pour dev: present (`api/Dockerfile`, `code/Dockerfile`, `docker-compose.yml`).
- [x] Script deploy front: present (`scripts/deploy.py`).
- [x] Script deploy assets: present (`scripts/deploy-assets.py`).
- [x] Script migrations DB: present (`scripts/migrate.py`).
- [x] Script deploy API: present (`scripts/deploy-api.py`).
- [ ] Script deploy crons: **absent** (`scripts/deploy-crons.py` manque).

## 5) Fonctionnalites manquantes deja identifiees

- [ ] Brancher l'envoi d'email d'invitation dans la route team (`api/src/routes/teams.ts`).
- [ ] Cron backup complet (code + lambda + eventbridge + CI/CD).
- [ ] Endpoint `GET /api/admin/backups` (`api/src/routes/admin.ts`).
- [ ] Page admin backups (`code/src/app/(admin)/admin/backups/page.tsx`).

## 6) Ecarts sur la liste d'endpoints demandee

### Endpoints globalement couverts

- [x] Teams/projects/tasks/assets/invitations/admin: gros du CRUD present.

### Ecarts importants

- [ ] `POST /users` demande, mais non present tel quel (seulement `GET/PATCH /api/users/me`).
- [ ] `POST /auth/login` demande, mais auth actuelle via routes Better Auth (`/api/auth/**`), pas cet endpoint explicite.
- [~] `GET /me` et `PATCH /me`: presents via `/api/users/me` (chemin different).
- [ ] `POST /teams/:teamId/invitations` demande, code actuel: `POST /api/teams/:id/invite` (chemin + nom differents).
- [ ] `POST /invitations/:invitationId/reject` demande, code actuel: `/decline`.
- [ ] Endpoints imbriques `teams/:teamId/projects` et `projects/:projectId/tasks` non exposes avec ces chemins exacts (actuellement routes plates `/api/projects`, `/api/tasks` + query params).
- [ ] Endpoints assets par task (`POST/GET /tasks/:taskId/assets`) non exposes tels quels (actuellement `/api/assets/upload-url`, `/api/assets?taskId=...`).
- [ ] `GET /admin/backups` demande: absent.

## 7) Exigences presentation vendredi (ce qui manque pour la demo)

### Eleve 1
- [x] API locale lancable.
- [x] Script migrations lancable.
- [x] Script deploy API present.
- [ ] Explication Cognito impossible tant que Cognito n'est pas integre.

### Eleve 2
- [x] Site user en ligne (infra semble prete).
- [~] Feature invitations partielle (creation/accept/decline OK, envoi email pas branche).
- [x] Feature pieces jointes presente.
- [x] Script deploy assets present.
- [x] Script deploy front present.

### Eleve 3
- [x] Site admin en ligne (infra semble prete).
- [ ] Backups via cron local: non fait.
- [ ] Script deploy crons: non fait.
- [x] CI/CD via push: present.
- [~] Gestion des environnements: partiellement en place (staging/prod), a finaliser pour crons/cognito.
- [~] Remontee logs: code OK, validation AWS encore a montrer.

## 8) Variables/secrets a ajouter ou confirmer

Pour le scope actuel (sans Cognito), verifier:
- [x] `DATABASE_URL_DEV`, `DATABASE_URL_PRD`
- [x] `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- [x] `S3_BUCKET_USER_*`, `S3_BUCKET_ADMIN_*`, `CF_ID_USER_*`, `CF_ID_ADMIN_*`
- [x] `LAMBDA_FUNCTION_DEV`, `LAMBDA_FUNCTION_PRD`
- [x] `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USER_SITE_URL`
- [x] `BETTER_AUTH_SECRET`
- [ ] `SES_FROM_EMAIL` (necessaire pour l'invitation email)
- [~] `S3_BACKUP_BUCKET(_DEV/_PRD)` optionnel si vous standardisez un seul bucket + prefix `backups/`, sinon a ajouter explicitement

Pour la conformite au sujet Cognito (plus tard):
- [ ] `COGNITO_USER_POOL_ID`
- [ ] `COGNITO_APP_CLIENT_ID`
- [ ] `COGNITO_APP_CLIENT_SECRET` (si client confidentiel)
- [ ] `COGNITO_REGION` (ou reutiliser `AWS_REGION`)

## 9) Priorites (ordre recommande)

1. Integrer Cognito (backend + front + service `aws_cognito`) pour lever le plus gros ecart au sujet.
2. Finir le bloc cron backup (code + deploy + CI/CD + endpoint/page admin backups).
3. Aligner les endpoints sur ceux demandes (noms/chemins), ou documenter clairement la compatibilite.
4. Brancher `sendInvitationEmail` + `SES_FROM_EMAIL`.
5. Finaliser la preuve CloudWatch (permissions IAM + capture de logs en demo).
