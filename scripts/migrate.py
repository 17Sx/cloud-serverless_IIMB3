#!/usr/bin/env python3
"""
Manual SQL migration runner for PostgreSQL.

Usage:
    python scripts/migrate.py [dev|prd]

If no argument is given, reads DATABASE_URL from the environment / .env file.
When 'dev' or 'prd' is specified, looks for DATABASE_URL_DEV or DATABASE_URL_PRD.
"""

import os
import sys
import glob
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
try:
    load_dotenv(_env_path, encoding="utf-8")
except UnicodeDecodeError:
    load_dotenv(_env_path, encoding="cp1252")

import psycopg

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "api", "migrations")

VALID_ENVS = ("dev", "prd")


def get_database_url(env: str | None) -> str:
    """Resolve the DATABASE_URL based on the optional env argument."""
    if env:
        key = f"DATABASE_URL_{env.upper()}"
        url = os.environ.get(key)
        if not url:
            # Fallback to generic DATABASE_URL
            url = os.environ.get("DATABASE_URL")
        if not url:
            print(f"ERROR: Neither {key} nor DATABASE_URL is set.")
            sys.exit(1)
        return url

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL is not set.")
        sys.exit(1)
    return url


def ensure_migrations_table(conn) -> None:
    """Create the _migrations tracking table if it does not exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
    conn.commit()


def get_applied_versions(conn) -> set[str]:
    """Return the set of already-applied migration versions."""
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM _migrations;")
        return {row[0] for row in cur.fetchall()}


def discover_migrations() -> list[tuple[str, str]]:
    """
    Find all *.sql files in the migrations directory.
    Returns a sorted list of (version, filepath) tuples.
    The version is the filename without the .sql extension (e.g. '001_initial').
    """
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    files = sorted(glob.glob(pattern))
    migrations = []
    for filepath in files:
        basename = os.path.basename(filepath)
        version = os.path.splitext(basename)[0]  # e.g. '001_initial'
        migrations.append((version, filepath))
    return migrations


def run_migration(conn, version: str, filepath: str) -> None:
    """Execute a single migration file and record it in _migrations."""
    print(f"  Applying migration: {version} ...")
    with open(filepath, "r", encoding="utf-8") as f:
        sql = f.read()

    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                "INSERT INTO _migrations (version) VALUES (%s);",
                (version,),
            )
        conn.commit()
        print(f"  Migration {version} applied successfully.")
    except Exception as e:
        conn.rollback()
        print(f"  ERROR applying migration {version}: {e}")
        raise


def connect_db(database_url: str):
    """Connect to PostgreSQL via psycopg3 (évite UnicodeDecodeError sur Windows/Python 3.13)."""
    url = database_url.strip().strip("\ufeff")
    return psycopg.connect(url)


def migrate(env: str | None) -> None:
    database_url = get_database_url(env)
    print(f"Connecting to database...")

    conn = connect_db(database_url)
    try:
        ensure_migrations_table(conn)
        applied = get_applied_versions(conn)
        migrations = discover_migrations()

        pending = [(v, fp) for v, fp in migrations if v not in applied]

        if not pending:
            print("All migrations are up to date.")
            return

        print(f"Found {len(pending)} pending migration(s):")
        for v, _ in pending:
            print(f"  - {v}")

        for version, filepath in pending:
            run_migration(conn, version, filepath)

        print("\nAll migrations applied successfully.")
    finally:
        conn.close()


def main() -> None:
    env = None
    if len(sys.argv) == 2:
        if sys.argv[1] in VALID_ENVS:
            env = sys.argv[1]
        else:
            print(f"Usage: python {sys.argv[0]} [{'|'.join(VALID_ENVS)}]")
            sys.exit(1)

    print(f"=== Running migrations{f' ({env.upper()})' if env else ''} ===")
    migrate(env)


if __name__ == "__main__":
    main()
