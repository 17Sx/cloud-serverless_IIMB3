#!/usr/bin/env python3
"""
Deploy assets to AWS S3 (+ optional CloudFront invalidation).

Usage:
    python scripts/deploy-assets.py <env> [--dir PATH] [--prefix PREFIX]

Where <env> is 'dev' or 'prd'.

Options:
    --dir PATH      Local directory to upload (default: ./assets)
    --prefix PREFIX S3 key prefix (default: 'assets/')

Environment variables:
    S3_ASSETS_BUCKET_DEV / S3_ASSETS_BUCKET_PRD — optionnel ; sinon défaut :
        cloud-serverless-iimb3-assets-dev  /  cloud-serverless-iimb3-assets-prd
    (S3_ASSETS_BUCKET sert à l’API pour les presigned URLs, pas à ce script.)
    Invalidation CloudFront (une seule distribution peut servir le site + le bucket assets en origine secondaire) :
    CF_ID_ASSETS_* si tu as une CF dédiée ; sinon le script utilise CF_ID_USER_* (même CF que le front user).
    AWS_REGION (optionnel, défaut eu-west-3) — S3 uniquement ; l’API CloudFront est toujours appelée en us-east-1.
"""

import os
import sys
import argparse
import mimetypes
import time
import uuid

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import boto3
from botocore.exceptions import ClientError

VALID_ENVS = ("dev", "prd")

# L’API de contrôle CloudFront (invalidation, etc.) doit utiliser us-east-1 (exigence AWS).
CLOUDFRONT_API_REGION = "us-east-1"

CONTENT_TYPE_OVERRIDES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
}


def get_content_type(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    if ext in CONTENT_TYPE_OVERRIDES:
        return CONTENT_TYPE_OVERRIDES[ext]
    guessed, _ = mimetypes.guess_type(filepath)
    return guessed or "application/octet-stream"


def get_bucket(env: str) -> str:
    """Bucket dédié par env (le nom unique cloud-serverless-iimb3-assets n’existe pas en prod)."""
    suffix = env.upper()
    explicit = os.environ.get(f"S3_ASSETS_BUCKET_{suffix}")
    if explicit:
        return explicit.strip()
    return f"cloud-serverless-iimb3-assets-{env}"


def get_cloudfront_id_for_invalidation(env: str) -> tuple[str | None, str]:
    """
    ID de la distribution à invalider après upload S3.
    Beaucoup de projets n’ont pas de CF « assets » : le bucket assets est une 2e origine sur la CF du site user.
    """
    suffix = env.upper()
    assets = (os.environ.get(f"CF_ID_ASSETS_{suffix}") or "").strip()
    if assets:
        return assets, "CF_ID_ASSETS_*"
    user_cf = (os.environ.get(f"CF_ID_USER_{suffix}") or "").strip()
    if user_cf:
        return user_cf, "CF_ID_USER_* (même CloudFront que le site user)"
    return None, ""


def _skip_upload_file(filename: str) -> bool:
    """Ne pas pousser les fichiers de gestion de repo vers le CDN."""
    if filename.startswith("."):
        return True
    return filename.lower() in ("thumbs.db", "desktop.ini")


def upload_directory(
    s3_client, local_dir: str, bucket: str, prefix: str = ""
) -> int:
    dest = f"s3://{bucket}/{prefix}" if prefix else f"s3://{bucket}/"
    print(f"  Uploading {local_dir} -> {dest}")
    count = 0
    for root, _, files in os.walk(local_dir):
        for filename in files:
            if _skip_upload_file(filename):
                continue
            filepath = os.path.join(root, filename)
            key = os.path.relpath(filepath, local_dir).replace("\\", "/")
            if prefix:
                key = f"{prefix.rstrip('/')}/{key}"
            content_type = get_content_type(filepath)
            extra: dict = {
                "ContentType": content_type,
                # Aide navigateurs / politiques CF qui respectent l’origine à revalider plus souvent
                "CacheControl": "public, max-age=0, must-revalidate",
            }
            s3_client.upload_file(
                filepath,
                bucket,
                key,
                ExtraArgs=extra,
            )
            count += 1
    print(f"  Uploaded {count} files to {dest}")
    return count


def _invalidation_paths_for_prefix(s3_key_prefix: str) -> list[str]:
    """Chemins URL côté client (pas la clé S3 brute). Préfixe défaut assets/ → /assets et /assets/*."""
    p = (s3_key_prefix or "assets/").strip("/")
    if not p:
        return ["/*"]
    # /* couvre tout ; chemins explicites pour certains comportements CF par préfixe
    return ["/*", f"/{p}", f"/{p}/*"]


def invalidate_cloudfront(
    cf_client, distribution_id: str, s3_key_prefix: str
) -> str | None:
    paths = _invalidation_paths_for_prefix(s3_key_prefix)
    print(f"  Invalidating CloudFront distribution: {distribution_id}")
    print(f"  Paths: {paths}")
    resp = cf_client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": len(paths), "Items": paths},
            "CallerReference": f"deploy-assets-{uuid.uuid4()}",
        },
    )
    inv_id = resp.get("Invalidation", {}).get("Id")
    print(f"  Invalidation ID: {inv_id} (console → CloudFront → Invalidations → statut Completed)")
    print("  Après Completed, compte encore ~1–2 min sur certains edges ; Ctrl+F5 côté navigateur.")
    return inv_id


