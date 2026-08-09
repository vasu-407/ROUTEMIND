from core.models import Route
from core.geo import haversine_km, haversine_travel_sec
from core.config import ML_API_URL, USE_ML_TRAVEL_TIMES, ORTOOLS_TIME_LIMIT_SEC
from engines.route_metrics import sequence_totals
import time
import os
import requests

# Import cache type for type hints (optional, avoids circular import)
try:
    from engines.prediction_cache import PredictionCache as _CacheType
except ImportError:
    _CacheType = None


class RouteOptimizer:
    def __init__(self):
        try:
            from ortools.constraint_solver import routing_enums_pb2
            from ortools.constraint_solver import pywrapcp
            self.routing_enums = routing_enums_pb2
            self.pywrapcp = pywrapcp
            self.available = True
        except ImportError:
            self.available = False

    # ── Public API ─────────────────────────────────────────────────────────

    def optimize(self, route: Route, cache=None, demo_n: int = None) -> dict:
        """
        Runs OR-Tools VRP Solver with optional XGBoost travel-time predictions.

        Parameters
        ----------
        route   : Route dataclass with stops and distance_matrix.
        cache   : PredictionCache singleton. When provided:
                    - Already-cached (origin_id, dest_id) pairs skip the ML call.
                    - New predictions are stored back into the cache.
                  Pass None to bypass caching (useful for ablation baseline mode).
        demo_n  : If set, slices the route to the depot + (demo_n-1) nearest stops
                  for the interactive demo. Original route data is NOT modified.
        """
        if not self.available:
            print("Warning: OR-Tools not installed. Returning original route order.")
            return self._build_empty_response(route)

        start_ms = int(time.time() * 1000)

        # ── Demo slice (non-destructive) ────────────────────────────────────
        stops_list = list(route.stops.keys())
        if demo_n is not None and demo_n < len(stops_list):
            depot_id_demo = route.get_depot_id()
            if depot_id_demo and depot_id_demo in stops_list:
                depot_stop = route.stops[depot_id_demo]
                non_depot = [sid for sid in stops_list if sid != depot_id_demo]
                non_depot.sort(
                    key=lambda sid: haversine_km(
                        depot_stop.lat, depot_stop.lng,
                        route.stops[sid].lat, route.stops[sid].lng,
                    )
                )
                stops_list = [depot_id_demo] + non_depot[: demo_n - 1]
            else:
                stops_list = stops_list[:demo_n]

        if len(stops_list) < 2:
            return self._build_empty_response(route)

        depot_index = 0
        depot_id = route.get_depot_id()
        if depot_id in stops_list:
            depot_index = stops_list.index(depot_id)

        # ── Build distance / travel-time matrices (haversine baseline) ──────
        data = {}
        distance_matrix = []
        travel_time_matrix = []
        demands = []
        service_times = []
        time_windows = []
        total_route_demand = 0

        for i, origin in enumerate(stops_list):
            row_time = []
            row_dist = []
            for j, dest in enumerate(stops_list):
                val = float(route.distance_matrix.get(origin, {}).get(dest, 0.0))
                o_stop = route.stops[origin]
                d_stop = route.stops[dest]
                if i == j:
                    val_dist, val_time = 0.0, 0
                elif val > 0:
                    val_dist = haversine_km(o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng)
                    val_time = val if val > 50 else haversine_travel_sec(
                        o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng
                    )
                else:
                    val_dist = haversine_km(o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng)
                    val_time = haversine_travel_sec(o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng)
                row_dist.append(val_dist)
                row_time.append(int(val_time))
            distance_matrix.append(row_dist)
            travel_time_matrix.append(row_time)

        # ── XGBoost travel-time predictions with cache integration ──────────
        if USE_ML_TRAVEL_TIMES:
            route_total_vol = sum(
                sum(p.volume_cm3 for p in s.packages) for s in route.stops.values()
            )
            executor_cap = route.executor_capacity_cm3 or 1_000_000
            route_load_ratio = min(1.0, route_total_vol / max(executor_cap, 1.0))

            ml_features_flat = []
            pair_meta = []  # (i, j, origin_id, dest_id)
            cache_hits = 0

            for i, origin in enumerate(stops_list):
                for j, dest in enumerate(stops_list):
                    if i == j:
                        continue

                    # ── Cache lookup ──────────────────────────────────────
                    if cache is not None:
                        cached_val = cache.get(route.id, origin, dest)
                        if cached_val is not None:
                            travel_time_matrix[i][j] = int(cached_val)
                            cache_hits += 1
                            continue  # skip ML for this pair

                    # ── Need fresh ML prediction ──────────────────────────
                    d_stop = route.stops[dest]
                    val_dist = distance_matrix[i][j]
                    stop_vol = sum(p.volume_cm3 for p in d_stop.packages)
                    svc_time = sum(p.planned_service_time_seconds for p in d_stop.packages)
                    stop_density = 1.0 / max(val_dist, 0.001)

                    ml_features_flat.append({
                        "distance_km": val_dist,
                        "departure_hour": 8,
                        "num_stops": len(stops_list),
                        "load_ratio": route_load_ratio,
                        "service_time_sec": svc_time,
                        "stop_volume_cm3": stop_vol,
                        "num_packages": len(d_stop.packages),
                        "zone_id": hash(d_stop.zone_id) % 1000 if d_stop.zone_id else 0,
                        "stop_density": stop_density,
                        "executor_capacity_cm3": executor_cap,
                    })
                    pair_meta.append((i, j, origin, dest))

            total_pairs = len(stops_list) * (len(stops_list) - 1)
            if ml_features_flat:
                try:
                    resp = requests.post(
                        f"{ML_API_URL}/predict",
                        json={"stops": ml_features_flat},
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        predicted_times = resp.json().get("predicted_travel_times_sec", [])
                        if len(predicted_times) == len(pair_meta):
                            for idx, (i, j, origin, dest) in enumerate(pair_meta):
                                val = int(max(0, predicted_times[idx]))
                                travel_time_matrix[i][j] = val
                                if cache is not None:
                                    cache.set(route.id, origin, dest, val)
                            print(
                                f"[ML] {len(predicted_times)} new predictions, "
                                f"{cache_hits} from cache "
                                f"(total {total_pairs} pairs, {len(stops_list)} stops)."
                            )
                    else:
                        print(f"[ML] API returned {resp.status_code}: {resp.text[:200]}")
                except Exception as e:
                    print(f"[ML] Prediction failed, using haversine fallback: {e}")
            else:
                print(
                    f"[ML] All {total_pairs} travel-time predictions served from cache "
                    f"({len(stops_list)} stops)."
                )

        # ── Stop demands and service times ───────────────────────────────────
        for i, origin in enumerate(stops_list):
            stop_vol = 0
            stop_svc = 0
            earliest = 0
            latest = 86400

            for p in route.stops[origin].packages:
                stop_vol += p.volume_cm3
                stop_svc += p.planned_service_time_seconds
                if p.zone_restricted:
                    earliest = max(earliest, p.zone_allowed_from_sec)
                    latest = min(latest, p.zone_allowed_to_sec)

            demands.append(int(stop_vol))
            service_times.append(int(stop_svc))
            total_route_demand += int(stop_vol)
            time_windows.append((0, 86400) if i == depot_index else (earliest, latest))

        data["time_matrix"] = travel_time_matrix
        data["demands"] = demands
        data["vehicle_capacities"] = [int(route.executor_capacity_cm3)]
        data["time_windows"] = time_windows
        data["num_vehicles"] = 1
        data["depot"] = depot_index

        # ── OR-Tools model ───────────────────────────────────────────────────
        manager = self.pywrapcp.RoutingIndexManager(
            len(data["time_matrix"]), data["num_vehicles"], data["depot"]
        )
        routing = self.pywrapcp.RoutingModel(manager)

        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return data["time_matrix"][from_node][to_node] + service_times[from_node]

        transit_callback_index = routing.RegisterTransitCallback(time_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        routing.AddDimension(
            transit_callback_index,
            3600,   # allow waiting time (1 hour)
            86400,  # maximum time per vehicle
            False,
            "Time",
        )
        time_dimension = routing.GetDimensionOrDie("Time")
        for node_index in range(len(data["time_matrix"])):
            if node_index == data["depot"]:
                continue
            index = manager.NodeToIndex(node_index)
            time_dimension.CumulVar(index).SetRange(
                data["time_windows"][node_index][0],
                data["time_windows"][node_index][1],
            )

        def demand_callback(from_index):
            return data["demands"][manager.IndexToNode(from_index)]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index, 0, data["vehicle_capacities"], True, "Capacity"
        )

        # ── Search parameters ────────────────────────────────────────────────
        search_parameters = self.pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            self.routing_enums.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            self.routing_enums.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = ORTOOLS_TIME_LIMIT_SEC

        solution = routing.SolveWithParameters(search_parameters)
        execution_time_ms = int(time.time() * 1000) - start_ms

        if solution:
            result = self._extract_solution(
                manager, routing, solution, stops_list, data,
                service_times, total_route_demand, execution_time_ms, distance_matrix,
            )
            seq_metrics = sequence_totals(route, result["sequence"])
            result.update({
                "total_distance_km": seq_metrics["total_distance_km"],
                "total_travel_time_sec": seq_metrics["total_travel_time_sec"],
                "total_service_time_sec": seq_metrics["total_service_time_sec"],
                "fuel_estimate_l": seq_metrics["fuel_estimate_l"],
                "fuel_estimate_inr": seq_metrics["fuel_estimate_inr"],
            })
            return result
        else:
            print("[OR-Tools] No solution found. Time windows or capacities may be too strict.")
            return self._build_empty_response(route)

    def solve(self, route: Route, cache=None, demo_n: int = None) -> dict:
        """Alias for optimize() — used by analytics seeder and benchmark engine."""
        return self.optimize(route, cache=cache, demo_n=demo_n)

    # ── Private helpers ─────────────────────────────────────────────────────

    def _extract_solution(
        self, manager, routing, solution, stops_list, data,
        service_times, total_route_demand, execution_time_ms, distance_matrix,
    ):
        index = routing.Start(0)
        optimized_order = []
        total_time = 0
        total_service = 0

        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            optimized_order.append(stops_list[node_index])
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            if not routing.IsEnd(index):
                next_node = manager.IndexToNode(index)
                total_time += data["time_matrix"][node_index][next_node]
                total_service += service_times[node_index]

        node_index = manager.IndexToNode(index)
        optimized_order.append(stops_list[node_index])  # depot return

        capacity_utilization = (
            (total_route_demand / data["vehicle_capacities"][0]) * 100
            if data["vehicle_capacities"][0] > 0 else 0
        )
        route_efficiency = max(0, min(100, 100.0 - (total_time / 86400 * 100)))

        return {
            "sequence": optimized_order,
            "total_distance_km": 0,          # overwritten by sequence_totals above
            "total_travel_time_sec": total_time,
            "total_service_time_sec": total_service,
            "route_efficiency_score": route_efficiency,
            "capacity_utilization": capacity_utilization,
            "execution_time_ms": execution_time_ms,
        }

    def _build_empty_response(self, route):
        return {
            "sequence": list(route.stops.keys()),
            "total_distance_km": 0,
            "total_travel_time_sec": 0,
            "total_service_time_sec": 0,
            "route_efficiency_score": 0.0,
            "capacity_utilization": 0.0,
            "execution_time_ms": 0,
        }
