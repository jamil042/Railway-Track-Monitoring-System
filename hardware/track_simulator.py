#!/usr/bin/env python3
"""
track_simulator.py
------------------
Choto project-er jonno sensor data simulator — proti track-er jonno choto
constant base value theke multiply kore ektu ektu change hoy, jar fole
protita track-er value onno track theke alada thake.

Prottek 1.5 second-e sob track-er jonno vibration / ultrasonic / ir_beam
reading backend-er public ingest endpoint-e POST kore. Backend-er SQLite
trigger oi reading theke track-er cached value + sensor_health + status
(safe/warning/critical) automatically update kore dey.

Run:  python3 track_simulator.py [--interval 1.5] [--backend http://localhost:5000]
"""

import argparse
import random
import sqlite3
import time
from pathlib import Path

import requests

DB_PATH = Path(__file__).resolve().parent.parent / "backend" / "data" / "railway.db"


def track_seed(track_id: str) -> int:
    """Track ID theke stable seed — proti track-er base value alada howar jonno."""
    return sum(ord(c) * (i + 7) for i, c in enumerate(track_id))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=float, default=1.5)
    parser.add_argument("--backend", default="http://localhost:5000")
    args = parser.parse_args()

    url = f"{args.backend}/api/sensor-readings"
    print(f"[SIM] Simulator started — interval {args.interval}s -> {url}")

    # Per-track base constants (track id theke derived, tai kokhono change hoy na)
    rng = random.Random(42)
    bases: dict[str, dict] = {}
    session = requests.Session()

    while True:
        try:
            conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
            tracks = conn.execute("SELECT id FROM tracks ORDER BY id").fetchall()
            conn.close()
        except sqlite3.Error as exc:
            print(f"[SIM] DB read error: {exc}")
            time.sleep(args.interval)
            continue

        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        sent = 0

        for (track_id,) in tracks:
            if track_id not in bases:
                seed = track_seed(track_id)
                r = random.Random(seed)
                bases[track_id] = {
                    # choto constant base value — protita track-er alada
                    "vibration": 2 + (seed % 9),          # 2..10 count/500ms
                    "distance": 18 + (seed % 17),          # 18..34 cm
                    "phase": r.random() * 6.28,
                }

            b = bases[track_id]
            t = time.time()

            # Base value × halka sinusoidal + noise variation — value ekdom same thake na
            vib = max(0, round(b["vibration"] * (1 + 0.35 * __import__("math").sin(t / 5 + b["phase"])) + random.uniform(-0.8, 0.8), 1))
            dist = round(b["distance"] * (1 + 0.04 * __import__("math").sin(t / 11 + b["phase"])) + random.uniform(-0.6, 0.6), 2)

            # Majo-majo real spike — EMA baseline theke deviate kore
            # warning/critical status trigger kore, tai dashboard-e status change dekha jay
            if random.random() < 0.02:
                vib = round(vib * random.uniform(6, 12), 1)      # heavy vibration spike -> warning/critical
            elif random.random() < 0.01:
                dist = round(max(5, dist - random.uniform(12, 25)), 2)  # sudden distance drop -> obstacle-ish

            # IR beam normally clear (1); majo-majoi obstacle simulate kori
            ir = 0 if random.random() < 0.004 else 1

            payload_base = {"trackId": track_id, "recordedAt": now}
            for payload in (
                {**payload_base, "deviceId": 1, "sensorType": "vibration", "value": vib, "unit": "count/500ms"},
                {**payload_base, "deviceId": 1, "sensorType": "ultrasonic", "value": dist, "unit": "cm"},
                {**payload_base, "deviceId": 1, "sensorType": "ir_beam", "value": ir, "unit": "0=fault"},
            ):
                try:
                    resp = session.post(url, json=payload, timeout=2)
                    if resp.status_code == 201:
                        sent += 1
                except requests.RequestException:
                    pass  # backend bondho thakle next cycle-e abar try korbe

        print(f"[SIM] {now} — {sent} readings sent ({len(tracks)} tracks)", flush=True)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
