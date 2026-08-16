"""
iot_ingest.py
---------------
ESP32 sensor node-এর live serial ডেটা পড়ে Railway Monitoring backend-এ
(Express API) push করার স্ক্রিপ্ট। backend-এর public ingest endpoint:
    POST /api/sensor-readings

Mapping (ESP32 JSON keys -> backend track + sensor_type):
    V1/I1/U1 -> TR-001 (sensor group 1)
    V2/I2/U2 -> TR-002 (sensor group 2)

Usage (Pi-তে):
    python3 iot_ingest.py                          # সব sensor
    python3 iot_ingest.py --port /dev/ttyUSB0      # অন্য port
    python3 iot_ingest.py --api http://192.168.0.103:5000
"""

import argparse
import json
import time

import requests
import serial

# ==================== CONFIG ====================
DEFAULT_PORT = "/dev/ttyACM0"
BAUD_RATE = 115200
DEFAULT_API = "http://192.168.0.103:5000"          # laptop-এ চলা backend
DEVICE_ID = 1          # seed-এ id 1 = "ESP32 Node - Kamalapur A"

# Sensor 1 (V1/I1/U1) -> TR-001, Sensor 2 (V2/I2/U2) -> TR-002.
# এতে ২টা track-card এ প্রতিটা আলাদা sensor-group-এর live data দেখাবে।
SENSOR_KEYS = {
    "V1": ("vibration", "TR-001"),
    "I1": ("ir_beam", "TR-001"),
    "U1": ("ultrasonic", "TR-001"),
    "V2": ("vibration", "TR-002"),
    "I2": ("ir_beam", "TR-002"),
    "U2": ("ultrasonic", "TR-002"),
}

UNITS = {"vibration": "count/500ms", "ir_beam": "0=fault", "ultrasonic": "cm"}


def push_reading(api: str, device_id: int, sensor_type: str, track_id: str, value, unit: str):
    payload = {
        "deviceId": device_id,
        "trackId": track_id,
        "sensorType": sensor_type,
        "value": value,
        "unit": unit,
    }
    try:
        r = requests.post(f"{api}/api/sensor-readings", json=payload, timeout=5)
        return r.status_code
    except requests.RequestException as e:
        print(f"    [ERR] {e}")
        return 0


def main():
    ap = argparse.ArgumentParser(description="ESP32 -> backend telemetry ingest")
    ap.add_argument("--port", default=DEFAULT_PORT)
    ap.add_argument("--api", default=DEFAULT_API)
    ap.add_argument("--device-id", type=int, default=DEVICE_ID)
    ap.add_argument("--reconnect-delay", type=float, default=3.0,
                    help="USB disconnect হলে কত সেকেন্ড পরে আবার চেষ্টা করবে")
    args = ap.parse_args()

    print(f"[INGEST] Serial {args.port} -> {args.api}/api/sensor-readings")
    print(f"[INGEST] deviceId={args.device_id}  (sensor1->TR-001, sensor2->TR-002)")

    pushed = 0

    def open_serial():
        while True:
            try:
                return serial.Serial(args.port, BAUD_RATE, timeout=1)
            except (serial.SerialException, OSError) as e:
                print(f"[!] {args.port} পাওয়া যায়নি ({e}), {args.reconnect_delay:.0f}s পরে আবার চেষ্টা...")
                time.sleep(args.reconnect_delay)

    ser = open_serial()
    time.sleep(2)  # ESP32 রিস্টার্ট হওয়ার সময়টুকু

    try:
        while True:
            try:
                if ser.in_waiting > 0:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if not (line.startswith("{") and line.endswith("}")):
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    print(f"[{time.strftime('%H:%M:%S')}] {line}")

                    for key, (sensor_type, track_id) in SENSOR_KEYS.items():
                        if key not in data:
                            continue
                        code = push_reading(args.api, args.device_id, sensor_type, track_id,
                                            data[key], UNITS[sensor_type])
                        if code == 201:
                            pushed += 1
                        elif code:
                            print(f"    {key} -> HTTP {code}")

                time.sleep(0.2)
            except (serial.SerialException, OSError) as e:
                print(f"[!] Serial হারিয়েছে ({e}) — পুনরায় সংযোগ করছি...")
                try:
                    ser.close()
                except Exception:
                    pass
                time.sleep(args.reconnect_delay)
                ser = open_serial()
    except KeyboardInterrupt:
        print(f"\nStopped — total pushed: {pushed}")
    finally:
        ser.close()


if __name__ == "__main__":
    main()