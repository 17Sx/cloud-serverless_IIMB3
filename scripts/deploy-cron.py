#!/usr/bin/env python3
"""
Deploy script for the cron Lambda (hourly database backups).

Usage:
    python deploy-cron.py

Required environment variables:
    LAMBDA_FUNCTION_CRON
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

API_DIR = os.path.join(os.path.dirname(__file__), "..", "api")
DIST_DIR = os.path.join(API_DIR, "dist-cron")


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


def deploy() -> None:
    function_name = os.environ.get("LAMBDA_FUNCTION_CRON")
    region = (os.environ.get("AWS_REGION") or "").strip() or "eu-west-3"

    if not function_name:
        print("ERROR: LAMBDA_FUNCTION_CRON not set")
        sys.exit(1)

    # Step 1: Build
    print("\n[1/3] Building cron Lambda...")
    run(["bun", "run", "build:cron"], cwd=API_DIR)

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

    lambda_client.update_function_configuration(
        FunctionName=function_name,
        Timeout=300,  # 5 min — le backup peut prendre du temps
        Handler="cron.handler",
    )

    os.unlink(zip_path)
    print(f"\nCron Lambda '{function_name}' deployed!")


def main() -> None:
    print("=== Deploying Cron Lambda ===")
    deploy()


if __name__ == "__main__":
    main()
