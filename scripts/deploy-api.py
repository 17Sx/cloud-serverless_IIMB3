#!/usr/bin/env python3
"""
Deploy script for the API (Hono/Bun) to AWS Lambda.

Usage:
    python deploy-api.py <env>

Where <env> is 'dev' or 'prd'.

Required environment variables:
    LAMBDA_FUNCTION_DEV / LAMBDA_FUNCTION_PRD
    AWS_REGION (optional, defaults to eu-west-3)
"""

import os
import sys
import subprocess
import tempfile
import time
import zipfile

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import boto3

VALID_ENVS = ("dev", "prd")
API_DIR = os.path.join(os.path.dirname(__file__), "..", "api")
DIST_DIR = os.path.join(API_DIR, "dist")


def run(cmd: list[str], cwd: str | None = None) -> None:
    print(f"  > {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, check=False, shell=(sys.platform == "win32"))
    if result.returncode != 0:
        print(f"ERROR: command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def create_zip(source_dir: str) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(source_dir):
            for f in files:
                filepath = os.path.join(root, f)
                arcname = os.path.relpath(filepath, source_dir)
                zf.write(filepath, arcname)
    return tmp.name


def deploy(env: str) -> None:
    suffix = env.upper()
    function_name = os.environ.get(f"LAMBDA_FUNCTION_{suffix}")
    region = (os.environ.get("AWS_REGION") or "").strip() or "eu-west-3"

    if not function_name:
        print(f"ERROR: LAMBDA_FUNCTION_{suffix} not set")
        sys.exit(1)

    # Step 1: Build
    print("\n[1/3] Building API...")
    run(["bun", "run", "build"], cwd=API_DIR)

    if not os.path.isdir(DIST_DIR):
        print(f"ERROR: Build output not found: {DIST_DIR}")
        sys.exit(1)

    # Step 2: Package
    print("\n[2/3] Creating deployment package...")
    zip_path = create_zip(DIST_DIR)
    zip_size = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"  Package: {zip_path} ({zip_size:.1f} MB)")

    # Step 3: Deploy
    print("\n[3/3] Updating Lambda function...")
    lambda_client = boto3.client("lambda", region_name=region)

    with open(zip_path, "rb") as f:
        lambda_client.update_function_code(
            FunctionName=function_name,
            ZipFile=f.read(),
        )

    time.sleep(10)

    suffix = env.upper()
    oauth_sources = [
        ("OAUTH_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"),
        ("OAUTH_GOOGLE_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET"),
        (f"OAUTH_GITHUB_CLIENT_ID_{suffix}", "GITHUB_CLIENT_ID"),
        (f"OAUTH_GITHUB_CLIENT_SECRET_{suffix}", "GITHUB_CLIENT_SECRET"),
    ]
    config = lambda_client.get_function_configuration(FunctionName=function_name)
    env_vars = dict(config.get("Environment", {}).get("Variables", {}) or {})
    for src_key, dest_key in oauth_sources:
        val = os.environ.get(src_key) or os.environ.get(dest_key) or ""
        if not val and "GITHUB" in src_key:
            val = os.environ.get("OAUTH_GITHUB_CLIENT_ID" if "ID" in src_key else "OAUTH_GITHUB_CLIENT_SECRET") or ""
        val = val.strip()
        if val:
            env_vars[dest_key] = val

    lambda_client.update_function_configuration(
        FunctionName=function_name,
        Timeout=30,
        Environment={"Variables": env_vars},
    )

    os.unlink(zip_path)
    print(f"\nAPI deployed to Lambda '{function_name}' ({env})!")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in VALID_ENVS:
        print(f"Usage: python {sys.argv[0]} <{'|'.join(VALID_ENVS)}>")
        sys.exit(1)

    env = sys.argv[1]
    print(f"=== Deploying API to {env.upper()} ===")
    deploy(env)
    

if __name__ == "__main__":
    main()
