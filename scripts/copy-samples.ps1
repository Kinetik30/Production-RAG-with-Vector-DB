# Copies the sample dataset into ./data so the app can run without the full CSVs.
# NOTE: run this only on a fresh/empty data dir, or it will mix sample + full data.
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "sample-data\*.csv"
$dest = Join-Path $root "data"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path $src -Destination $dest -Force
Write-Host "Sample dataset copied to data/. Delete data/*.csv and re-run to reset."
