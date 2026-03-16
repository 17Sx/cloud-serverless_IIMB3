# Plan Personne A — AWS et Infrastructure

Responsabilités : utilisateur IAM, buckets S3, distributions CloudFront, documentation infra, schéma Draw.io, et checklist de nettoyage. Aucune modification de code applicatif.

---

## Phase 0 — Prérequis et compte AWS

### Compte AWS

- Se connecter à [console.aws.amazon.com](https://console.aws.amazon.com)
- Vérifier que le compte est actif (Free Tier possible pour le projet)
- Choisir la région : **eu-west-1** (Irlande) ou **eu-west-3** (Paris) — à décider avec B et documenter partout

### Services utilisés

- **S3** : stockage des fichiers statiques (HTML, JS, CSS du build Next.js)
- **CloudFront** : CDN pour servir le site avec HTTPS et invalidation de cache
- **IAM** : utilisateur dédié pour GitHub Actions avec droits minimaux

---

## Phase 1 — Utilisateur IAM pour la CI (Parties 2–4 du PDF)

### Objectif

Créer un utilisateur IAM `ci-deployer` utilisé uniquement par GitHub Actions. Jamais de clés root.

### Étapes détaillées

1. **Créer l'utilisateur**

- IAM > Users > Create user
- Nom : `ci-deployer`
- Ne pas cocher "Provide user access to the AWS Management Console"
- Next

1. **Attacher une policy inline (droits minimaux)**

- Users > ci-deployer > Add permissions > Create inline policy
- Onglet JSON > coller le JSON suivant :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObject"
      ],
      "Resource": ["arn:aws:s3:::*"]
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "*"
    }
  ]
}
```

- Next > Nom : `ci-deploy-s3-cloudfront` > Create

1. **Générer les Access Keys**

- Users > ci-deployer > Security credentials > Create access key
- Use case : "Application running outside AWS"
- Créer et **noter immédiatement** :
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
- Ces valeurs seront ajoutées dans GitHub Secrets par B (ne jamais les committer)

1. **Documenter dans le repo**

- Créer `infra/iam-policy.json` avec uniquement la policy (sans les clés)
- Ajouter une note dans `infra/README.md` : "Les clés IAM sont dans GitHub Secrets"

---

## Phase 2 — Buckets S3 (Parties 1 et 4 du PDF)

### Objectif

4 buckets : user-dev, user-prd, admin-dev, admin-prd. Chaque bucket héberge un frontend statique.

### Convention de nommage

Remplacer `monprojet` par le nom réel du projet (ex. `cloud-serverless-iimb3`) :

| Bucket                | Usage                    |
| --------------------- | ------------------------ |
| `monprojet-user-dev`  | Front User — Staging     |
| `monprojet-user-prd`  | Front User — Production  |
| `monprojet-admin-dev` | Front Admin — Staging    |
| `monprojet-admin-prd` | Front Admin — Production |

### Pour chaque bucket (répéter 4 fois)

1. **Créer le bucket**

- S3 > Create bucket
- Bucket name : nom unique global (ex. `cloud-serverless-iimb3-user-dev`)
- Region : celle choisie (ex. `eu-west-1`)
- **Block all public access** : **décocher** (on assume la responsabilité)
- Cocher "I acknowledge that the current settings might result in this bucket and the objects within it becoming public"
- Create bucket

1. **Activer le Static website hosting**

- Bucket > Properties > Static website hosting > Edit
- Enable
- Index document : `index.html`
- Error document : `index.html` (pour le routing SPA)
- Save changes
- Noter l'URL "Bucket website endpoint" (format : `bucket.s3-website.region.amazonaws.com`)

1. **Bucket policy pour accès public en lecture**

- Bucket > Permissions > Bucket policy > Edit
- Coller (remplacer `NOM-DU-BUCKET`) :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::NOM-DU-BUCKET/*"
    }
  ]
}
```

- Save changes

1. **Documenter**

- Remplir `infra/buckets.md` avec : nom, région, website endpoint pour chaque bucket

---

## Phase 3 — Distributions CloudFront (Parties 1 et 4 du PDF)

### Objectif

4 distributions CloudFront, une par bucket. HTTPS, cache, et gestion des erreurs 403/404 pour le SPA.

### Pour chaque distribution (répéter 4 fois)

1. **Créer la distribution**

- CloudFront > Create distribution

1. **Origin**

