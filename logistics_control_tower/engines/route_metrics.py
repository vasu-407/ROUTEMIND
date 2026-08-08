"""Compute distance / time along a stop sequence."""
from core.geo import haversine_km, haversine_travel_sec
from core.models import Route


def leg_cost(route: Route, origin: str, dest: str) -> tuple[float, float]:
    """Returns (distance_km, travel_time_sec)."""
    matrix = route.distance_matrix or {}
    val = float(matrix.get(origin, {}).get(dest, 0.0))
    if val > 0:
        # Dataset travel_times are typically seconds
        dist_km = val / 100.0 if val > 500 else haversine_km(
            route.stops[origin].lat, route.stops[origin].lng,
            route.stops[dest].lat, route.stops[dest].lng,
        )
        travel_sec = val if val > 10 else haversine_travel_sec(
            route.stops[origin].lat, route.stops[origin].lng,
            route.stops[dest].lat, route.stops[dest].lng,
        )
        return dist_km, travel_sec

    o, d = route.stops[origin], route.stops[dest]
    dist_km = haversine_km(o.lat, o.lng, d.lat, d.lng)
    return dist_km, haversine_travel_sec(o.lat, o.lng, d.lat, d.lng)


def sequence_totals(route: Route, sequence: list[str]) -> dict:
    total_dist = 0.0
    total_time = 0.0
    total_service = 0.0
    for i in range(len(sequence) - 1):
        d_km, t_sec = leg_cost(route, sequence[i], sequence[i + 1])
        total_dist += d_km
        total_time += t_sec
        total_service += sum(p.planned_service_time_seconds for p in route.stops[sequence[i]].packages)
    if sequence:
        last = sequence[-1]
        total_service += sum(p.planned_service_time_seconds for p in route.stops[last].packages)

    total_vol = sum(p.volume_cm3 for s in route.stops.values() for p in s.packages)
    cap = route.executor_capacity_cm3 or 1.0
    utilization = (total_vol / cap) * 100
    efficiency = max(0.0, min(100.0, 100.0 - (total_time / max(route.driver_shift_hours * 3600, 1)) * 10))

    return {
        "total_distance_km": round(total_dist, 2),
        "total_travel_time_sec": int(total_time),
        "total_service_time_sec": int(total_service),
        "route_efficiency_score": round(efficiency, 1),
        "capacity_utilization": round(utilization, 1),
        "fuel_estimate_l": round(total_dist * 0.12, 2),
        "fuel_estimate_inr": round(total_dist * (route.fuel_cost_per_km or 8.5), 2),
    }
