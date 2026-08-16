"""
camera_test.py
----------------
YOLO/serial ছাড়া শুধু camera কাজ করছে কিনা টেস্ট করার জন্য। এটা চালিয়ে যদি একটা
frame ঠিকমতো capture + save হয়, তাহলে বুঝবে camera setup ঠিক আছে — এরপর
yolo_detector.py চালানো নিরাপদ।

Usage:
    python3 camera_test.py            # USB/webcam (cv2.VideoCapture)
    python3 camera_test.py --pi       # Raspberry Pi Camera Module (picamera2)
"""

import sys
import time

import cv2

USE_PICAMERA = "--pi" in sys.argv
CAMERA_INDEX = 0
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
SAVE_PATH = "camera_test_output.jpg"


def test_usb_camera():
    print(f"[TEST] Opening USB/webcam at index {CAMERA_INDEX}...")
    cap = cv2.VideoCapture(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    if not cap.isOpened():
        print("[FAIL] Camera open করা যায়নি। চেক করো:")
        print("  - `ls /dev/video*` দিয়ে camera device আছে কিনা দেখো")
        print("  - CAMERA_INDEX ঠিক আছে কিনা (0, 1, 2... try করো)")
        print("  - অন্য কোনো প্রোগ্রাম camera ব্যবহার করছে কিনা")
        return False

    # প্রথম কয়েকটা frame ফেলে দেওয়া হচ্ছে (অনেক camera warm-up লাগে)
    for _ in range(5):
        cap.read()
        time.sleep(0.1)

    ok, frame = cap.read()
    cap.release()

    if not ok or frame is None:
        print("[FAIL] Camera খুলল কিন্তু frame read করা যায়নি।")
        return False

    cv2.imwrite(SAVE_PATH, frame)
    print(f"[OK] Frame captured — shape={frame.shape} — saved to {SAVE_PATH}")
    print("      এই ছবিটা খুলে দেখো, ক্লিয়ার/ঠিক angle আছে কিনা যাচাই করো।")
    return True


def test_picamera():
    print("[TEST] Opening Raspberry Pi Camera (picamera2)...")
    try:
        from picamera2 import Picamera2
    except ImportError:
        print("[FAIL] picamera2 ইনস্টল নেই। চালাও:")
        print("  sudo apt install -y python3-picamera2")
        return False

    picam2 = Picamera2()
    cfg = picam2.create_preview_configuration(
        main={"size": (FRAME_WIDTH, FRAME_HEIGHT), "format": "RGB888"}
    )
    picam2.configure(cfg)
    picam2.start()
    time.sleep(2)  # sensor warm-up

    frame = picam2.capture_array()
    picam2.stop()

    if frame is None:
        print("[FAIL] Frame capture করা যায়নি।")
        return False

    # RGB888 -> BGR (cv2.imwrite BGR আশা করে)
    frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    cv2.imwrite(SAVE_PATH, frame_bgr)
    print(f"[OK] Frame captured — shape={frame.shape} — saved to {SAVE_PATH}")
    return True


if __name__ == "__main__":
    success = test_picamera() if USE_PICAMERA else test_usb_camera()
    sys.exit(0 if success else 1)