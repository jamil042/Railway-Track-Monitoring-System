"""
camera_live.py
----------------
ক্যামেরা ক্রমাগত চালু রেখে live video preview দেখায়, এবং (ডিফল্টভাবে) প্রতি frame-এ
YOLO দিয়ে object/defect detection চালিয়ে bounding box + label overlay করে দেখায়।
কোনো ডেটা/ফাইল save করে না — শুধু live দেখানোর জন্য। বন্ধ করতে window-এর ভেতরে
`q` চাপো অথবা Ctrl+C দাও।

আগের ভার্সনে শুধু raw preview ছিল, YOLO যোগ করা ছিল না — তাই detection হচ্ছিল না।
এখন yolo_detector.py-এর YOLODetector class ব্যবহার করে প্রতি frame-এ inference
চালানো হচ্ছে (--no-detect দিলে আগের মতো শুধু raw preview পাবে)।

Usage (SSH করে Pi-তে):
    python3 camera_live.py                    # USB/webcam + detection সহ
    python3 camera_live.py --pi                # Pi Camera Module + detection সহ
    python3 camera_live.py --model yolov8n.pt   # fine-tuned model না থাকলে pretrained দিয়ে
    python3 camera_live.py --no-detect          # শুধু raw preview, detection ছাড়া
"""

import argparse
import time

import cv2

from yolo_detector import YOLODetector, MODEL_PATH


def run_preview(use_pi: bool, do_detect: bool, model_path: str):
    detector = YOLODetector(model_path=model_path) if do_detect else None

    if use_pi:
        try:
            from picamera2 import Picamera2
        except ImportError:
            print("[FAIL] picamera2 নেই → sudo apt install -y python3-picamera2")
            return
        picam2 = Picamera2()
        cfg = picam2.create_preview_configuration(main={"size": (640, 480), "format": "RGB888"})
        picam2.configure(cfg)
        picam2.start()
        time.sleep(1)
        read_frame = lambda: cv2.cvtColor(picam2.capture_array(), cv2.COLOR_RGB2BGR)
        close_cam = picam2.stop
    else:
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        if not cap.isOpened():
            print("[FAIL] Camera index 0 খোলা যায়নি (`ls /dev/video*` চেক করো)")
            return
        read_frame = lambda: cap.read()[1]
        close_cam = cap.release

    mode = "detection সহ" if do_detect else "raw preview (detection ছাড়া)"
    print(f"Preview চালু আছে — {mode} — বন্ধ করতে window-এ 'q' চাপো (অথবা Ctrl+C)")

    try:
        while True:
            frame = read_frame()
            if frame is None:
                time.sleep(0.05)
                continue

            if do_detect:
                result = detector.detect(frame)
                frame = detector.draw_overlay(frame, result)
                status_line = f"AI:{result.ai_score:.0f} [{result.ai_status}] {result.top_defect or '-'}"
                cv2.putText(frame, status_line, (10, 25), cv2.FONT_HERSHEY_SIMPLEX,
                            0.6, (0, 255, 0), 2)

            cv2.imshow("Railway Camera - Live", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    except KeyboardInterrupt:
        pass
    finally:
        close_cam()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Railway camera live preview + optional YOLO detection")
    parser.add_argument("--pi", action="store_true", help="Pi Camera Module ব্যবহার করো")
    parser.add_argument("--no-detect", action="store_true", help="শুধু raw preview, YOLO ছাড়া")
    parser.add_argument("--model", default=MODEL_PATH, help="YOLO model path")
    args = parser.parse_args()

    run_preview(use_pi=args.pi, do_detect=not args.no_detect, model_path=args.model)