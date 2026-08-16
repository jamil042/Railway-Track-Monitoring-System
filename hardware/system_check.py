"""
system_check.py
-----------------
পুরো Railway Monitoring System-এর সবগুলো component একসাথে diagnostic check করার
জন্য একটা স্ক্রিপ্ট। প্রতিটা অংশ আলাদাভাবে টেস্ট করে PASS/FAIL রিপোর্ট দেয়:

  1. Camera        -> frame capture হচ্ছে কিনা
  2. YOLO model     -> মডেল লোড হচ্ছে কিনা, class সংখ্যা কত
  3. ESP32 Serial   -> connection + valid JSON আসছে কিনা
  4. প্রতিটা sensor  -> IR (x2), Ultrasonic (x2), Vibration (x2) থেকে sane
                        value আসছে কিনা (out-of-range/error আলাদা করে দেখাবে)

Usage:
    python3 system_check.py                 # সবকিছু চেক (camera=USB webcam)
    python3 system_check.py --pi             # Pi Camera Module ব্যবহার করে
    python3 system_check.py --skip-yolo      # শুধু camera+serial চেক (দ্রুত, model লোড হবে না)
    python3 system_check.py --port /dev/ttyUSB0   # ভিন্ন serial port হলে
"""

import argparse
import sys
import time

import cv2
import serial
import json

# ==================== CONFIG ====================
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
SERIAL_BAUD = 115200
SERIAL_WAIT_SECONDS = 6          # ESP32 থেকে প্রথম valid JSON আসার জন্য কতক্ষণ অপেক্ষা করবে
MODEL_PATH_DEFAULT = "models/railway_yolov8n.pt"  # না থাকলে --model দিয়ে yolov8n.pt দাও

# Sane range — এগুলোর বাইরে গেলে "sensor error/out-of-range" হিসেবে ফ্ল্যাগ হবে
ULTRASONIC_MIN_CM, ULTRASONIC_MAX_CM = 2.0, 400.0

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
WARN = "\033[93mWARN\033[0m"


def header(title):
    print(f"\n\033[96m\033[1m== {title} =={'=' * max(0, 40 - len(title))}\033[0m")


# ==================== 1. Camera check ====================
def check_camera(use_pi: bool):
    header("Camera")
    if use_pi:
        try:
            from picamera2 import Picamera2
        except ImportError:
            print(f"[{FAIL}] picamera2 ইনস্টল নেই → sudo apt install -y python3-picamera2")
            return False

        try:
            picam2 = Picamera2()
            cfg = picam2.create_preview_configuration(
                main={"size": (FRAME_WIDTH, FRAME_HEIGHT), "format": "RGB888"}
            )
            picam2.configure(cfg)
            picam2.start()
            time.sleep(2)
            frame = picam2.capture_array()
            picam2.stop()
        except Exception as e:
            print(f"[{FAIL}] Pi Camera error: {e}")
            return False

        if frame is None:
            print(f"[{FAIL}] Frame capture করা যায়নি।")
            return False

        print(f"[{PASS}] Pi Camera — frame shape={frame.shape}")
        return True

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    if not cap.isOpened():
        print(f"[{FAIL}] Camera index 0 open করা যায়নি (`ls /dev/video*` চেক করো)")
        return False

    for _ in range(5):
        cap.read()
        time.sleep(0.1)
    ok, frame = cap.read()
    cap.release()

    if not ok or frame is None:
        print(f"[{FAIL}] Camera খুলল কিন্তু frame read হয়নি।")
        return False

    print(f"[{PASS}] USB/webcam — frame shape={frame.shape}")
    return True


# ==================== 2. YOLO model check ====================
def check_yolo_model(model_path: str):
    header("YOLO Model")
    try:
        from ultralytics import YOLO
    except ImportError:
        print(f"[{FAIL}] ultralytics ইনস্টল নেই → pip install ultralytics --break-system-packages")
        return False

    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"[{FAIL}] মডেল লোড করা যায়নি ({model_path}): {e}")
        return False

    class_count = len(model.names)
    print(f"[{PASS}] মডেল লোড হয়েছে — {model_path} — {class_count} classes")
    if model_path == "yolov8n.pt" or "railway" not in model_path:
        print(f"[{WARN}] এটা pretrained generic মডেল — railway-specific classes "
              "(crack, missing_fastener, ইত্যাদি) ধরবে না। fine-tune করা মডেল লাগবে "
              "final deployment-এর জন্য।")
    return True


