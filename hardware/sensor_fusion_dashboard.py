"""
sensor_fusion_dashboard.py
---------------------------
pi_serial_test.py (ESP32 sensor থ্রেড) + yolo_detector.py (camera থ্রেড) — দুইটাকে
একসাথে চালিয়ে final Fault Score / Status বের করে টার্মিনালে দেখায়, এবং backend-এ
telemetry + alert পাঠায় (Monitoring.tsx dashboard-এর জন্য)।

Weight (proposal অনুযায়ী, পরে calibration data দিয়ে টিউন করবে):
    Final Score = AI×0.50 + Vibration×0.20 + Distance×0.15 + IR×0.15

Run:
    python3 sensor_fusion_dashboard.py
"""

import json
import os
import threading
import time
from datetime import datetime

import requests
import serial

# আগে এখানে yolo_detector.py-এর CameraWorker চালিয়ে এই স্ক্রিপ্ট নিজেই camera খুলত।
# কিন্তু camera_stream.py-ও একই camera খুলতে চায় (browser stream + YOLO overlay
# দেখানোর জন্য) — Pi-র camera একবারে একজন-ই ব্যবহার করতে পারে, তাই দুটো প্রসেস
# একসাথে চললে conflict হতো। এখন camera_stream.py-কেই একমাত্র camera-owner রাখা
# হয়েছে; এই স্ক্রিপ্ট শুধু তার /detection endpoint থেকে HTTP দিয়ে সর্বশেষ
# detection result নিয়ে আসে।
CAMERA_STREAM_URL = "http://localhost:8082"


class SimpleCamResult:
    """camera_stream.py-এর /detection JSON কে yolo_detector.DetectionResult-এর
    মতো attribute access দেয়, যাতে draw_fused_dashboard()/send_alert_to_backend()
    কোনো পরিবর্তন ছাড়াই কাজ করে।"""

    def __init__(self, data: dict):
        self.timestamp = data.get("timestamp", 0)
        self.ai_score = data.get("ai_score", 0.0)
        self.ai_status = data.get("ai_status", "NORMAL")
        self.top_defect = data.get("top_defect")
        self.top_confidence = data.get("top_confidence", 0.0)
        self.fastener_detected_count = data.get("fastener_detected_count", 0)
        self.missing_fastener = data.get("missing_fastener", False)
        self.detections = data.get("detections", [])


def fetch_camera_detection():
    """camera_stream.py চালু না থাকলে/আগে detection না হয়ে থাকলে None রিটার্ন করে —
    dashboard তখন AI score=0 ধরে বাকি সেন্সর দিয়েই চলতে থাকবে।"""
    try:
        resp = requests.get(f"{CAMERA_STREAM_URL}/detection", timeout=1)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("available"):
            return None
        return SimpleCamResult(data)
    except Exception:
        return None

# ==================== CONFIG ====================
SERIAL_PORT = "/dev/ttyACM0"
BAUD_RATE = 115200

BACKEND_URL = "http://localhost:5000"
DEVICE_ID = 1
# এখন single-track prototype বলে হার্ডকোড করা — একাধিক track/ESP32 node হলে এখানে
# device serial number অনুযায়ী trackId mapping বসাও
# Prottek station er prothonom track (TR-001, TR-006, TR-011, ... TR-056) —
# ek e camera + ESP32 er live data shob gulote jabe (12 station x 1 card).
TRACK_IDS = [f"TR-{str(seq).zfill(3)}" for seq in range(1, 61, 5)]
TRACK_ID = TRACK_IDS[0]  # alert message er jonno

# --- Calibration baselines (prototype hardware spec) ---
# Ultrasonic: mounted 20cm above track
#   ≤20cm → normal, 20-25cm → warning, >25cm → critical (track displaced)
ULTRASONIC_NORMAL_CM = 20.0
ULTRASONIC_WARNING_CM = 25.0

# Vibration: SW-420 pulse count per 500ms window
#   Normal 25-30 Hz ≈ 12-15 pulses → safe
#   Resonance 50-80 Hz ≈ 25-40 pulses → warning
#   High-freq defect 100-400 Hz ≥ 50 pulses → critical
VIBRATION_WARNING_COUNT = 25     # 50 Hz — Resonance & Looseness range
VIBRATION_CRITICAL_COUNT = 50    # 100 Hz — High-Frequency Defect range

WEIGHTS = {"ai": 0.50, "vibration": 0.20, "distance": 0.15, "ir": 0.15}
FUSION_INTERVAL = 1.0             # সেকেন্ডে একবার fused score বের করবে

