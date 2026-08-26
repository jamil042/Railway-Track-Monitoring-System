#!/usr/bin/env bash
# USB camera hang hole reset kore — sudo diye chalao: sudo ./reset_camera.sh
DEV=$(for d in /sys/bus/usb/devices/*/product; do grep -qiE "cam|uvc" "$d" 2>/dev/null && echo "${d%/product}"; done | head -1)
[ -z "$DEV" ] && { echo "camera USB device not found"; exit 1; }
B=$(basename "$DEV")
echo "Resetting USB camera ($B)..."
echo "$B" | sudo tee /sys/bus/usb/drivers/usb/unbind >/dev/null
sleep 2
echo "$B" | sudo tee /sys/bus/usb/drivers/usb/bind >/dev/null
sleep 4
echo "Done. Camera nodes:"; ls /dev/video* 2>/dev/null | head -5
