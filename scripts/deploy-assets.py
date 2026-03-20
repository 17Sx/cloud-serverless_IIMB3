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
    AWS_REGION (optionnel, défaut eu-west-3)
"""

import os
import sys
import argparse
import mimetypes
import time

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import boto3
from botocore.exceptions import ClientError

VALID_ENVS = ("dev", "prd")

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


def get_cloudfront_id(env: str) -> str | None:
    """Return the CloudFront distribution ID for assets, or None."""
    suffix = env.upper()
    return os.environ.get(f"CF_ID_ASSETS_{suffix}")


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
            s3_client.upload_file(
                filepath,
                bucket,
                key,
                ExtraArgs={"ContentType": content_type},
            )
            count += 1
    print(f"  Uploaded {count} files to {dest}")
    return count


def invalidate_cloudfront(cf_client, distribution_id: str) -> None:
    print(f"  Invalidating CloudFront distribution: {distribution_id}")
    cf_client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": 1, "Items": ["/*"]},
            "CallerReference": str(time.time()),
        },
    )
    print("  Invalidation created.")


def deploy_assets(env: str, local_dir: str, prefix: str) -> None:
    bucket = get_bucket(env)
    region = (os.environ.get("AWS_REGION") or "").strip() or "eu-west-3"
    cf_id = get_cloudfront_id(env)

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
        print(f"\n[2/2] Invalidating CloudFront cache...")
        cf_client = boto3.client("cloudfront", region_name=region)
        invalidate_cloudfront(cf_client, cf_id)
    else:
        print(f"\n[2/2] No CloudFront distribution configured, skipping invalidation.")

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
