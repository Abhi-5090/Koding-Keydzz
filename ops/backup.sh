#!/usr/bin/env bash
#
# Take a backup of the Koding Keydzz database.
#
#   MONGO_URI="mongodb+srv://…" ops/backup.sh [output-dir]
#
# Produces ONE gzipped archive rather than a directory tree, so it can be
# checksummed, copied and verified as a unit — a half-copied archive fails its
# checksum instead of restoring quietly with missing collections.
#
# See ops/BACKUP.md for schedule, retention and the restore rehearsal.
set -euo pipefail

OUT_DIR="${1:-$(cd "$(dirname "$0")" && pwd)/backups}"

if [[ -z "${MONGO_URI:-}" ]]; then
  echo "error: MONGO_URI is not set." >&2
  echo "  Export it rather than typing it inline, so a copied command cannot" >&2
  echo "  dump the wrong cluster." >&2
  exit 1
fi

if ! command -v mongodump >/dev/null 2>&1; then
  echo "error: mongodump not found. Install the MongoDB Database Tools." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y-%m-%d-%H%M)"
ARCHIVE="$OUT_DIR/kk-$STAMP.archive.gz"

# The database NAME is echoed, never the URI — a URI carries credentials and
# this output goes into cron mail and CI logs.
DB_NAME="$(printf '%s' "$MONGO_URI" | sed -E 's|^.*@[^/]+/||; s|\?.*$||')"
echo "Backing up database '${DB_NAME:-<default>}' -> $ARCHIVE"

mongodump --uri="$MONGO_URI" --archive="$ARCHIVE" --gzip --quiet

# A checksum beside the archive, so a restore can prove the file is intact
# before it starts overwriting anything.
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
fi

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "Done: $ARCHIVE ($SIZE)"
echo
echo "Copy this off the database host. A backup that only exists beside the"
echo "database survives an operator mistake and nothing else."
