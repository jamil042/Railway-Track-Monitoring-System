#!/bin/bash
# start_public.sh — Backend + Vite + Cloudflare Tunnel ek sathe chalu kore
# Kal university te present korte ei script chalaben:
#   bash start_public.sh

cd "$(dirname "$0")"

echo "[1/3] Starting backend..."
cd backend && bash -c 'nohup npx tsx src/server.ts > /tmp/backend.log 2>&1 &' 
cd ..
sleep 12

echo "[2/3] Starting frontend..."
bash -c 'nohup npx vite --host 0.0.0.0 --port 8443 > /tmp/vite.log 2>&1 &'
sleep 10

echo "[3/3] Starting Cloudflare Tunnel..."
bash -c "nohup $HOME/cloudflared tunnel --url http://localhost:8443 > $HOME/cf_public.log 2>&1 &"
sleep 15

TUNNEL_URL=$(grep -o 'https://[a-z-]*\.trycloudflare\.com' "$HOME/cf_public.log" | tail -1)

echo ""
echo "============================================"
echo "  Railway Track Monitoring System LIVE"
echo "============================================"
echo ""
echo "  Local:   http://localhost:8443"
echo "  Public:  $TUNNEL_URL"
echo ""
echo "  Share this link with anyone:"
echo "  $TUNNEL_URL"
echo ""
echo "  Press Ctrl+C to stop all services."
echo "============================================"
echo ""

# Keep script running, cleanup on Ctrl+C
trap "echo 'Stopping...'; pkill -f cloudflared; pkill -f 'vite.*8443'; pkill -f 'tsx src/server'; echo 'All services stopped.'; exit 0" INT TERM
wait
