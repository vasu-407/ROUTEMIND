from core.models import Route
from core.geo import haversine_km, haversine_travel_sec
from engines.route_metrics import sequence_totals
import time


class GreedyBaseline:
    def optimize(self, route: Route) -> dict:
        start_ms = int(time.time() * 1000)

        stops_list = list(route.stops.keys())
        if len(stops_list) < 2:
            return self._build_empty_response(route)

        depot_id = route.get_depot_id()
        if not depot_id or depot_id not in stops_list:
            depot_id = stops_list[0]

        unvisited = set(stops_list)
        unvisited.remove(depot_id)

        sequence = [depot_id]
        current_node = depot_id

        while unvisited:
            best_next = None
            best_cost = float("inf")

            for candidate in unvisited:
                val = float(route.distance_matrix.get(current_node, {}).get(candidate, 0.0))
                if val == 0.0:
                    o, d = route.stops[current_node], route.stops[candidate]
                    cost = haversine_travel_sec(o.lat, o.lng, d.lat, d.lng)
                else:
                    cost = val

                if cost < best_cost:
                    best_cost = cost
                    best_next = candidate

            if not best_next:
                best_next = unvisited.pop()
                best_cost = 1000
            else:
                unvisited.remove(best_next)

            sequence.append(best_next)
            current_node = best_next

        sequence.append(depot_id)
        execution_time_ms = int(time.time() * 1000) - start_ms
        metrics = sequence_totals(route, sequence)
        metrics["sequence"] = sequence
        metrics["execution_time_ms"] = execution_time_ms
        return metrics

    def _build_empty_response(self, route):
        seq = list(route.stops.keys())
        metrics = sequence_totals(route, seq) if len(seq) > 1 else {
            "total_distance_km": 0,
            "total_travel_time_sec": 0,
            "total_service_time_sec": 0,
            "route_efficiency_score": 0.0,
            "capacity_utilization": 0.0,
            "fuel_estimate_l": 0,
            "fuel_estimate_inr": 0,
        }
        metrics["sequence"] = seq
        metrics["execution_time_ms"] = 0
        return metrics