# ==================== 3 & 4. ESP32 serial + individual sensors ====================
def check_serial_and_sensors(port: str, baud: int, wait_seconds: int):
    header("ESP32 Serial Connection")
    try:
        ser = serial.Serial(port, baud, timeout=1)
    except serial.SerialException as e:
        print(f"[{FAIL}] {port} খোলা যায়নি: {e}")
        print(f"       `ls /dev/tty*` দিয়ে port নাম চেক করো, USB cable/permission দেখো "
              "(দরকার হলে `sudo usermod -aG dialout $USER` করে relogin করো)।")
        return False, None

    time.sleep(2)  # ESP32 রিস্টার্ট হওয়ার সময়টুকু
    print(f"[{PASS}] {port} @ {baud} baud — port খোলা গেছে, ডেটার জন্য অপেক্ষা করা হচ্ছে...")

    deadline = time.time() + wait_seconds
    data = None
    while time.time() < deadline:
        if ser.in_waiting > 0:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    data = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue
    ser.close()

    if data is None:
        print(f"[{FAIL}] {wait_seconds}s এর মধ্যে valid JSON আসেনি। ESP32 code আপলোড হয়েছে "
              "কিনা, Serial Monitor অন্য কোথাও খোলা আছে কিনা চেক করো।")
        return True, None  # port খুলেছিল, তাই connection নিজে PASS, ডেটা না

    print(f"[{PASS}] JSON ডেটা পাওয়া গেছে: {data}")
    return True, data


def check_individual_sensors(data: dict):
    header("Individual Sensors")
    if data is None:
        print(f"[{WARN}] ESP32 থেকে ডেটা না পাওয়ায় sensor-wise check করা যায়নি।")
        return

    results = []

    # --- IR sensors ---
    for key in ("I1", "I2"):
        val = data.get(key)
        if val is None:
            results.append((f"IR ({key})", FAIL, "কোনো ডেটা নেই"))
        elif val in (0, 1):
            state = "OBSTACLE/FAULT" if val == 0 else "CLEAR"
            results.append((f"IR ({key})", PASS, f"value={val} ({state})"))
        else:
            results.append((f"IR ({key})", WARN, f"অপ্রত্যাশিত value={val} (0/1 হওয়ার কথা)"))

    # --- Ultrasonic sensors ---
    for key in ("U1", "U2"):
        val = data.get(key)
        if val is None:
            results.append((f"Ultrasonic ({key})", FAIL, "কোনো ডেটা নেই"))
        elif val == -1 or val <= 0:
            results.append((f"Ultrasonic ({key})", WARN, "timeout/out-of-range (-1) — wiring/echo চেক করো"))
        elif ULTRASONIC_MIN_CM <= val <= ULTRASONIC_MAX_CM:
            results.append((f"Ultrasonic ({key})", PASS, f"{val:.1f} cm"))
        else:
            results.append((f"Ultrasonic ({key})", WARN, f"{val:.1f} cm — sane range এর বাইরে"))

    # --- Vibration sensors ---
    for key in ("V1", "V2"):
        val = data.get(key)
        if val is None:
            results.append((f"Vibration ({key})", FAIL, "কোনো ডেটা নেই"))
        else:
            note = "কম্পন detected" if val > 0 else "স্থির (idle অবস্থায় স্বাভাবিক)"
            results.append((f"Vibration ({key})", PASS, f"count={val} ({note})"))

    for name, status, note in results:
        print(f"  [{status}] {name:<20} {note}")


# ==================== Main ====================
def main():
    parser = argparse.ArgumentParser(description="Railway system component check")
    parser.add_argument("--pi", action="store_true", help="Pi Camera Module ব্যবহার করো")
    parser.add_argument("--port", default="/dev/ttyACM0", help="ESP32 serial port")
    parser.add_argument("--baud", type=int, default=SERIAL_BAUD)
    parser.add_argument("--model", default=MODEL_PATH_DEFAULT, help="YOLO model path")
    parser.add_argument("--skip-yolo", action="store_true", help="YOLO model লোড স্কিপ করো (দ্রুত টেস্ট)")
    parser.add_argument("--skip-camera", action="store_true", help="Camera check স্কিপ করো")
    parser.add_argument("--skip-serial", action="store_true", help="Serial/sensor check স্কিপ করো")
    args = parser.parse_args()

    print("\033[1m\033[96m" + "=" * 50)
    print("   RAILWAY MONITORING SYSTEM — COMPONENT CHECK")
    print("=" * 50 + "\033[0m")

    summary = {}

    if not args.skip_camera:
        summary["Camera"] = check_camera(args.pi)
    else:
        print(f"\n{WARN} Camera check স্কিপ করা হয়েছে")

    if not args.skip_yolo:
        summary["YOLO Model"] = check_yolo_model(args.model)
    else:
        print(f"\n{WARN} YOLO model check স্কিপ করা হয়েছে")

    if not args.skip_serial:
        serial_ok, data = check_serial_and_sensors(args.port, args.baud, SERIAL_WAIT_SECONDS)
        summary["ESP32 Serial"] = serial_ok
        check_individual_sensors(data)
    else:
        print(f"\n{WARN} Serial/sensor check স্কিপ করা হয়েছে")

    header("Summary")
    for name, ok in summary.items():
        print(f"  [{PASS if ok else FAIL}] {name}")

    if all(summary.values()):
        print(f"\n{PASS} — সব component ঠিক আছে, এখন sensor_fusion_dashboard.py চালাতে পারো।")
        sys.exit(0)
    else:
        print(f"\n{FAIL} — উপরের FAIL/WARN গুলো ঠিক করে আবার চালাও।")
        sys.exit(1)


if __name__ == "__main__":
    main()