STATUS_THRESHOLDS = [(30, "NORMAL"), (60, "WARNING"), (100, "EMERGENCY")]

# --- Debounce থ্রেশহোল্ড: একবার raw score স্পাইক করলেই সাথে সাথে alert না দিয়ে,
#     পরপর এতগুলো reading একই (বা বেশি severe) status দেখালে তবেই confirmed status
#     পরিবর্তন হবে। এতে সেন্সর নয়েজ/momentary glitch-এ false EMERGENCY আসবে না।
DEBOUNCE_COUNT = {"WARNING": 2, "EMERGENCY": 3}   # NORMAL এ ফেরত আসতে debounce লাগবে না
STATUS_RANK = {"NORMAL": 0, "WARNING": 1, "EMERGENCY": 2}


# ==================== Serial (ESP32) worker ====================
class SerialWorker(threading.Thread):
    def __init__(self, port=SERIAL_PORT, baud=BAUD_RATE):
        super().__init__(daemon=True)
        self.port = port
        self.baud = baud
        self.latest = {}
        self._lock = threading.Lock()
        self._stop_flag = threading.Event()

    def run(self):
        try:
            ser = serial.Serial(self.port, self.baud, timeout=1)
            time.sleep(2)  # ESP32 রিস্টার্ট হওয়ার সময়টুকু অপেক্ষা
        except serial.SerialException as e:
            print(f"[Serial] Could not open {self.port}: {e}")
            return

        while not self._stop_flag.is_set():
            if ser.in_waiting > 0:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if line.startswith("{") and line.endswith("}"):
                    try:
                        data = json.loads(line)
                        with self._lock:
                            self.latest = data
                    except json.JSONDecodeError:
                        pass
        ser.close()

    def get_latest(self):
        with self._lock:
            return dict(self.latest)

    def stop(self):
        self._stop_flag.set()


# ==================== Scoring functions ====================
def score_vibration(v1, v2):
    v = max(v1, v2)
    if v >= VIBRATION_CRITICAL_COUNT:
        return 100.0
    if v >= VIBRATION_WARNING_COUNT:
        span = VIBRATION_CRITICAL_COUNT - VIBRATION_WARNING_COUNT
        return 30 + 70 * (v - VIBRATION_WARNING_COUNT) / max(span, 1)
    return 30 * (v / max(VIBRATION_WARNING_COUNT, 1))


def score_distance(u1, u2):
    readings = [u for u in (u1, u2) if u and u > 0]
    if not readings:
        return 60.0
    # INVERTED: >20cm = warning, >25cm = critical
    max_reading = max(readings)
    if max_reading > ULTRASONIC_WARNING_CM:
        return 100.0  # critical
    if max_reading > ULTRASONIC_NORMAL_CM:
        # Linear warning: 20cm→30, 25cm→80
        return 30 + 50 * (max_reading - ULTRASONIC_NORMAL_CM) / (ULTRASONIC_WARNING_CM - ULTRASONIC_NORMAL_CM)
    return 0.0  # ≤20cm = normal


def score_ir(i1, i2):
    faults = sum(1 for i in (i1, i2) if i == 0)
    return {0: 0.0, 1: 60.0, 2: 100.0}[faults]


def status_from_score(score):
    for threshold, label in STATUS_THRESHOLDS:
        if score <= threshold:
            return label
    return "EMERGENCY"


class StatusDebouncer:
    """
    Raw status প্রতি reading-এ ওঠানামা করলেও, শুধু consecutive reading-এ
    DEBOUNCE_COUNT[label] বার একই বা বেশি severe status এলে তবেই confirmed
    status আপডেট হয়। NORMAL-এ নামার ক্ষেত্রে debounce লাগে না।
    """

    def __init__(self):
        self.confirmed = "NORMAL"
        self._candidate = "NORMAL"
        self._streak = 0

    def update(self, raw_status: str) -> str:
        if raw_status == "NORMAL":
            self.confirmed = "NORMAL"
            self._candidate, self._streak = "NORMAL", 0
            return self.confirmed

        if raw_status == self._candidate:
            self._streak += 1
        else:
            self._candidate, self._streak = raw_status, 1

        needed = DEBOUNCE_COUNT.get(raw_status, 1)
        if self._streak >= needed and STATUS_RANK[raw_status] >= STATUS_RANK[self.confirmed]:
            self.confirmed = raw_status

        return self.confirmed


# ==================== Dashboard ====================
COLORS = {
    "NORMAL": "\033[92m", "WARNING": "\033[93m", "EMERGENCY": "\033[91m",
    "RESET": "\033[0m", "CYAN": "\033[96m", "BOLD": "\033[1m",
}


