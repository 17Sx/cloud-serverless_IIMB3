# Plan Personne B — Code et GitHub

Responsabilités : projet Next.js, structure du repo, script de déploiement, workflows GitHub Actions, schémas CI/CD. Coordination avec la Personne A pour les ressources AWS (buckets, IDs CloudFront).

---

## Phase 0 — Setup initial du repo (avec A)

### Repository GitHub

- Créer un repo **public** sur GitHub
- Nom suggéré : `cloud-serverless-iimb3` (ou équivalent)
- Ne pas initialiser avec README si contenu local déjà présent

### Branches et conventions

- Branches principales :
  - `main` → production (déploiement prd)
  - `dev` → staging (déploiement dev)
- Branches de travail : `feature/nom` ou `fix/nom` → PR vers `dev`
- Convention : jamais de push direct sur `main` sans PR validée

### Structure des dossiers

```
repo/
├── code/                 # Projet Next.js
├── scripts/              # deploy.py, requirements.txt
├── infra/                # Doc AWS (rempli par A)
├── docs/                 # Schémas draw.io
├── .github/
│   └── workflows/        # deploy-dev.yml, deploy-prd.yml
├── .gitignore
└── README.md
```

### .gitignore

```
node_modules/
.next/
out/
.env*
*.pyc
__pycache__/
.DS_Store
*.log
```

### README.md (structure minimale)

- Section URLs (à remplir après déploiement)
- Section GitHub Secrets (liste des secrets requis)
- Section Cleanup (lien vers infra/cleanup-checklist.md)

---

## Phase 1 — Projet Next.js (Partie 1 du PDF)

### Initialisation

- Dans `code/` : `npx create-next-app@latest . --typescript --tailwind --eslint --app`
- Vérifier : `npm run dev` → site accessible en local

### Export statique (obligatoire pour S3)

- Modifier `code/next.config.js` :

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
module.exports = nextConfig;
```

- `npm run build` → dossier `out/` généré avec HTML, JS, CSS

### Structure user / admin (cahier des charges PDF)

- Route groups dans `app/` :

```
app/
├── (user)/
│   ├── layout.tsx
│   └── page.tsx
└── (admin)/
    ├── layout.tsx
    └── page.tsx
```

- Contenu minimal distinct sur chaque page ("Front User" / "Front Admin")
- Un seul build avec les deux routes (user et admin)

### Variables d'environnement (Partie 4 du PDF)

- Créer `.env.development` et `.env.production` (dans `code/`)
- Contenu type :
  - `NEXT_PUBLIC_ENV=development` / `production`
  - `NEXT_PUBLIC_API_URL=...`
- S'assurer que `.env*` est dans `.gitignore`
- Les variables ne doivent **jamais** être committées

### ESLint (Partie 3 du PDF)

- Vérifier `.eslintrc.json` (créé par Next.js)
- `npm run lint` doit retourner exit 1 en cas d'erreur
- Tester en introduisant une erreur volontaire

---

## Phase 2 — Script de déploiement (Partie 2 du PDF)

### deploy.py

- Créer `scripts/requirements.txt` : `boto3>=1.26.0`
- Créer `scripts/deploy.py` avec les étapes :
  1. `npm install` (ou `npm ci`) dans `code/`
  2. `npm run build` dans `code/`
  3. Vider le bucket S3 cible
  4. Uploader le contenu de `code/out/` vers S3 (avec Content-Type correct)
  5. Invalidation CloudFront `/` pour vider le cache

### Variables d'environnement du script

Le script doit lire :

- `S3_BUCKET_USER_DEV`, `S3_BUCKET_USER_PRD`
- `S3_BUCKET_ADMIN_DEV`, `S3_BUCKET_ADMIN_PRD`
- `CF_ID_USER_DEV`, `CF_ID_USER_PRD`
- `CF_ID_ADMIN_DEV`, `CF_ID_ADMIN_PRD`

(ou variante avec un seul bucket par env si besoin)

### Test local

- Configurer les variables d'env en local
- `python scripts/deploy.py dev`
- Modifier un texte sur le front, redéployer, vérifier que le changement apparaît immédiatement (cache CloudFront invalidé)

---

## Phase 3 — GitHub Actions CI/CD (Parties 2, 3, 4 du PDF)

### Secrets GitHub

- Settings > Secrets and variables > Actions > New repository secret
- Ajouter :
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `S3_BUCKET_USER_DEV`, `S3_BUCKET_USER_PRD`
  - `S3_BUCKET_ADMIN_DEV`, `S3_BUCKET_ADMIN_PRD`
  - `CF_ID_USER_DEV`, `CF_ID_USER_PRD`
  - `CF_ID_ADMIN_DEV`, `CF_ID_ADMIN_PRD`

### Workflow deploy-dev.yml

- Déclencheur : `push` sur `dev`
- Étapes :
  1. Checkout
  2. Setup Node.js 20 + cache npm
  3. Setup Python 3.11
  4. `pip install -r scripts/requirements.txt`
  5. **Lint** : `cd code && npm ci && npm run lint` — **le pipeline doit s'arrêter si échec** (Partie 3)
  6. Deploy : exécuter `deploy.py` avec les secrets dev

### Workflow deploy-prd.yml

- Déclencheur : `push` sur `main`
- Même structure que deploy-dev, avec secrets prd

### Test de la CI (Partie 3)

- Introduire une erreur de lint
- Push sur `dev`
- Vérifier que le job échoue sur l'étape Lint
- Corriger, repousser, vérifier succès complet

---

## Phase 4 — Multi-environnements (Partie 4 du PDF)

- Vérifier que `NEXT_PUBLIC_ENV` est différent selon l'env (visible dans l'UI)
- Adapter `deploy.py` si besoin pour user + admin (deux buckets par env)
- S'assurer qu'aucune variable sensible n'est dans le code
- Remplir le tableau d'URLs dans le README

---

## Phase 5 — Schéma CI/CD (Partie 5 du PDF)

- Draw.io : schéma du pipeline
  - Push dev/main
  - Checkout → Setup Node/Python → Lint (stop si fail) → Build → Clear S3 → Upload → CloudFront invalidation
- Exporter PNG + sauvegarder `docs/schema-cicd.drawio`

---

## Récapitulatif des livrables B

| Fichier                            | Contenu                |
| ---------------------------------- | ---------------------- |
| `code/`                            | Projet Next.js complet |
| `scripts/requirements.txt`         | boto3                 
| `.github/workflows/deploy-dev.yml` | CI/CD dev              
| `.github/workflows/deploy-prd.yml` | CI/CD prd            |
| `docs/schema-cicd.drawio`          | Schéma pipeline        |

---

## Dépendances avec A

- **Phase 0** : Création du repo et structure ensemble
- **Après Phase 1 A** : A transmet les noms de buckets et IDs CloudFront pour les secrets
- **Phase 3 (premier déploiement manuel)** : B fait le build, A upload manuellement pour validation
- **Workflows** : A doit avoir fourni les IDs et B doit avoir configuré les secrets

---

## Checklist finale (exigences PDF)

- Repo GitHub public (pas GitLab)
- URL CloudFront Front User (dev + prd)
- URL CloudFront Front Admin (dev + prd)
- CI/CD fonctionnelle avec lint bloquant
- Variables d'env jamais dans le code
- Schémas draw.io dans docs/
- README avec toutes les URLs
- Vidéo de démo 10 min max