def print_assets_url_hint() -> None:
    base = (os.environ.get("NEXT_PUBLIC_ASSETS_BASE_URL") or "").strip().rstrip("/")
    if not base:
        return
    print(f"\n  Rappel .env : NEXT_PUBLIC_ASSETS_BASE_URL = {base}")
    print(
        "  → L’hôte de cette URL doit être le **même** que le « Domain name » de la distribution invalidée.\n"
        "  Si ce n’est pas le cas, tu invalides une CF mais le navigateur charge une autre (l’image ne change pas)."
    )


def try_wait_invalidation(
    cf_client, distribution_id: str, invalidation_id: str | None
) -> None:
    if not invalidation_id:
        return
    if os.environ.get("DEPLOY_ASSETS_WAIT_CF_INVALIDATION", "").strip().lower() not in (
        "1",
        "true",
        "yes",
    ):
        return
    print("  Attente fin d’invalidation (DEPLOY_ASSETS_WAIT_CF_INVALIDATION=1)...")
    try:
        for _ in range(90):
            r = cf_client.get_invalidation(
                DistributionId=distribution_id, Id=invalidation_id
            )
            st = r.get("Invalidation", {}).get("Status", "")
            if st == "Completed":
                print("  Statut AWS : Completed.")
                return
            if st == "InProgress":
                time.sleep(2)
                continue
            print(f"  Statut inattendu : {st}")
            return
        print("  Timeout — vérifie la console AWS.")
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "AccessDenied":
            print("  (cloudfront:GetInvalidation refusé — impossible d’attendre le statut.)")
        else:
            print(f"  (Erreur poll invalidation : {e})")


