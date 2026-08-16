"""
yolo_detector.py
-----------------
Pi Camera + YOLOv8n ভিত্তিক Railway Track visual fault detection module।

কাজ:
  1. Pi Camera (picamera2) অথবা সাধারণ USB/webcam (OpenCV) থেকে frame capture
  2. YOLOv8n মডেল দিয়ে inference চালিয়ে rail/crack/fastener ইত্যাদি detect করা
  3. Missing-fastener লজিক (expected count vs detected count) প্রয়োগ করা
  4. একটা normalized AI Fault Score (0-100) তৈরি করা, যেটা sensor_fusion_dashboard.py
     পরে vibration/ultrasonic/IR স্কোরের সাথে merge করবে।

Install (Raspberry Pi):
    pip install ultralytics opencv-python --break-system-packages
    # Pi Camera ব্যবহার করলে:
    pip install picamera2 --break-system-packages

Model:
    প্রথমে proposal অনুযায়ী YOLOv8n দিয়ে শুরু করো। নিজেদের railway-specific
    dataset (crack, missing_fastener, missing_bolt, fishplate_damage, broken_rail)
    দিয়ে fine-tune করে ./models/railway_yolov8n.pt হিসেবে সেভ করবে, তারপর
    সেই path MODEL_PATH এ বসাও। Fine-tuned model না থাকলে আপাতত pretrained
    'yolov8n.pt' দিয়ে pipeline টেস্ট করা যাবে (তখন railway class গুলো ধরবে না,
    শুধু ওয়্যারিং/লজিক ভেরিফাই করার জন্য কাজে লাগবে)।
"""

import time
import threading
from dataclasses import dataclass, field
from typing import Optional

import cv2
from ultralytics import YOLO

# ==================== CONFIG ====================

MODEL_PATH = "models/railway_yolov8n.pt"   # fine-tuned model path (fallback: "yolov8n.pt")
CONF_THRESHOLD = 0.40
CAMERA_INDEX = 0                            # USB camera হলে; Pi Camera হলে use_picamera=True
USE_PICAMERA = False                        # Pi Camera Module হলে True করো
FRAME_WIDTH = 640
FRAME_HEIGHT = 480

# তোমাদের railway dataset-এ যে class নামগুলো train করবে, সেগুলো এখানে মিলিয়ে নাও।
# Fault severity অনুযায়ী প্রতিটা class-এর weight (higher = বেশি critical)
DEFECT_CLASS_WEIGHTS = {
    "broken_rail": 1.0,
    "crack": 0.9,
    "missing_fastener": 0.6,
    "missing_bolt": 0.6,
    "fishplate_damage": 0.7,
    "obstacle": 0.5,
}

# প্রতি track segment/frame-এ normally যতগুলো fastener/bolt থাকা উচিত (calibrate করবে)
EXPECTED_FASTENER_COUNT = 4

# Class-wise minimum confidence — বেশি critical defect (broken_rail/crack) কম confidence-এও
# accept করবে (miss করা যাবে না), কিন্তু কম critical (obstacle) এর জন্য বেশি confidence
# লাগবে false-alarm কমাতে। এখানে না থাকা class গুলো global CONF_THRESHOLD ব্যবহার করবে।
DEFECT_CONF_THRESHOLDS = {
    "broken_rail": 0.30,
    "crack": 0.35,
    "fishplate_damage": 0.40,
    "missing_fastener": 0.45,
    "missing_bolt": 0.45,
    "obstacle": 0.55,
}

# AI Fault Score (0-100) থেকে status বের করার থ্রেশহোল্ড — sensor_fusion_dashboard.py-এর
# STATUS_THRESHOLDS এর সাথে মিলিয়ে রাখা হয়েছে, যাতে standalone টেস্টেও status বোঝা যায়
AI_STATUS_THRESHOLDS = [(30, "NORMAL"), (60, "WARNING"), (100, "EMERGENCY")]


def ai_status_from_score(score: float) -> str:
    for threshold, label in AI_STATUS_THRESHOLDS:
        if score <= threshold:
            return label
    return "EMERGENCY"


@dataclass
class DetectionResult:
    timestamp: float
    detections: list = field(default_factory=list)   # [{cls, conf, bbox}]
    fastener_detected_count: int = 0
    missing_fastener: bool = False
    ai_score: float = 0.0          # 0-100 (100 = সবচেয়ে severe fault)
    ai_status: str = "NORMAL"      # NORMAL / WARNING / EMERGENCY
    top_defect: Optional[str] = None
    top_confidence: float = 0.0


