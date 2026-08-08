"""
Feature Engineering Pipeline
Reads the Amazon LMRRC dataset and generates a training-ready DataFrame
with ML features targeting actual travel time.
"""
import json
import math
import random
import os
import pandas as pd

from core.config import DATA_DIR
from core.geo import haversine_km
from engines.travel_times import load_route_matrix

BASE_DIR = DATA_DIR


def haversine_km(lat1, lon1, lat2, lon2):
    from core.geo import haversine_km as _h
    return _h(lat1, lon1, lat2, lon2)


def load_raw_data(base_dir):
    print("Loading raw dataset files...")
    with open(f"{base_dir}/route_data.json") as f:
        route_data = json.load(f)
    with open(f"{base_dir}/package_data.json") as f:
        package_data = json.load(f)
    with open(f"{base_dir}/actual_sequences.json") as f:
        actual_sequences = json.load(f)
    print(f"  Routes: {len(route_data)}, Packages: {len(package_data)}, Sequences: {len(actual_sequences)}")
    return route_data, package_data, actual_sequences


def build_features(route_data, package_data, actual_sequences, max_routes=200):
    """
    For each consecutive stop-pair in each route, generate a feature row.
    Target = simulated actual travel time (seconds).
    """
    records = []
    route_ids = list(route_data.keys())[:max_routes]

    for route_id in route_ids:
        r = route_data[route_id]
        stops = r.get("stops", {})
        pkg_data = package_data.get(route_id, {})
        sequence_raw = actual_sequences.get(route_id, {}).get("actual", {})
        # actual_sequences stores {stop_id: rank}. Sort by rank to get ordered list.
        if isinstance(sequence_raw, dict):
            sequence = [k for k, v in sorted(sequence_raw.items(), key=lambda x: x[1])]
        else:
            sequence = sequence_raw  # fallback if already a list

        if len(sequence) < 2:
            continue

        num_stops = len(sequence)
        executor_capacity = r.get("executor_capacity_cm3", 1.0)
        departure_str = r.get("date_YYYY_MM_DD", "2021-01-01")

        # Derive departure hour (simulate 06:00–10:00 AM window)
        departure_hour = random.randint(6, 10)

        # Compute total route volume for load ratio
        total_volume = 0.0
        for stop_id, pkgs in pkg_data.items():
            for pid, pinfo in pkgs.items():
                d = pinfo.get("dimensions", {})
                vol = d.get("depth_cm", 0) * d.get("height_cm", 0) * d.get("width_cm", 0)
                total_volume += vol

        load_ratio = min(total_volume / max(executor_capacity, 1.0), 1.0)

        # Walk consecutive stop pairs in the actual sequence
        for i in range(len(sequence) - 1):
            s1_id = sequence[i]
            s2_id = sequence[i + 1]
            s1 = stops.get(s1_id, {})
            s2 = stops.get(s2_id, {})

            lat1, lon1 = s1.get("lat", 0), s1.get("lng", 0)
            lat2, lon2 = s2.get("lat", 0), s2.get("lng", 0)

            if lat1 == 0 or lat2 == 0:
                continue

            dist_km = haversine_km(lat1, lon1, lat2, lon2)

            tt_matrix = load_route_matrix(route_id)
            travel_time_s = float(tt_matrix.get(s1_id, {}).get(s2_id, 0) or 0)
            if travel_time_s <= 0:
                base_speed_kmh = 30.0
                travel_time_s = (dist_km / base_speed_kmh) * 3600

            actual_travel_time = travel_time_s

            records.append({
                "route_id": route_id,
                "stop_index": i,
                "distance_km": round(dist_km, 4),
                "departure_hour": departure_hour,
                "num_stops": num_stops,
                "load_ratio": round(load_ratio, 4),
                "service_time_sec": service_time,
                "stop_volume_cm3": stop_volume,
                "num_packages": num_packages,
                "zone_id": zone_id,
                "stop_density": round(stop_density, 4),
                "executor_capacity_cm3": executor_capacity,
                # Target
                "actual_travel_time_sec": round(actual_travel_time, 2),
            })

    df = pd.DataFrame(records)
    print(f"Feature engineering complete. Rows: {len(df)}, Features: {len(df.columns) - 2}")
    return df


FEATURE_COLS = [
    "distance_km", "departure_hour", "num_stops", "load_ratio",
    "service_time_sec", "stop_volume_cm3", "num_packages",
    "zone_id", "stop_density", "executor_capacity_cm3"
]
TARGET_COL = "actual_travel_time_sec"


if __name__ == "__main__":
    route_data, package_data, actual_sequences = load_raw_data(BASE_DIR)
    df = build_features(route_data, package_data, actual_sequences, max_routes=200)

    os.makedirs("ml", exist_ok=True)
    df.to_csv("ml/features.csv", index=False)
    print(f"Saved ml/features.csv ({len(df)} rows)")
    print(df.head())
