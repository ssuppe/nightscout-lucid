#!/bin/bash

# docker-deploy/test_deployment.sh
# Validation test for Docker Compose schema and release zip packaging integrity.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== 1. Validating Docker Compose Configuration ==="
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" config > /dev/null
echo "✓ Docker Compose YAML schema is valid."

echo "=== 2. Testing Release Package Creation (make_release.sh) ==="
TMP_TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_TEST_DIR"' EXIT

# Copy deployment directory contents to isolated test location
cp -r "${SCRIPT_DIR}"/* "$TMP_TEST_DIR/"
cd "$TMP_TEST_DIR"

# Run release script
./make_release.sh > /dev/null

# Verify release zip was generated
ZIP_FILE=$(find ./releases -name "*-deployment.zip" | head -n 1)
if [[ -z "$ZIP_FILE" ]]; then
    echo "ERROR: Release ZIP file was not generated."
    exit 1
fi
echo "✓ Generated release artifact: $ZIP_FILE"

# Verify zip integrity
if ! zip -Tv "$ZIP_FILE" > /dev/null 2>&1; then
    echo "ERROR: Release ZIP integrity check failed."
    exit 1
fi
echo "✓ Release ZIP integrity check passed."

# Verify required files inside the zip
REQUIRED_FILES=("README.md" "docker-compose.yml" "nightscout-lucid.env" "up.sh" "down.sh")
ZIP_CONTENTS=$(unzip -l "$ZIP_FILE")

for req in "${REQUIRED_FILES[@]}"; do
    if ! echo "$ZIP_CONTENTS" | grep -q "$req"; then
        echo "ERROR: Required file '$req' missing from release ZIP."
        exit 1
    fi
done
echo "✓ All required deployment files verified inside release ZIP."

echo "=== All Docker deployment tests passed successfully! ==="