class YOLODetector:
    def __init__(self, model_path: str = MODEL_PATH, conf: float = CONF_THRESHOLD):
        print(f"[YOLO] Loading model: {model_path}")
        self.model = YOLO(model_path)
        self.conf = conf
        # predict() কে সবচেয়ে কম per-class threshold দিয়ে চালানো হবে, তারপর প্রতিটা
        # box কে তার নিজের class threshold দিয়ে আলাদাভাবে ফিল্টার করা হবে (নিচে দেখো)
        self._predict_conf = min([conf] + list(DEFECT_CONF_THRESHOLDS.values()))
        self.cap = None

    # ---------------- Camera handling ----------------
    def open_camera(self):
        if USE_PICAMERA:
            from picamera2 import Picamera2
            self.picam2 = Picamera2()
            cfg = self.picam2.create_preview_configuration(
                main={"size": (FRAME_WIDTH, FRAME_HEIGHT), "format": "RGB888"}
            )
            self.picam2.configure(cfg)
            self.picam2.start()
            time.sleep(1)
        else:
            self.cap = cv2.VideoCapture(CAMERA_INDEX)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
            if not self.cap.isOpened():
                raise RuntimeError("Camera open করা যায়নি — CAMERA_INDEX চেক করো।")

    def read_frame(self):
        if USE_PICAMERA:
            return self.picam2.capture_array()
        ok, frame = self.cap.read()
        if not ok:
            return None
        return frame

    def close(self):
        if USE_PICAMERA and hasattr(self, "picam2"):
            self.picam2.stop()
        elif self.cap is not None:
            self.cap.release()

    # ---------------- Inference + scoring ----------------
    def detect(self, frame) -> DetectionResult:
        result = DetectionResult(timestamp=time.time())
        preds = self.model.predict(frame, conf=self._predict_conf, verbose=False)[0]

        fastener_count = 0
        worst_score = 0.0
        worst_cls = None
        worst_conf = 0.0

        for box in preds.boxes:
            cls_id = int(box.cls[0])
            cls_name = self.model.names[cls_id]
            conf = float(box.conf[0])
            xyxy = box.xyxy[0].tolist()

            # এই class-এর নিজস্ব threshold না পেরোলে বাদ (false-alarm কমানোর জন্য)
            class_threshold = DEFECT_CONF_THRESHOLDS.get(cls_name, self.conf)
            if conf < class_threshold:
                continue

            result.detections.append({"cls": cls_name, "conf": conf, "bbox": xyxy})

            if cls_name in ("fastener", "bolt"):
                fastener_count += 1

            weight = DEFECT_CLASS_WEIGHTS.get(cls_name, 0.0)
            candidate_score = weight * conf * 100
            if candidate_score > worst_score:
                worst_score = candidate_score
                worst_cls = cls_name
                worst_conf = conf

        result.fastener_detected_count = fastener_count
        if fastener_count < EXPECTED_FASTENER_COUNT:
            result.missing_fastener = True
            missing_score = DEFECT_CLASS_WEIGHTS.get("missing_fastener", 0.6) * 100
            if missing_score > worst_score:
                worst_score = missing_score
                worst_cls = "missing_fastener"
                worst_conf = 1.0 - (fastener_count / max(EXPECTED_FASTENER_COUNT, 1))

        result.ai_score = min(worst_score, 100.0)
        result.ai_status = ai_status_from_score(result.ai_score)
        result.top_defect = worst_cls
        result.top_confidence = worst_conf
        return result

    def draw_overlay(self, frame, result: DetectionResult):
        for det in result.detections:
            x1, y1, x2, y2 = map(int, det["bbox"])
            label = f'{det["cls"]} {det["conf"]:.2f}'
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.putText(frame, label, (x1, max(y1 - 8, 0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        return frame


class CameraWorker(threading.Thread):
    """
    ব্যাকগ্রাউন্ডে ক্রমাগত camera frame capture + YOLO inference চালায় এবং
    সর্বশেষ DetectionResult একটা thread-safe attribute-এ রাখে, যাতে
    sensor_fusion_dashboard.py যেকোনো সময় সর্বশেষ ফলাফল পড়তে পারে।
    """

    def __init__(self, interval: float = 1.0, show_window: bool = False):
        super().__init__(daemon=True)
        self.detector = YOLODetector()
        self.interval = interval
        self.show_window = show_window
        self.latest: Optional[DetectionResult] = None
        self._lock = threading.Lock()
        self._stop_flag = threading.Event()

    def run(self):
        self.detector.open_camera()
        try:
            while not self._stop_flag.is_set():
                frame = self.detector.read_frame()
                if frame is None:
                    time.sleep(0.1)
                    continue

                result = self.detector.detect(frame)
                with self._lock:
                    self.latest = result

                if self.show_window:
                    annotated = self.detector.draw_overlay(frame.copy(), result)
                    cv2.imshow("Railway Camera - YOLO", annotated)
                    cv2.waitKey(1)

                time.sleep(self.interval)
        finally:
            self.detector.close()
            if self.show_window:
                cv2.destroyAllWindows()

    def get_latest(self) -> Optional[DetectionResult]:
        with self._lock:
            return self.latest

    def stop(self):
        self._stop_flag.set()


if __name__ == "__main__":
    # স্ট্যান্ডঅ্যালোন টেস্ট: ক্যামেরা চালু করে প্রতি ১ সেকেন্ডে detection প্রিন্ট করবে
    worker = CameraWorker(interval=1.0, show_window=True)
    worker.start()
    try:
        while True:
            res = worker.get_latest()
            if res:
                print(f"[{time.strftime('%H:%M:%S')}] AI Score: {res.ai_score:.1f} "
                      f"[{res.ai_status}] | Top Defect: {res.top_defect} ({res.top_confidence:.2f}) "
                      f"| Fasteners: {res.fastener_detected_count}/{EXPECTED_FASTENER_COUNT}")
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nStopping...")
        worker.stop()
        worker.join()