- **Origin domain** : ne pas utiliser l'URL automatique `bucket.s3.amazonaws.com`
- Utiliser l'URL du **website endpoint** : `NOM-DU-BUCKET.s3-website.REGION.amazonaws.com`
- Origin path : laisser vide
- Name : auto-généré

1. **Default cache behavior**

- Viewer protocol policy : **Redirect HTTP to HTTPS**
- Allowed HTTP methods : GET, HEAD, OPTIONS
- Cache policy : CachingOptimized (ou CachingDisabled pour dev si souhaité)

1. **Settings**

- Default root object : `index.html`
- Alternate domain names (CNAMEs) : laisser vide
- SSL certificate : Default CloudFront certificate

1. **Error pages (crucial pour SPA)**

- Error pages > Create custom error response
- HTTP error code : **403** → Response page path : `/index.html` → HTTP response code : **200**
- Répéter pour **404** : même configuration

1. **Créer**

- Create distribution
- Noter le **Distribution ID** et l'**URL** (format `xxxxx.cloudfront.net`)

### Documenter

- Remplir `infra/cloudfront-urls.md` :

```markdown
| Environnement | Front | URL CloudFront             | Distribution ID |
| ------------- | ----- | -------------------------- | --------------- |
| dev           | user  | https://xxx.cloudfront.net | E1234...        |
| dev           | admin | https://yyy.cloudfront.net | E5678...        |
| prd           | user  | ...                        | ...             |
| prd           | admin | ...                        | ...             |
```

---

## Phase 4 — Checklist de nettoyage (exigence PDF)

### Créer `infra/cleanup-checklist.md`

- Liste exhaustive de tout ce qui doit être supprimé dans la semaine suivant le rendu :
  - 4 distributions CloudFront (attendre "Disabled" avant suppression)
  - 4 buckets S3 (vider avant de supprimer)
  - Utilisateur IAM `ci-deployer` et ses access keys
  - Vérifier Cost Explorer : 0 $ de facturation

**Important** : Le PDF exige explicitement la suppression de toutes les ressources AWS sous 7 jours.

---

## Phase 5 — Schéma Draw.io (Partie 5 du PDF)

### Schéma infrastructure AWS

- Ouvrir [app.diagrams.net](https://app.diagrams.net)
- Utiliser les icônes AWS (Shape library > AWS)
- Schématiser :
  - GitHub repo → GitHub Actions
  - GitHub Actions → 4 buckets S3 (avec distinction dev/prd, user/admin)
  - 4 buckets S3 → 4 distributions CloudFront
  - Utilisateurs → CloudFront (accès au site)
  - Couleurs : bleu pour dev, vert pour prd
- Exporter en PNG
- Sauvegarder le fichier source dans `docs/schema-aws.drawio`

---

## Récapitulatif des livrables A

| Fichier                      | Contenu                                |
| ---------------------------- | -------------------------------------- |
| `infra/iam-policy.json`      | Policy IAM (sans clés)                 |
| `infra/buckets.md`           | Noms, régions, endpoints des 4 buckets |
| `infra/cloudfront-urls.md`   | URLs et IDs des 4 distributions        |
| `infra/cleanup-checklist.md` | Liste des ressources à supprimer       |
| `docs/schema-aws.drawio`     | Schéma infra AWS                       |

---

## Données à transmettre à B

Après les phases 1 à 3, transmettre à B pour la configuration des GitHub Secrets :

- `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` (en privé)
- `AWS_REGION`
- Noms des 4 buckets : `S3_BUCKET_USER_DEV`, `S3_BUCKET_USER_PRD`, `S3_BUCKET_ADMIN_DEV`, `S3_BUCKET_ADMIN_PRD`
- IDs des 4 distributions : `CF_ID_USER_DEV`, `CF_ID_USER_PRD`, `CF_ID_ADMIN_DEV`, `CF_ID_ADMIN_PRD`

---

## Dépendances avec B

- **Phase 0** : Création du repo et structure ensemble
- **Après Phase 3** : Transmettre buckets et IDs CloudFront à B pour les secrets
- **Premier déploiement manuel** : B fait le build, A upload manuellement pour validation

---

## Checklist finale (exigences PDF)

- 4 buckets S3 configurés
- 4 distributions CloudFront configurées
- Utilisateur IAM `ci-deployer` créé
- Documentation infra complète
- Schéma Draw.io dans docs/
- Ressources AWS supprimées sous 7 jours
