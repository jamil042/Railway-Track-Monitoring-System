###############################################################################
# start_system.ps1
# -----------------------------------------------------------------------------
# Ei script diye pura Railway Monitoring System Windows PC-te chalu kore:
#   1. Backend API server
#   2. Frontend (Vite dev server)
#   3. camera_stream.py  (camera + YOLO)
#   4. sensor_fusion_dashboard.py  (ESP32 serial + fusion + telemetry)
#
# Ctrl+C dile shob bondho hoy.
#
# Run:  .\start_system.ps1
###############################################################################

$ErrorActionPreference = "Stop"

$BACKEND_DIR = "$PSScriptRoot\backend"
$BACKEND_CMD = "npm run dev"

$FRONTEND_DIR = $PSScriptRoot
$FRONTEND_CMD = "npm run dev"

$HARDWARE_DIR = "$PSScriptRoot\hardware"
$CAMERA_CMD = "python camera_stream.py"
$FUSION_CMD = "python sensor_fusion_dashboard.py"

try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp).IPAddress | Select-Object -First 1
    if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' }).IPAddress | Select-Object -First 1 }
} catch { $ip = "localhost" }
if (-not $ip) { $ip = "localhost" }

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  RAILWAY MONITORING SYSTEM - WINDOWS LAUNCHER" -ForegroundColor Cyan
Write-Host "  PC IP: $ip" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$env:VITE_API_URL = "http://${ip}:5000"
Write-Host "[ENV] VITE_API_URL=$env:VITE_API_URL" -ForegroundColor Yellow

$global:processes = @()

function Cleanup {
    Write-Host "`n[STOP] Shob process bondho kora hocche..." -ForegroundColor Red
    foreach ($p in $global:processes) {
        if (-not $p.HasExited) { $p.Kill() }
    }
    Write-Host "[STOP] Done." -ForegroundColor Red
}

function Start-ProcessAndTrack($Name, $Dir, $Cmd) {
    Write-Host "[START] $Name -> $Cmd  (dir: $Dir)" -ForegroundColor Green
    $p = Start-Process -NoNewWindow -PassThru -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "Set-Location '$Dir'; $Cmd"
    $global:processes += $p
    Write-Host "        PID=$($p.Id)" -ForegroundColor Gray
}

[Console]::TreatControlCAsInput = $true
Register-ObjectEvent -InputObject ([Console]) -EventName "CancelKeyPress" -Action { Cleanup } | Out-Null

Start-ProcessAndTrack "backend" $BACKEND_DIR $BACKEND_CMD
Start-Sleep -Seconds 2

Start-ProcessAndTrack "frontend" $FRONTEND_DIR $FRONTEND_CMD
Start-Sleep -Seconds 1

Start-ProcessAndTrack "camera_stream" $HARDWARE_DIR $CAMERA_CMD
Start-Sleep -Seconds 2

Start-ProcessAndTrack "sensor_fusion" $HARDWARE_DIR $FUSION_CMD

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SHOB PROCESS CHALU - access koro:" -ForegroundColor Cyan
Write-Host "  Frontend      : http://${ip}:8443" -ForegroundColor White
Write-Host "  Backend API   : http://${ip}:5000" -ForegroundColor White
Write-Host "  Camera stream : http://${ip}:8081/stream" -ForegroundColor White
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Bondho korte: Ctrl+C" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan

while ($true) { Start-Sleep -Seconds 1 }