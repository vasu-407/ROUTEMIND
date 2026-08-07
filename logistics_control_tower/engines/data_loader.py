import json
from typing import Dict, List
from core.models import Route, Stop, Package

class DataLoader:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        
    def load_routes(self, route_ids: List[str] = None) -> Dict[str, Route]:
        """Loads and constructs Route models from raw JSON files."""
        print("Loading raw data...")
        with open(f"{self.base_dir}/route_data.json", "r") as f:
            raw_routes = json.load(f)
            
        with open(f"{self.base_dir}/package_data.json", "r") as f:
            raw_packages = json.load(f)
            
        with open(f"{self.base_dir}/enriched_metadata.json", "r") as f:
            raw_enriched = json.load(f)
            
        # Bypass loading 1.7GB travel_times.json globally to prevent 2 min startup/OOM.
        # We will compute haversine distances dynamically in optimization.py or rely on ML.
        raw_travel_times = {}

        routes = {}
        
        # Load all available routes since we are no longer loading the 1.7GB travel matrix
        if not route_ids:
            route_ids = list(raw_routes.keys())

        for rid in route_ids:
            if rid not in raw_routes:
                continue
                
            r_data = raw_routes[rid]
            e_data = raw_enriched.get("routes", {}).get(rid, {})
            
            route = Route(
                id=rid,
                station_code=r_data.get("station_code", "UNKNOWN"),
                executor_capacity_cm3=r_data.get("executor_capacity_cm3", 0.0),
                driver_id=e_data.get("driver_id"),
                vehicle_type=e_data.get("vehicle_type"),
                driver_shift_hours=e_data.get("driver_shift_hours", 8),
                driver_current_cash=e_data.get("driver_current_cash", 0.0),
                traffic_level=e_data.get("traffic_level", "Low"),
                fuel_cost_per_km=e_data.get("fuel_cost_per_km", 0.0),
                driver_fatigue_score=e_data.get("driver_fatigue_score", 0.0),
                route_risk_score=e_data.get("route_risk_score", 0.0)
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
                        h, m = map(int, t_str.split(':'))
                        return h * 3600 + m * 60
                    
                    pkg = Package(
                        id=pkg_id,
                        volume_cm3=vol,
                        is_cod=e_pkg.get("is_cod", False),
                        cod_amount=e_pkg.get("cod_amount", 0.0),
                        priority=e_pkg.get("priority", "Standard"),
                        weight_kg=e_pkg.get("package_weight_kg", 0.0),
                        zone_restricted=e_pkg.get("zone_restricted", False),
                        zone_allowed_from_sec=time_to_sec(e_pkg.get("zone_allowed_from", "00:00")),
                        zone_allowed_to_sec=time_to_sec(e_pkg.get("zone_allowed_to", "23:59")),
                        planned_service_time_seconds=p_info.get("planned_service_time_seconds", 0.0)
                    )
                    stop.packages.append(pkg)
                
                route.stops[stop_id] = stop
                
            # Load distance matrix
            route.distance_matrix = raw_travel_times.get(rid, {})
            routes[rid] = route
            
        return routes
