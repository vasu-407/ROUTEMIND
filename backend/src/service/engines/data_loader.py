import json
import os
import random
import hashlib
from typing import Dict, List, Optional
from core.models import Route, Stop, Package
from core.config import DATA_DIR, MAX_ROUTES_LOAD, ROUTE_MODE
from engines.travel_times import load_route_matrix


def _stable_random(seed_str: str, lo: float, hi: float) -> float:
    """Deterministic pseudo-random float from a string seed."""
    h = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    return lo + (h % 10000) / 10000.0 * (hi - lo)


class DataLoader:
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or DATA_DIR
        
    def load_routes(self, route_ids: List[str] = None) -> Dict[str, Route]:
        """Loads and constructs Route models from raw JSON files."""
        print("Loading raw data...")
        with open(f"{self.base_dir}/route_data.json", "r") as f:
            raw_routes = json.load(f)
            
        with open(f"{self.base_dir}/package_data.json", "r") as f:
            raw_packages = json.load(f)
        
        # enriched_metadata.json is optional — generate defaults if missing
        enriched_path = f"{self.base_dir}/enriched_metadata.json"
        if os.path.isfile(enriched_path):
            with open(enriched_path, "r") as f:
                raw_enriched = json.load(f)
        else:
            print(f"Note: {enriched_path} not found — generating defaults")
            raw_enriched = {}
            
        routes = {}
        
        if not route_ids:
            route_ids = list(raw_routes.keys())[:MAX_ROUTES_LOAD]

        vehicle_types = ["Van", "Truck", "Mini-Van", "Tempo"]

        for idx, rid in enumerate(route_ids):
            if rid not in raw_routes:
                continue
                
            r_data = raw_routes[rid]
            e_data = raw_enriched.get("routes", {}).get(rid, {})
            
            # Generate stable defaults when enriched metadata is absent
            route = Route(
                id=rid,
                station_code=r_data.get("station_code", "UNKNOWN"),
                executor_capacity_cm3=r_data.get("executor_capacity_cm3", 0.0) or 2800000.0,
                driver_id=e_data.get("driver_id", f"DRV-{idx + 1:04d}"),
                vehicle_type=e_data.get("vehicle_type", vehicle_types[idx % len(vehicle_types)]),
                driver_shift_hours=e_data.get("driver_shift_hours", 8),
                driver_current_cash=e_data.get("driver_current_cash", round(_stable_random(rid + "cash", 0, 5000), 2)),
                traffic_level=e_data.get("traffic_level", ["Low", "Medium", "High"][idx % 3]),
                fuel_cost_per_km=e_data.get("fuel_cost_per_km", round(_stable_random(rid + "fuel", 6.0, 12.0), 2)),
                driver_fatigue_score=e_data.get("driver_fatigue_score", round(_stable_random(rid + "fatigue", 0.0, 0.5), 2)),
                route_risk_score=e_data.get("route_risk_score", round(_stable_random(rid + "risk", 0.0, 0.3), 2)),
                route_mode=e_data.get("route_mode", ROUTE_MODE),
            )
            
            # Load stops and packages
            raw_stops = r_data.get("stops", {})
            pkg_data = raw_packages.get(rid, {})
            
            for stop_id, s_data in raw_stops.items():
                stop = Stop(
                    id=stop_id,
                    lat=s_data.get("lat", 0.0),
                    lng=s_data.get("lng", 0.0),
                    type=s_data.get("type", "Dropoff"),
                    zone_id=s_data.get("zone_id")
                )
                
                # Load packages for this stop
                stop_pkgs = pkg_data.get(stop_id, {})
                for pkg_id, p_info in stop_pkgs.items():
                    e_pkg = e_data.get("packages", {}).get(pkg_id, {})
                    dims = p_info.get("dimensions", {})
                    vol = dims.get("depth_cm", 0) * dims.get("height_cm", 0) * dims.get("width_cm", 0)
                    
                    def time_to_sec(t_str):
                        if not t_str: return 0
                        try:
                            h, m = map(int, t_str.split(':'))
                            return h * 3600 + m * 60
                        except (ValueError, TypeError):
                            return 0
                    
                    # Generate COD data if enriched metadata is missing
                    # Keep fallback data operationally plausible: a normal
                    # route should fit under the ₹50,000 cash-carry guardrail,
                    # while explicit enriched data can still model violations.
                    is_cod = e_pkg.get("is_cod", _stable_random(pkg_id + "cod", 0, 1) < 0.08)
                    cod_amount = e_pkg.get("cod_amount", round(_stable_random(pkg_id + "amt", 200, 1800), 0) if is_cod else 0.0)

                    pkg = Package(
                        id=pkg_id,
                        volume_cm3=vol if vol > 0 else _stable_random(pkg_id + "vol", 500, 50000),
                        is_cod=is_cod,
                        cod_amount=cod_amount,
                        priority=e_pkg.get("priority", "Standard"),
                        weight_kg=e_pkg.get("package_weight_kg", round(_stable_random(pkg_id + "wt", 0.5, 15.0), 1)),
                        zone_restricted=e_pkg.get("zone_restricted", False),
                        zone_allowed_from_sec=time_to_sec(e_pkg.get("zone_allowed_from", "00:00")),
                        zone_allowed_to_sec=time_to_sec(e_pkg.get("zone_allowed_to", "23:59")),
                        planned_service_time_seconds=p_info.get("planned_service_time_seconds", 0.0)
                    )
                    stop.packages.append(pkg)
                
                route.stops[stop_id] = stop
                
            route.distance_matrix = load_route_matrix(rid)
            routes[rid] = route

        print(f"Loaded {len(routes)} routes successfully.")
        if not routes:
            print(f"Warning: no routes loaded. Check ROUTEMIND_DATA_DIR={self.base_dir} (exists={os.path.isdir(self.base_dir)})")
        return routes

