"""
object_detect_live.py
----------------------
torch/ultralytics ছাড়াই OpenCV দিয়ে live object/motion detection।
৩২-bit Pi-তে YOLO না চললেও ক্যামেরা + detect pipeline ঠিক আছে কিনা দেখার জন্য।

কল diteration: frame diff + contour দিয়ে moving/big object বের করে বক্স আঁকে।
শুধু টেস্ট — YOLO-র বদলে fine-tuned model আসলে ultralytics দিয়ে replace হবে।

Usage:
    python3 object_detect_live.py            # USB/webcam
    python3 object_detect_live.py --pi       # Pi Camera Module
"""

import argparse
import time

import cv2

WIDTH, HEIGHT = 640, 480
MIN_AREA = 2500          # এইটা চেয়ে বড় blob ধরা হবে (নয়েজ কমাও)


def read_usb():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
    if not cap.isOpened():
        raise RuntimeError("Camera index 0 খোলা যায়নি — `ls /dev/video*` চেক করো")
    return lambda: cap.read()[1], cap.release


def read_pi():
    try:
        from picamera2 import Picamera2
    except ImportError:
        raise RuntimeError("picamera2 নেই → sudo apt install -y python3-picamera2")
    picam2 = Picamera2()
    picam2.configure(picam2.create_preview_configuration(
        main={"size": (WIDTH, HEIGHT), "format": "RGB888"}))
    picam2.start()
    time.sleep(1)
    return (lambda: cv2.cvtColor(picam2.capture_array(), cv2.COLOR_RGB2BGR),
            picam2.stop)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pi", action="store_true")
    args = ap.parse_args()

    try:
        read, close = read_pi() if args.pi else read_usb()
    except RuntimeError as e:
        print(f"[FAIL] {e}")
        return

    print("Object detection চালু — 'q' চাপো বন্ধ করতে")
    prev = None
    while True:
        frame = read()
        if frame is None:
            time.sleep(0.05)
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        detected = False
        if prev is not None:
            diff = cv2.absdiff(prev, gray)
            thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)[1]
            thresh = cv2.dilate(thresh, None, iterations=2)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL,
                                           cv2.CHAIN_APPROX_SIMPLE)
            for c in contours:
                if cv2.contourArea(c) < MIN_AREA:
                    continue
                x, y, w, h = cv2.boundingRect(c)
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
                cv2.putText(frame, "OBJECT", (x, y - 8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                detected = True

        status = "DETECTED" if detected else "no motion"
        cv2.putText(frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
                    0.8, (0, 255, 0), 2)
        cv2.imshow("Object Detect - Live", frame)
        prev = gray

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()