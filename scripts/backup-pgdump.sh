#!/usr/bin/env bash
set -euo pipefail

# Restrict created dump files to owner read/write only (0600).
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"

if [[ -z "${DATABASE_URL:-}" && -f "${ENV_FILE}" ]]; then
  RAW_LINE="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | tail -n 1 || true)"
  if [[ -n "${RAW_LINE}" ]]; then
    RAW_VALUE="${RAW_LINE#DATABASE_URL=}"
    RAW_VALUE="${RAW_VALUE%\"}"
    RAW_VALUE="${RAW_VALUE#\"}"
    RAW_VALUE="${RAW_VALUE%\'}"
    RAW_VALUE="${RAW_VALUE#\'}"
    export DATABASE_URL="${RAW_VALUE}"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[pg_dump] Error: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[pg_dump] Error: pg_dump is not installed. On Ubuntu 24.04 run: sudo apt update && sudo apt install -y postgresql-client" >&2
  exit 1
fi

TIMESTAMP="$(date -u +"%Y%m%d_%H%M%S")"
BACKUP_DIR="${BACKUP_DIR:-${BACKEND_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

FILE_NAME="neon_dump_${TIMESTAMP}.sql.gz"
OUTPUT_FILE="${BACKUP_DIR}/${FILE_NAME}"

echo "[pg_dump] Starting compressed PostgreSQL dump..."
pg_dump "${DATABASE_URL}" --no-owner --no-acl --clean --if-exists | gzip -9 > "${OUTPUT_FILE}"

gzip -t "${OUTPUT_FILE}"
if [[ ! -s "${OUTPUT_FILE}" ]]; then
  echo "[pg_dump] Error: generated dump file is empty." >&2
  rm -f "${OUTPUT_FILE}"
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  (cd "${BACKUP_DIR}" && sha256sum "${FILE_NAME}" > "${FILE_NAME}.sha256")
fi

if [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] && (( RETENTION_DAYS > 0 )); then
  find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'neon_dump_*.sql.gz*' -mtime "+${RETENTION_DAYS}" -delete
fi

echo "[pg_dump] Backup completed: ${OUTPUT_FILE}"