def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


def draw_fused_dashboard(sensor_data, cam_result, scores, final_score, raw_status, confirmed_status):
    clear_screen()
    C, R, B = COLORS["CYAN"], COLORS["RESET"], COLORS["BOLD"]
    print(f"{C}{B}===================================================={R}")
    print(f"{C}{B}   RAILWAY TRACK MONITORING — SENSOR FUSION DASHBOARD{R}")
    print(f"{C}{B}===================================================={R}\n")

    print(f"{B}[ Raw Sensor Data (ESP32) ]{R}")
    print(f"  Vibration : V1={sensor_data.get('V1', 0)}  V2={sensor_data.get('V2', 0)}")
    print(f"  IR        : I1={sensor_data.get('I1', 1)}  I2={sensor_data.get('I2', 1)}")
    print(f"  Ultrasonic: U1={sensor_data.get('U1', 0.0):.1f}cm  U2={sensor_data.get('U2', 0.0):.1f}cm\n")

    print(f"{B}[ Camera / YOLO ]{R}")
    if cam_result:
        print(f"  Top Defect : {cam_result.top_defect} (conf={cam_result.top_confidence:.2f})")
        print(f"  Fasteners  : {cam_result.fastener_detected_count} detected "
              f"({'MISSING!' if cam_result.missing_fastener else 'OK'})")
    else:
        print("  Waiting for first camera frame...")
    print()

    print(f"{B}[ Component Scores (0-100) ]{R}")
    print(f"  AI (Camera)  : {scores['ai']:.1f}   (weight {WEIGHTS['ai']})")
    print(f"  Vibration    : {scores['vibration']:.1f}   (weight {WEIGHTS['vibration']})")
    print(f"  Distance     : {scores['distance']:.1f}   (weight {WEIGHTS['distance']})")
    print(f"  IR           : {scores['ir']:.1f}   (weight {WEIGHTS['ir']})\n")

    raw_color = COLORS.get(raw_status, "")
    confirmed_color = COLORS.get(confirmed_status, "")
    print(f"{B}FINAL FAULT SCORE: {final_score:.1f}/100{R}")
    print(f"  Raw Status       : {raw_color}{raw_status}{R}  (this reading only)")
    print(f"  Confirmed Status : {confirmed_color}{B}{confirmed_status}{R}  "
          f"(after debounce — used for alerts)")
    print(f"\n{C}===================================================={R}")
    print("Press Ctrl+C to stop monitoring.")


# ==================== Backend API Integration ====================
def send_alert_to_backend(confirmed_status, cam_result, sensor_data, final_score):
    try:
        # role field TA-OMRA: backend er login e role lagbe, na hole 400
        login_resp = requests.post(f"{BACKEND_URL}/api/auth/login", json={
            "role": "railway_administrator",
            "username": "admin",
            "password": "admin123"
        }, timeout=3)
        login_resp.raise_for_status()
        token = login_resp.json().get("token")

        headers = {"Authorization": f"Bearer {token}"}

        severity = "critical" if confirmed_status == "EMERGENCY" else "high"
        fault_type = "Multiple Issues"
        if cam_result and getattr(cam_result, 'top_defect', None) and cam_result.top_defect != "None":
            fault_type = cam_result.top_defect
        elif final_score > 50:
            fault_type = "Sensor Anomaly"

        # stationId "AUTO" = backend je station e shesh login korse sei
        # station er fault/alert banabe (single-device demo mode).
        fault_payload = {
            "stationId": "AUTO",
            "trackId": "",
            "faultType": fault_type,
            "severity": severity,
            "status": "active",
            "aiConfidence": float(cam_result.top_confidence * 100) if cam_result and getattr(cam_result, 'top_confidence', None) else 0.0,
            "sensorValues": sensor_data,
            "description": f"Auto-detected by sensor fusion. Score: {final_score:.1f}/100"
        }
        try:
            fault_resp = requests.post(f"{BACKEND_URL}/api/faults", json=fault_payload, headers=headers, timeout=3)
            fault_resp.raise_for_status()
            fault_id = fault_resp.json().get("id")

            alert_payload = {
                "faultId": fault_id,
                "deviceId": DEVICE_ID,
                "destination": "station_display",
                "channel": "lora",
                "message": f"{confirmed_status} Alert: {fault_type} detected by live sensor",
                "severity": severity,
                "stationId": "AUTO"
            }
            requests.post(f"{BACKEND_URL}/api/alerts", json=alert_payload, headers=headers, timeout=3)
        except Exception:
            pass

    except Exception:
        pass  # Silently fail if backend is not running during prototype


