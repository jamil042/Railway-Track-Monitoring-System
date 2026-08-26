#!/usr/bin/env python3
"""
track_simulator.py
------------------
Choto project-er jonno sensor data simulator — proti track-er jonno choto
constant base value theke multiply kore ektu ektu change hoy, jar fole
protita track-er value onno track theke alada thake.

Prottek 1.5 second-e sob track-er jonno vibration / ultrasonic / ir_beam
reading backend-er public ingest endpoint-e POST kore. Backend (Firestore)
oi reading theke track-er cached value + sensor_health + status
(safe/warning/critical) automatically update kore dey.

Run:  python3 track_simulator.py [--interval 1.5] [--backend http://localhost:5000]
"""

import argparse
import math
import random
import time
from concurrent.futures import ThreadPoolExecutor

import requests


def track_seed(track_id: str) -> int:
    """Track ID theke stable seed — proti track-er base value alada howar jonno."""
    return sum(ord(c) * (i + 7) for i, c in enumerate(track_id))


def post_reading(session: requests.Session, url: str, payload: dict) -> bool:
    try:
        return session.post(url, json=payload, timeout=5).status_code == 201
    except requests.RequestException:
        return False  # backend bondho thakle next cycle-e abar try korbe


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=float, default=1.5)
    parser.add_argument("--backend", default="http://localhost:5000")
    parser.add_argument("--exclude", default="",
                        help="Comma-separated track IDs to skip (real hardware tracks)")
    args = parser.parse_args()

    url = f"{args.backend}/api/sensor-readings"
    print(f"[SIM] Simulator started — interval {args.interval}s -> {url}")

    # Per-track base constants (track id theke derived, tai kokhono change hoy na)
    rng = random.Random(42)
    bases: dict[str, dict] = {}
    session = requests.Session()
    pool = ThreadPoolExecutor(max_workers=24)
    futures = []

    while True:
        try:
            resp = session.get(f"{args.backend}/api/tracks/ids", timeout=5)
            resp.raise_for_status()
            tracks = resp.json()
        except (requests.RequestException, ValueError, KeyError) as exc:
            print(f"[SIM] API error: {exc}")
            time.sleep(args.interval)
            continue

        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        sent = 0

        excluded = {t.strip() for t in args.exclude.split(",") if t.strip()}
        for track_id in tracks:
            if track_id in excluded:
                continue
            if track_id not in bases:
                seed = track_seed(track_id)
                r = random.Random(seed)
                bases[track_id] = {
                    # Normal vibration 25-30 Hz ≈ 12-15 pulses/500ms
                    "vibration": 5 + (seed % 11),         # 5..15 count/500ms
                    # Normal distance ≤20cm (sensor mounted 20cm above track)
                    "distance": 12 + (seed % 8),          # 12..19 cm
                    "phase": r.random() * 6.28,
                }

            b = bases[track_id]
            t = time.time()

            # Base value × halka sinusoidal + noise — normal readings stay safe
            vib = max(0, round(b["vibration"] * (1 + 0.35 * __import__("math").sin(t / 5 + b["phase"])) + random.uniform(-0.8, 0.8), 1))
            dist = round(b["distance"] * (1 + 0.04 * __import__("math").sin(t / 11 + b["phase"])) + random.uniform(-0.6, 0.6), 2)

            # Spikes: vibration ≥25 (resonance), ≥50 (high-freq defect)
            #         distance 20-25cm = warning, >25cm = critical
            if random.random() < 0.02:
                vib = round(random.uniform(25, 80), 1)   # resonance/critical vibration
            elif random.random() < 0.015:
                dist = round(random.uniform(21, 25), 2)  # warning range
            elif random.random() < 0.005:
                dist = round(random.uniform(26, 35), 2)  # critical range

            # IR beam normally clear (1); majo-majoi obstacle simulate kori
            ir = 0 if random.random() < 0.004 else 1

            payloads = [
                {"trackId": track_id, "recordedAt": now, "deviceId": 1, "sensorType": "vibration", "value": vib, "unit": "count/500ms"},
                {"trackId": track_id, "recordedAt": now, "deviceId": 1, "sensorType": "ultrasonic", "value": dist, "unit": "cm"},
                {"trackId": track_id, "recordedAt": now, "deviceId": 1, "sensorType": "ir_beam", "value": ir, "unit": "0=fault"},
            ]
            for payload in payloads:
                futures.append(pool.submit(post_reading, session, url, payload))

        for f in futures:
            if f.result():
                sent += 1
        futures.clear()

        print(f"[SIM] {now} — {sent} readings sent ({len(tracks)} tracks)", flush=True)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
