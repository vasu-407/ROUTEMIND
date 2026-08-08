import copy
import time
from typing import Optional

from core.models import Route, Stop, Package
from engines.optimization import RouteOptimizer
from engines.greedy_baseline import GreedyBaseline
from engines.route_metrics import sequence_totals
from core.geo import haversine_km


class EventEngine:
    def __init__(self, optimizer: Optional[RouteOptimizer] = None, greedy: Optional[GreedyBaseline] = None):
        self.optimizer = optimizer or RouteOptimizer()
        self.greedy = greedy or GreedyBaseline()

    def handle_event(self, event_type: str, payload: dict, route: Route) -> dict:
        start = time.time()
        before_sequence = list(route.stops.keys())
        # Capture the baseline before changing the route.  Some events remove
        # stops, so calculating it afterwards can try to access a deleted stop.
        before_metrics = self.greedy.optimize(route)
        before_tot = sequence_totals(route, before_sequence)
        failed_stop_id = None
        failed_stop = None

        # Events create a candidate plan.  The active route remains unchanged
        # until a supervisor explicitly approves the replan.
        route = copy.deepcopy(route)

        if event_type == "NEW_PICKUP":
            lat = payload.get("lat", route.stops[before_sequence[0]].lat + 0.01)
            lng = payload.get("lng", route.stops[before_sequence[0]].lng + 0.01)
            new_id = payload.get("stop_id", f"pickup_{int(time.time())}")
            route.stops[new_id] = Stop(id=new_id, lat=lat, lng=lng, type="Pickup")
            route.stops[new_id].packages.append(
                Package(id=f"pkg_{new_id}", volume_cm3=payload.get("volume_cm3", 1000.0))
            )

        elif event_type == "FAILED_DELIVERY":
            stop_id = payload.get("stop_id")
            if not stop_id:
                for sid, stop in route.stops.items():
                    if stop.type == "Dropoff":
                        stop_id = sid
                        break
            if stop_id and stop_id in route.stops and route.stops[stop_id].type != "Station":
                failed_stop_id = stop_id
                failed_stop = route.stops[stop_id]
                del route.stops[stop_id]

        elif event_type == "TRAFFIC_DELAY":
            delay_sec = int(payload.get("delay_sec", 2700))
            for origin in route.stops:
                row = route.distance_matrix.setdefault(origin, {})
                for dest, val in list(row.items()):
                    row[dest] = float(val) + delay_sec / max(len(route.stops), 1)

        elif event_type == "VEHICLE_BREAKDOWN":
            depot = route.get_depot_id()
            dropoffs = [s for s, st in route.stops.items() if st.type != "Station"]
            for sid in dropoffs[len(dropoffs) // 2 :]:
                del route.stops[sid]
            if depot and depot not in route.stops:
                pass

        elif event_type == "ROAD_CLOSURE":
            a, b = payload.get("from_stop"), payload.get("to_stop")
            if a and b and a in route.distance_matrix:
                route.distance_matrix[a][b] = 999999

        elif event_type == "HUB_CONGESTION":
            depot = route.get_depot_id()
            if depot:
                for dest in route.stops:
                    route.distance_matrix.setdefault(depot, {})[dest] = (
                        route.distance_matrix.get(depot, {}).get(dest, 0) + 600
                    )

        after_sequence = list(route.stops.keys())
        opt = self.optimizer.optimize(route)
        replan_sec = round(time.time() - start, 2)

        after_tot = {
            "total_distance_km": opt.get("total_distance_km", 0),
            "total_travel_time_sec": opt.get("total_travel_time_sec", 0),
        }
        next_nearby_stop = None
        driver_message = None
        if event_type == "FAILED_DELIVERY" and failed_stop:
            remaining_dropoffs = [stop for stop in route.stops.values() if stop.type != "Station"]
            if remaining_dropoffs:
                nearest = min(
                    remaining_dropoffs,
                    key=lambda stop: haversine_km(failed_stop.lat, failed_stop.lng, stop.lat, stop.lng),
                )
                next_nearby_stop = nearest.id
                distance_to_next = haversine_km(failed_stop.lat, failed_stop.lng, nearest.lat, nearest.lng)
                driver_message = (
                    f"Delivery at {failed_stop_id} failed. Proceed to nearby delivery {nearest.id} "
                    f"({distance_to_next:.1f} km away) to stay on schedule."
                )

        return {
            "event_type": event_type,
            "before_sequence": before_sequence,
            "after_sequence": opt.get("sequence", after_sequence),
            "changed_stops": len(after_sequence) - len(before_sequence),
            "distance_difference_km": round(after_tot["total_distance_km"] - before_tot["total_distance_km"], 2),
            "time_difference_mins": round((after_tot["total_travel_time_sec"] - before_tot["total_travel_time_sec"]) / 60.0, 1),
            "replan_execution_sec": replan_sec,
            "optimized": opt,
            "baseline_before": before_metrics,
            "candidate_route": route,
            "next_nearby_stop": next_nearby_stop,
            "driver_message": driver_message,
        }