def send_telemetry_to_backend(sensor_data, cam_result=None):
    """
    ESP32-এর raw sensor_data থেকে তিনটা reading তৈরি করে backend-এ পাঠায়, যেগুলো
    Monitoring.tsx-এর TrackCard তিনটা card-এ দেখায়:
      - "vibration"  -> Vibration card (raw pulse count, unit "count")
      - "ultrasonic" -> Disp. card (baseline থেকে deviation, mm-এ কনভার্ট করা)
      - "ir_beam"    -> Object card (0 = obstacle/gap detected, 1 = clear)

    ir_beam এখন camera YOLO detection-ও combine করে: hardware IR beam NA thakle
    (ba thakleo) camera-te object detect holei obstacle dikhabe.
    """
    if not sensor_data and cam_result is None:
        return

    now = datetime.utcnow().isoformat() + "Z"
    readings = []

    # --- Object/obstacle state: shudhu hardware IR sensor theke ---
    # (camera YOLO detection object card e count hoy na)
    has_ir_hw = "I1" in sensor_data or "I2" in sensor_data

    if has_ir_hw:
        obstacle_state = 0 if (sensor_data.get("I1", 1) == 0 or sensor_data.get("I2", 1) == 0) else 1
        readings.append({"sensorType": "ir_beam", "value": obstacle_state, "unit": "state"})

    if "V1" in sensor_data or "V2" in sensor_data:
        vib = max(sensor_data.get("V1", 0), sensor_data.get("V2", 0))
        readings.append({"sensorType": "vibration", "value": float(vib), "unit": "count"})

    # Ultrasonic validation: rail-er normal distance ~10-40cm. Er baire
    # (2cm er kom ba 100cm er beshi) mane sensor echo pachhe na — invalid,
    # status flicker arokkam kore tai baddho ignore kora hoy.
    u_vals = [v for v in (sensor_data.get("U1"), sensor_data.get("U2"))
              if v is not None and 2 <= v <= 100]
    if u_vals:
        avg_u = sum(u_vals) / len(u_vals)
        # Raw distance (cm) pathai — kachle kom, dure gele beshi
        displacement_cm = round(avg_u, 1)
        readings.append({"sensorType": "ultrasonic", "value": displacement_cm, "unit": "cm"})

    for r in readings:
        for track_id in TRACK_IDS:
            try:
                requests.post(f"{BACKEND_URL}/api/sensor-readings", json={
                    "deviceId": DEVICE_ID,
                    "trackId": track_id,
                    "recordedAt": now,
                    **r,
                }, timeout=1)
            except Exception:
                pass


# ==================== Main loop ====================
def main():
    serial_worker = SerialWorker()
    serial_worker.start()

    print(f"[Camera] Reading detections from {CAMERA_STREAM_URL}/detection "
          f"(camera_stream.py আলাদা করে চালু থাকতে হবে)")

    debouncer = StatusDebouncer()
    prev_confirmed = "NORMAL"

    try:
        while True:
            sensor_data = serial_worker.get_latest()
            cam_result = fetch_camera_detection()

            ai_score = cam_result.ai_score if cam_result else 0.0
            vib_score = score_vibration(sensor_data.get("V1", 0), sensor_data.get("V2", 0))
            dist_score = score_distance(sensor_data.get("U1", 0.0), sensor_data.get("U2", 0.0))
            ir_score = score_ir(sensor_data.get("I1", 1), sensor_data.get("I2", 1))

            scores = {"ai": ai_score, "vibration": vib_score, "distance": dist_score, "ir": ir_score}
            final_score = sum(scores[k] * WEIGHTS[k] for k in WEIGHTS)
            raw_status = status_from_score(final_score)
            confirmed_status = debouncer.update(raw_status)

            draw_fused_dashboard(sensor_data, cam_result, scores, final_score,
                                  raw_status, confirmed_status)

            # Send continuous telemetry to backend (vibration + displacement + ir)
            threading.Thread(target=send_telemetry_to_backend, args=(sensor_data, cam_result), daemon=True).start()

            if confirmed_status != prev_confirmed and confirmed_status in ("WARNING", "EMERGENCY"):
                threading.Thread(
                    target=send_alert_to_backend,
                    args=(confirmed_status, cam_result, sensor_data, final_score),
                    daemon=True
                ).start()
            prev_confirmed = confirmed_status

            time.sleep(FUSION_INTERVAL)
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user.")
    finally:
        serial_worker.stop()


if __name__ == "__main__":
    main()