#!/bin/bash

set -euo pipefail

# --- CONFIG ---
# Define all files to include in the ZIP
FILES_TO_ADD=(
    "README.md"
    "docker-compose.yml"
    "nightscout-lucid.env"
    "up.sh"
    "down.sh"
)

# Output directory
RELEASE_DIR="./releases"

# Prefix = current date/time (YYYYMMDD-HHMMSS)
PREFIX="$(date +"%Y%m%d")"
ZIPFILE="${RELEASE_DIR}/${PREFIX}-deployment.zip"

# --- PREPARE RELEASE DIRECTORY ---
mkdir -p "$RELEASE_DIR"

# --- CHECK IF OUTPUT ZIP ALREADY EXISTS ---
if [[ -f "$ZIPFILE" ]]; then
    echo "ERROR: Output file already exists: $ZIPFILE"
    echo "Aborting to avoid overwriting."
    exit 1
fi

# --- CHECK INPUT FILES ---
for f in "${FILES_TO_ADD[@]}"; do
    if [[ ! -f "$f" ]]; then
        echo "ERROR: Required file '$f' not found."
        exit 1
    fi
done

# --- CREATE ZIP ---
echo "Creating $ZIPFILE ..."
if ! zip "$ZIPFILE" "${FILES_TO_ADD[@]}"; then
    echo "ERROR: zip command failed."
    exit 1
fi

# --- TEST ZIP INTEGRITY ---
echo "Testing ZIP integrity..."
if zip -Tv "$ZIPFILE" >/dev/null 2>&1; then
    echo "ZIP OK: $ZIPFILE created successfully."
else
    echo "ERROR: ZIP integrity test failed. Removing bad ZIP file!"
    rm -f "$ZIPFILE"
    exit 1
fi