def print_cf_vs_bucket_check(cf_client, distribution_id: str, bucket: str) -> None:
    """Aide à détecter CF_ID_ASSETS_* qui ne pointe pas vers le bon bucket / mauvaise URL front."""
    try:
        resp = cf_client.get_distribution(Id=distribution_id)
        dist = resp["Distribution"]
        domain = dist.get("DomainName", "")
        cfg = dist["DistributionConfig"]
        items = cfg.get("Origins", {}).get("Items", [])
        origin_domains = [o.get("DomainName", "") for o in items]
        print(f"\n  --- Vérif alignement (si l’image ne change pas, lis ça) ---")
        print(f"  Domaine public de la distribution invalidée : https://{domain}")
        print(f"  → NEXT_PUBLIC_ASSETS_BASE_URL doit utiliser ce domaine (souvent la même CF que le site).")
        print(f"  Origines S3 configurées sur cette CF :")
        for od in origin_domains:
            print(f"    - {od}")
        bucket_in_origin = any(
            bucket in od or od.startswith(f"{bucket}.")
            for od in origin_domains
        )
        if not bucket_in_origin:
            print(
                f"\n  ⚠ Aucune origine ne ressemble au bucket uploadé « {bucket} ».\n"
                f"     Tu invalides peut‑être la bonne CF mais les fichiers sont sur un autre bucket,\n"
                f"     ou l’inverse : le front charge une AUTRE URL (autre CF) que celle ci‑dessus."
            )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "AccessDenied":
            print(
                "  (Diagnostic CF omis : l’utilisateur IAM n’a pas cloudfront:GetDistribution — "
                "normal pour un compte limité à CreateInvalidation. L’invalidation ci‑dessous peut quand même réussir.)"
            )
        else:
            print(f"  (Impossible de lire la config CF : {e})")


def deploy_assets(env: str, local_dir: str, prefix: str) -> None:
    bucket = get_bucket(env)
    region = (os.environ.get("AWS_REGION") or "").strip() or "eu-west-3"
    cf_id, cf_id_source = get_cloudfront_id_for_invalidation(env)

    if not os.path.isdir(local_dir):
        print(f"ERROR: Directory not found: {local_dir}")
        sys.exit(1)

    s3_client = boto3.client("s3", region_name=region)

    try:
        s3_client.head_bucket(Bucket=bucket)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchBucket", "403"):
            print(
                f"ERROR: bucket S3 introuvable ou inaccessible : {bucket!r} (région {region}).\n"
                f"  Crée le bucket dans AWS ou définis S3_ASSETS_BUCKET_{env.upper()} dans .env."
            )
            sys.exit(1)
        raise

    print(f"  Target bucket: {bucket}")

    # Upload
    print(f"\n[1/2] Uploading assets from {local_dir}...")
    count = upload_directory(s3_client, local_dir, bucket, prefix)

    if count == 0:
        print("WARNING: No files found to upload.")
        return

    # CloudFront invalidation (optional)
    if cf_id:
        print(f"\n[2/2] Invalidating CloudFront cache ({cf_id_source})...")
        cf_client = boto3.client("cloudfront", region_name=CLOUDFRONT_API_REGION)
        print_cf_vs_bucket_check(cf_client, cf_id, bucket)
        print_assets_url_hint()
        inv_id = invalidate_cloudfront(cf_client, cf_id, prefix)
        try_wait_invalidation(cf_client, cf_id, inv_id)
    else:
        print(
            f"\n[2/2] Pas d’invalidation CloudFront.\n"
            f"     Définis CF_ID_USER_{env.upper()} (CF du site qui sert aussi /assets depuis le bucket)\n"
            f"     ou CF_ID_ASSETS_{env.upper()} si tu as une CF séparée.\n"
            "     Sinon l’ancienne image reste en cache. Pense aussi au cache navigateur (Ctrl+F5)."
        )

    print(f"\nAssets deployment to '{env}' completed successfully!")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deploy assets to S3 + optional CloudFront invalidation."
    )
    parser.add_argument(
        "env",
        choices=VALID_ENVS,
        help="Target environment (dev or prd)",
    )
    parser.add_argument(
        "--dir",
        default=os.path.join(os.path.dirname(__file__), "..", "assets"),
        help="Local directory to upload (default: ./assets)",
    )
    parser.add_argument(
        "--prefix",
        default="assets/",
        help="S3 key prefix (default: 'assets/')",
    )

    args = parser.parse_args()

    print(f"=== Deploying assets to {args.env.upper()} ===")
    deploy_assets(args.env, args.dir, args.prefix)


if __name__ == "__main__":
    main()
