#!/usr/bin/env python3
"""
Deploy script for Next.js static export to AWS S3 + CloudFront.

Usage:
    python deploy.py <env>

Where <env> is 'dev' or 'prd'.

Required environment variables (per env):
    S3_BUCKET_USER_DEV / S3_BUCKET_USER_PRD
    S3_BUCKET_ADMIN_DEV / S3_BUCKET_ADMIN_PRD
    CF_ID_USER_DEV / CF_ID_USER_PRD
    CF_ID_ADMIN_DEV / CF_ID_ADMIN_PRD
    AWS_REGION (optional, defaults to eu-west-3)
"""

import os
import sys
import subprocess
import mimetypes
import time

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import boto3

VALID_ENVS = ("dev", "prd")

CODE_DIR = os.path.join(os.path.dirname(__file__), "..", "code")
OUT_DIR = os.path.join(CODE_DIR, "out")

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
}


def run(cmd: list[str], cwd: str | None = None) -> None:
    print(f"  > {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, check=False, shell=(sys.platform == "win32"))
    if result.returncode != 0:
        print(f"ERROR: command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def get_content_type(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    if ext in CONTENT_TYPE_OVERRIDES:
        return CONTENT_TYPE_OVERRIDES[ext]
    guessed, _ = mimetypes.guess_type(filepath)
    return guessed or "application/octet-stream"


def clear_bucket(s3_client, bucket: str) -> None:
    print(f"  Clearing bucket: {bucket}")
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        objects = page.get("Contents", [])
        if objects:
            delete_keys = [{"Key": obj["Key"]} for obj in objects]
            s3_client.delete_objects(
                Bucket=bucket, Delete={"Objects": delete_keys}
            )
    print(f"  Bucket {bucket} cleared.")


def upload_directory(
    s3_client, local_dir: str, bucket: str, prefix: str = ""
) -> None:
    dest = f"s3://{bucket}/{prefix}" if prefix else f"s3://{bucket}/"
    print(f"  Uploading {local_dir} -> {dest}")
    count = 0
    for root, _, files in os.walk(local_dir):
        for filename in files:
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


def deploy(env: str) -> None:
    suffix = env.upper()

    bucket_user = os.environ.get(f"S3_BUCKET_USER_{suffix}")
    bucket_admin = os.environ.get(f"S3_BUCKET_ADMIN_{suffix}")
    cf_user = os.environ.get(f"CF_ID_USER_{suffix}")
    cf_admin = os.environ.get(f"CF_ID_ADMIN_{suffix}")
    region = (os.environ.get("AWS_REGION") or "").strip() or "eu-west-3"

    missing = []
    for name, val in [
        (f"S3_BUCKET_USER_{suffix}", bucket_user),
        (f"S3_BUCKET_ADMIN_{suffix}", bucket_admin),
        (f"CF_ID_USER_{suffix}", cf_user),
        (f"CF_ID_ADMIN_{suffix}", cf_admin),
    ]:
        if not val:
            missing.append(name)

    if missing:
        print(f"ERROR: Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    # Step 1: npm ci
    print("\n[1/5] Installing dependencies...")
    run(["npm", "ci"], cwd=CODE_DIR)

    # Step 2: npm run build
    print("\n[2/5] Building Next.js (static export)...")
    run(["npm", "run", "build"], cwd=CODE_DIR)

    if not os.path.isdir(OUT_DIR):
        print(f"ERROR: Build output directory not found: {OUT_DIR}")
        sys.exit(1)

    s3_client = boto3.client("s3", region_name=region)
    cf_client = boto3.client("cloudfront", region_name=region)

    user_out = os.path.join(OUT_DIR)
    admin_out = os.path.join(OUT_DIR, "admin")
    next_static = os.path.join(OUT_DIR, "_next")

    # Step 3: Clear S3 buckets
    print("\n[3/5] Clearing S3 buckets...")
    clear_bucket(s3_client, bucket_user)
    clear_bucket(s3_client, bucket_admin)

    # Step 4: Upload to S3
    print("\n[4/5] Uploading to S3...")
    upload_directory(s3_client, user_out, bucket_user)
    # Admin bucket: pages admin/ + assets _next/ (les HTML admin référencent /_next/...)
    upload_directory(s3_client, admin_out, bucket_admin)
    if os.path.isdir(next_static):
        upload_directory(s3_client, next_static, bucket_admin, prefix="_next")
    # Assets racine (favicon, etc.)
    for name in ("favicon.ico",):
        p = os.path.join(OUT_DIR, name)
        if os.path.isfile(p):
            s3_client.upload_file(
                p, bucket_admin, name,
                ExtraArgs={"ContentType": get_content_type(p)},
            )

    # Step 5: Invalidate CloudFront
    print("\n[5/5] Invalidating CloudFront caches...")
    invalidate_cloudfront(cf_client, cf_user)
    invalidate_cloudfront(cf_client, cf_admin)

    print(f"\nDeployment to '{env}' completed successfully!")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in VALID_ENVS:
        print(f"Usage: python {sys.argv[0]} <{'|'.join(VALID_ENVS)}>")
        sys.exit(1)

    env = sys.argv[1]
    print(f"=== Deploying to {env.upper()} ===")
    deploy(env)


if __name__ == "__main__":
    main()
