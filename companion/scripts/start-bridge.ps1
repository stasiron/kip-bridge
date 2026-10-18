# Knowledge Is Power — local bridge (Windows)
# Run from companion/ after: npm install ; npm run build

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path "web\out\index.html")) {
  Write-Host "Building static frontend..."
  npm run build
}

Write-Host ""
Write-Host "Starting bridge on port 8787..."
Write-Host "1. Note the Join code printed below."
Write-Host "2. On iPhone Safari open one of the printed http://LAN:8787/ URLs (same Wi-Fi as PS4/PS5)."
Write-Host "3. Allow Node.js through Windows Firewall if prompted (Private networks)."
Write-Host "4. UDP 9060 binds only after a phone joins with the code."
Write-Host ""

npm start
