#!/usr/bin/env bash
#
# Restore a Koding Keydzz backup.
#
#   ops/restore.sh <archive.gz> <target-mongo-uri>
#
# RESTORING OVERWRITES. Restore into a scratch database and inspect it first —
# ops/BACKUP.md has the full procedure and the checks worth running.
set -euo pipefail

ARCHIVE="${1:-}"
TARGET="${2:-}"

if [[ -z "$ARCHIVE" || -z "$TARGET" ]]; then
  echo "usage: ops/restore.sh <archive.gz> <target-mongo-uri>" >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "error: no such archive: $ARCHIVE" >&2
  exit 1
fi

if ! command -v mongorestore >/dev/null 2>&1; then
  echo "error: mongorestore not found. Install the MongoDB Database Tools." >&2
  exit 1
fi

# Verify the archive BEFORE touching the target. A truncated archive that
# restores "successfully" with missing collections is the worst outcome here,
# because it looks like it worked.
if [[ -f "$ARCHIVE.sha256" ]]; then
  echo "Verifying checksum…"
  if command -v shasum >/dev/null 2>&1; then
    ( cd "$(dirname "$ARCHIVE")" && shasum -a 256 -c "$(basename "$ARCHIVE").sha256" )
  else
    ( cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$ARCHIVE").sha256" )
  fi
else
  echo "warning: no .sha256 beside this archive — cannot verify it is intact." >&2
fi

DB_NAME="$(printf '%s' "$TARGET" | sed -E 's|^.*@[^/]+/||; s|\?.*$||')"

# A restore is destructive and the target is easy to get wrong, so it is
# confirmed by TYPING THE DATABASE NAME. A y/n prompt is muscle memory; this
# is not. Skip it in automation with RESTORE_YES=1.
if [[ "${RESTORE_YES:-}" != "1" ]]; then
  echo
  echo "About to restore into '${DB_NAME:-<default>}', DROPPING existing collections."
  printf "Type the database name to confirm: "
  read -r TYPED
  if [[ "$TYPED" != "$DB_NAME" ]]; then
    echo "Names do not match. Nothing was changed." >&2
    exit 1
  fi
fi

echo "Restoring…"
mongorestore --uri="$TARGET" --archive="$ARCHIVE" --gzip --drop --quiet

echo "Restored into '${DB_NAME:-<default>}'."
echo
echo "Next:"
echo "  1. cd 'Koding Keydzz Backend' && npm run migrate   # safe to re-run"
echo "  2. curl -fsS localhost:5000/api/v1/ready           # not /health"
