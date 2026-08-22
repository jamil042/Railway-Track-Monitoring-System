#!/usr/bin/env bash
###############################################################################
# start_system.sh
# -----------------------------------------------------------------------------
# Ekta script diye pura Railway Monitoring System chalu kore:
#   1. Backend API server
#   2. Frontend (Vite dev server, --host diye LAN-e accessible)
#   3. camera_stream.py  (camera owner + YOLO overlay + /detection endpoint)
#   4. sensor_fusion_dashboard.py  (ESP32 serial + fusion + backend-e telemetry)
#
# Ctrl+C dile shob process eksathe bondho hoye jabe.
#
# Run:  chmod +x start_system.sh && ./start_system.sh
###############################################################################
set -e

# ============================ CONFIG — EGULA BOSHAO ==========================
# Tomar actual folder path/start-command diye eguloke thik koro
BACKEND_DIR="./backend"
BACKEND_START_CMD="npm run dev"

FRONTEND_DIR="."                         # root folder (jekhane package.json + vite.config.ts)
FRONTEND_START_CMD="npm run dev"         # vite.config.ts e already host:'0.0.0.0', port 8443

HARDWARE_DIR="./hardware"                # camera_stream.py, sensor_fusion_dashboard.py ei folder-e
# ==============================================================================

# --- Pi-r nijer LAN IP auto-detect ---
PI_IP=$(hostname -I | awk '{print $1}')
if [ -z "$PI_IP" ]; then
    echo "[WARN] Pi-r IP auto-detect kora jayni — 'hostname -I' diye nijer IP boshao."
    PI_IP="localhost"
fi

echo "===================================================="
echo "  RAILWAY MONITORING SYSTEM — CENTRAL LAUNCHER"
echo "  Pi IP: $PI_IP"
echo "===================================================="

# --- Ashol bug fix: frontend API calls jeno Pi-r IP-e jay, localhost na ---
# `src/api/client.ts` e ei env variable ta use korte hobe:
#   const API_URL = import.meta.env.VITE_API_URL || '/api';
export VITE_API_URL="http://${PI_IP}:5000"
echo "[ENV] VITE_API_URL=$VITE_API_URL"

PIDS=()

cleanup() {
    echo ""
    echo "[STOP] Shob process bondho kora hocche..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    echo "[STOP] Done."
    exit 0
}
trap cleanup SIGINT SIGTERM

start_process() {
    local name="$1"
    local dir="$2"
    local cmd="$3"
    echo "[START] $name -> $cmd  (dir: $dir)"
    (cd "$dir" && eval "$cmd") > "/tmp/${name}.log" 2>&1 &
    PIDS+=("$!")
    echo "        PID=${PIDS[-1]}  log: /tmp/${name}.log"
}

# 1. Backend
start_process "backend" "$BACKEND_DIR" "$BACKEND_START_CMD"
sleep 2

# 2. Frontend (Vite dev server, already --host 0.0.0.0 in config)
start_process "frontend" "$FRONTEND_DIR" "$FRONTEND_START_CMD"
sleep 1

# 3. Camera stream (camera-r ekmatro owner)
start_process "camera_stream" "$HARDWARE_DIR" "python3 camera_stream.py --pi"
sleep 2

# 4. Sensor fusion (ESP32 serial + camera_stream theke detection poll)
start_process "sensor_fusion" "$HARDWARE_DIR" "python3 sensor_fusion_dashboard.py"

echo ""
echo "===================================================="
echo "  SHOB PROCESS CHALU — access koro:"
echo "  Frontend      : http://${PI_IP}:8443"
echo "  Backend API   : http://${PI_IP}:5000"
echo "  Camera stream : http://${PI_IP}:8081/stream"
echo "===================================================="
echo "  Log dekhte: tail -f /tmp/<name>.log"
echo "  Bondho korte: Ctrl+C"
echo "===================================================="

wait