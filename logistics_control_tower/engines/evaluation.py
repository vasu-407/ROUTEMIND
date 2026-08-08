from core.models import Route


class EvaluationEngine:
    def evaluate(self, greedy_result: dict, ortools_result: dict, route: Route) -> dict:
        greedy_time = greedy_result.get("total_travel_time_sec", 0)
        or_time = ortools_result.get("total_travel_time_sec", 0)
        greedy_dist = greedy_result.get("total_distance_km", 0)
        or_dist = ortools_result.get("total_distance_km", 0)

        time_saved = max(0, (greedy_time - or_time) / 60.0)
        dist_saved = max(0, greedy_dist - or_dist)
        fuel_saved = dist_saved * (route.fuel_cost_per_km or 8.5)

        return {
            "time_saved_mins": round(time_saved, 1),
            "distance_saved_km": round(dist_saved, 2),
            "fuel_saved_inr": round(fuel_saved, 2),
            "fuel_saved_l": round(dist_saved * 0.12, 2),
            "stop_completion_rate": 1.0,
            "route_risk_score": route.route_risk_score,
            "fatigue_score": route.driver_fatigue_score,
            "execution_time_ms": ortools_result.get("execution_time_ms", 0),
        }
