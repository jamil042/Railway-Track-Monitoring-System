"""
camera_stream.py
----------------
Flask MJPEG streaming server — browser থেকে live camera + YOLO detection দেখা যাবে।

Usage:
    source ../.venv/bin/activate
    python3 camera_stream.py                       # USB webcam
    python3 camera_stream.py --pi                  # Pi Camera
    python3 camera_stream.py --no-detect           # raw, detection ছাড়া
    python3 camera_stream.py --port 8081           # custom port

Browser: http://<ip>:8081/stream   (MJPEG stream)
         http://<ip>:8081/         (preview page)
"""

import argparse
import time
import threading

import cv2
from flask import Flask, Response, render_template_string

from yolo_detector import YOLODetector, MODEL_PATH

app = Flask(__name__)

detector: YOLODetector | None = None
latest_frame = None
frame_lock = threading.Lock()


def capture_loop(use_pi: bool, do_detect: bool, model_path: str):
    global detector, latest_frame

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
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        if not cap.isOpened():
            print("[FAIL] Camera index 0 খোলা যায়নি")
            return
        read_frame = lambda: cap.read()[1]

    print("[STREAM] Camera capture started")

    while True:
        frame = read_frame()
        if frame is None:
            time.sleep(0.05)
            continue

        if detector:
            result = detector.detect(frame)
            frame = detector.draw_overlay(frame, result)
            status_line = f"AI:{result.ai_score:.0f} [{result.ai_status}] {result.top_defect or '-'}"
            cv2.putText(frame, status_line, (10, 25), cv2.FONT_HERSHEY_SIMPLEX,
                        0.6, (0, 255, 0), 2)

        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
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
        time.sleep(0.03)


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
    app.run(host='0.0.0.0', port=args.port, threaded=True)
