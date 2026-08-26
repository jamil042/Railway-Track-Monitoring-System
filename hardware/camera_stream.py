"""
camera_stream.py
----------------
Flask MJPEG streaming server — browser থেকে live camera + YOLO detection দেখা যাবে।
এখন এটাই **একমাত্র প্রসেস যেটা camera খোলে** — sensor_fusion_dashboard.py আর নিজে
camera খোলে না, বরং এই স্ক্রিপ্টের /detection endpoint থেকে HTTP দিয়ে সর্বশেষ
detection result নিয়ে আসে। এতে দুইটা প্রসেস একসাথে camera-এর জন্য conflict করবে না।

Usage:
    source ../.venv/bin/activate
    python3 camera_stream.py                       # USB webcam
    python3 camera_stream.py --pi                  # Pi Camera
    python3 camera_stream.py --no-detect           # raw, detection ছাড়া
    python3 camera_stream.py --port 8081           # custom port

Browser: http://<ip>:8081/stream      (MJPEG stream)
         http://<ip>:8081/            (preview page)
         http://<ip>:8081/detection   (JSON — sensor_fusion_dashboard.py এটা পড়ে)
"""

import argparse
import time
import threading

import cv2
from flask import Flask, Response, jsonify, render_template_string

from yolo_detector import YOLODetector, MODEL_PATH

app = Flask(__name__)

detector: YOLODetector | None = None
latest_frame = None
latest_result = None          # সর্বশেষ DetectionResult (detection চালু থাকলে)
frame_lock = threading.Lock()
result_lock = threading.Lock()


def capture_loop(use_pi: bool, do_detect: bool, model_path: str):
    global detector, latest_frame, latest_result

    if do_detect:
        detector = YOLODetector(model_path=model_path)

    if use_pi:
        from picamera2 import Picamera2
        picam2 = Picamera2()
        cfg = picam2.create_preview_configuration(
            main={"size": (640, 480), "format": "RGB888"}
        )
        picam2.configure(cfg)
        picam2.start()
        time.sleep(1)
        read_frame = lambda: cv2.cvtColor(picam2.capture_array(), cv2.COLOR_RGB2BGR)
    else:
        # USB camera — index reboot/USB reset er por change hote pare,
        # tai 0,1,2 try kore jeitay frame ashe seta use koro.
        cap = None
        for idx in (0, 1, 2):
            c = cv2.VideoCapture(idx)
            c.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            c.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            if c.isOpened():
                ok, test_frame = c.read()
                if ok and test_frame is not None:
                    cap = c
                    print(f"[STREAM] Using camera index {idx}")
                    break
                c.release()
        if cap is None or not cap.isOpened():
            print("[FAIL] Kono camera tei frame pawa jay ni")
            return
        capture_loop._idx = idx  # reconnect er somoy ei index e abar khulbe
        read_frame = lambda: cap.read()[1]

    print("[STREAM] Camera capture started")

    # SMOOTH STREAMING: frame capture + JPEG encode prottek loop e chole
    # (~30fps), kintu YOLO inference CPU-heavy — tai alada interval e chole.
    # Video smooth thake, detection box ~1s por por update hoy.
    DETECT_INTERVAL_SEC = 1.0
    last_detect = 0.0
    last_result_snapshot = None

    while True:
        frame = read_frame()
        if frame is None:
            # Camera hang/reset hole abar open korar try koro
            failures = getattr(capture_loop, "_fails", 0) + 1
            capture_loop._fails = failures
            time.sleep(0.2)
            if failures >= 25:
                print("[STREAM] Frame aschhe na — camera reconnect...")
                if not use_pi and cap:
                    cap.release()
                    time.sleep(1)
                    cap.open(getattr(capture_loop, "_idx", 0))
                capture_loop._fails = 0
            continue
        capture_loop._fails = 0

        now = time.time()

        # YOLO inference alada cadence e — stream ke block kore na
        if detector and (now - last_detect) >= DETECT_INTERVAL_SEC:
            last_detect = now
            try:
                result = detector.detect(frame)
                last_result_snapshot = result
                with result_lock:
                    latest_result = result
            except Exception as e:
                print(f"[YOLO] detect error: {e}")

        if detector and last_result_snapshot is not None:
            frame = detector.draw_overlay(frame, last_result_snapshot)
            status_line = f"AI:{last_result_snapshot.ai_score:.0f} [{last_result_snapshot.ai_status}] {last_result_snapshot.top_defect or '-'}"
            cv2.putText(frame, status_line, (10, 25), cv2.FONT_HERSHEY_SIMPLEX,
                        0.6, (0, 255, 0), 2)

        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        with frame_lock:
            latest_frame = buffer.tobytes()


def generate_stream():
    while True:
        with frame_lock:
            frame = latest_frame
        if frame is None:
            time.sleep(0.1)
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        time.sleep(0.033)  # 30 fps — smooth real-time video


HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Railway Camera - Live</title>
    <style>
        body { margin: 0; background: #0f172a; display: flex; justify-content: center; align-items: center; height: 100vh; }
        img { max-width: 100%; max-height: 100%; border-radius: 12px; box-shadow: 0 0 30px rgba(0,0,0,0.5); }
    </style>
</head>
<body>
    <img src="/stream" />
</body>
</html>
"""


@app.route('/')
def index():
    return render_template_string(HTML_PAGE)


@app.route('/stream')
def stream():
    return Response(generate_stream(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/detection')
def detection():
    """
    sensor_fusion_dashboard.py এই endpoint poll করে ai_score/ai_status/top_defect
    নিয়ে যায় — এতে ওই স্ক্রিপ্টের নিজের camera খোলার দরকার হয় না।
    """
    with result_lock:
        result = latest_result

    if result is None:
        return jsonify({"available": False})

    return jsonify({
        "available": True,
        "timestamp": result.timestamp,
        "ai_score": result.ai_score,
        "ai_status": result.ai_status,
        "top_defect": result.top_defect,
        "top_confidence": result.top_confidence,
        "fastener_detected_count": result.fastener_detected_count,
        "missing_fastener": result.missing_fastener,
        "detections": result.detections,
    })


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--pi', action='store_true')
    parser.add_argument('--no-detect', action='store_true')
    parser.add_argument('--model', default=MODEL_PATH)
    parser.add_argument('--port', type=int, default=8081)
    args = parser.parse_args()

    t = threading.Thread(target=capture_loop,
                         args=(args.pi, not args.no_detect, args.model),
                         daemon=True)
    t.start()

    print(f"[STREAM] http://0.0.0.0:{args.port}/stream")
    print(f"[STREAM] http://0.0.0.0:{args.port}/detection  (JSON, sensor_fusion_dashboard.py পড়বে)")
    app.run(host='0.0.0.0', port=args.port, threaded=True)