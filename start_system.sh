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
BACKEND_START_CMD="npm run dev"          # TODO: tomar backend jeta die start hoy
                                          #   Node/Express hole: npm run dev / npm start
                                          #   Django hole:      python manage.py runserver 0.0.0.0:5000
                                          #   FastAPI hole:      uvicorn main:app --host 0.0.0.0 --port 5000

FRONTEND_DIR="./frontend"
FRONTEND_START_CMD="npm run dev -- --host 0.0.0.0"   # Vite dev server, LAN-e accessible

RAILWAY_DIR="./railway"                  # camera_stream.py, sensor_fusion_dashboard.py ei folder-e
# ==============================================================================

# --- Pi-r nijer LAN IP auto-detect kora hocche (multiple interface thakle first ta) ---
PI_IP=$(hostname -I | awk '{print $1}')
if [ -z "$PI_IP" ]; then
    echo "[WARN] Pi-r IP auto-detect kora jayni — 'hostname -I' diye nijer IP boshao."
    PI_IP="localhost"
fi

echo "===================================================="
echo "  RAILWAY MONITORING SYSTEM — CENTRAL LAUNCHER"
echo "  Pi IP: $PI_IP"
echo "===================================================="

# Frontend-er API call gula jeno Pi-r nijer localhost-er bodole ei IP-e jay,
# sheijonno environment variable diye pathano hocche. Tomar api/ config file-e
# eituku add koro (Vite hole):
#   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export VITE_API_URL="http://${PI_IP}:5000"
echo "[ENV] VITE_API_URL=$VITE_API_URL  (frontend-er api config-e eita use koro)"

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
sleep 2   # backend-ke port bind korar shamanyo shomoy dao

# 2. Frontend
start_process "frontend" "$FRONTEND_DIR" "$FRONTEND_START_CMD"
sleep 1

# 3. Camera stream (camera-r ekmatro owner)
# Tomar external/USB camera ache bole "--pi" flag deya hoyni — USB webcam
# default. Pi Camera Module use korle "python3 camera_stream.py --pi" koro.
start_process "camera_stream" "$RAILWAY_DIR" "python3 camera_stream.py"
sleep 2   # YOLO model load howar shomoy dao

# 4. Sensor fusion (ESP32 serial + camera_stream theke detection poll)
start_process "sensor_fusion" "$RAILWAY_DIR" "python3 sensor_fusion_dashboard.py"

echo ""
echo "===================================================="
echo "  SHOB PROCESS CHALU — access koro:"
echo "  Frontend      : http://${PI_IP}:5173"
echo "  Backend API   : http://${PI_IP}:5000"
echo "  Camera stream : http://${PI_IP}:8081/stream"
echo "===================================================="
echo "  Log dekhte: tail -f /tmp/<name>.log"
echo "  Bondho korte: Ctrl+C"
echo "===================================================="

wait