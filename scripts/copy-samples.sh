#!/usr/bin/env bash
# Copies the sample dataset into ./data so the app can run without the full CSVs.
# NOTE: run this only on a fresh/empty data dir, or it will mix sample + full data.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data
cp sample-data/*.csv data/
echo "Sample dataset copied to data/. Delete data/*.csv and re-run to reset."
