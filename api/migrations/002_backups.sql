-- ============================================================
-- Migration 002_backups
-- Table pour le suivi des backups (cron)
-- ============================================================

CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  s3_key TEXT NOT NULL,
  filename TEXT NOT NULL
);
