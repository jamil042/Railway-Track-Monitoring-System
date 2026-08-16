"""
sensor_fusion_dashboard.py
---------------------------
pi_serial_test.py (ESP32 sensor থ্রেড) + yolo_detector.py (camera থ্রেড) — দুইটাকে
একসাথে চালিয়ে final Fault Score / Status বের করে টার্মিনালে দেখায়।

Weight (proposal অনুযায়ী, পরে calibration data দিয়ে টিউন করবে):
    Final Score = AI×0.50 + Vibration×0.20 + Distance×0.15 + IR×0.15

Run:
    python3 sensor_fusion_dashboard.py
"""

import json
import os
import threading
import time

import serial

from yolo_detector import CameraWorker

# ==================== CONFIG ====================
SERIAL_PORT = "/dev/ttyACM0"
BAUD_RATE = 115200

# --- Calibration baselines (healthy-track data দিয়ে বসাও, proposal-এর সুপারিশ) ---
ULTRASONIC_NORMAL_CM = 20.0
ULTRASONIC_WARNING_DEV = 3.0      # ±3cm পর্যন্ত Warning
ULTRASONIC_EMERGENCY_DEV = 6.0    # তার বেশি হলে Emergency

VIBRATION_WARNING_COUNT = 3       # প্রতি 500ms window-এ digital pulse count
VIBRATION_EMERGENCY_COUNT = 8

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
    if v >= VIBRATION_EMERGENCY_COUNT:
        return 100.0
    if v >= VIBRATION_WARNING_COUNT:
        # WARNING_COUNT..EMERGENCY_COUNT রেঞ্জে লিনিয়ার স্কেল করা হচ্ছে
        span = VIBRATION_EMERGENCY_COUNT - VIBRATION_WARNING_COUNT
        return 30 + 70 * (v - VIBRATION_WARNING_COUNT) / max(span, 1)
    return 30 * (v / max(VIBRATION_WARNING_COUNT, 1))


def score_distance(u1, u2):
    readings = [u for u in (u1, u2) if u and u > 0]
    if not readings:
        return 60.0  # sensor error/out-of-range হলে সন্দেহজনক ধরা হচ্ছে
    dev = max(abs(u - ULTRASONIC_NORMAL_CM) for u in readings)
    if dev >= ULTRASONIC_EMERGENCY_DEV:
        return 100.0
    if dev >= ULTRASONIC_WARNING_DEV:
        span = ULTRASONIC_EMERGENCY_DEV - ULTRASONIC_WARNING_DEV
        return 30 + 70 * (dev - ULTRASONIC_WARNING_DEV) / max(span, 1e-6)
    return 30 * (dev / max(ULTRASONIC_WARNING_DEV, 1e-6))


def score_ir(i1, i2):
    # IR=0 মানে beam ব্লক/গ্যাপ ডিটেক্টেড (fault), IR=1 মানে ক্লিয়ার
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
    status আপডেট হয়। NORMAL-এ নামার ক্ষেত্রে debounce লাগে না (তাড়াতাড়ি safe
    অবস্থায় ফিরে আসা উচিত)।
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


# ==================== Main loop ====================
def main():
    serial_worker = SerialWorker()
    serial_worker.start()

    camera_worker = CameraWorker(interval=0.8, show_window=False)
    camera_worker.start()

    debouncer = StatusDebouncer()
    prev_confirmed = "NORMAL"

    try:
        while True:
            sensor_data = serial_worker.get_latest()
            cam_result = camera_worker.get_latest()

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

            # confirmed_status বদলে EMERGENCY/WARNING হলেই একবার alert ট্রিগার করো
            # (debounce এর কারণে বারবার একই অ্যালার্ম পাঠাবে না)
            if confirmed_status != prev_confirmed and confirmed_status in ("WARNING", "EMERGENCY"):
                pass  # TODO: এখানে REST API/LoRa module-এ alert packet পাঠানোর কল বসাও
                       #       (fault type = cam_result.top_defect, location, timestamp সহ)
            prev_confirmed = confirmed_status

            time.sleep(FUSION_INTERVAL)
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user.")
    finally:
        serial_worker.stop()
        camera_worker.stop()


if __name__ == "__main__":
    main()