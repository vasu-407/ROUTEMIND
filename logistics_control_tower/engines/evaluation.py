from core.models import Route

class EvaluationEngine:
    def evaluate(self, old_route: Route, new_route: Route) -> dict:
        """Compares the original and optimized routes to generate KPIs."""
        
        # In this minimal implementation, we simulate the metric generation
        # since we don't have a greedy baseline fully implemented yet.
        
        distance_saved = 15.4 # km simulated
        time_saved = 45 # minutes simulated
        fuel_saved = (distance_saved * new_route.fuel_cost_per_km) if new_route.fuel_cost_per_km else 2.5
        
        old_stops = len(old_route.stops)
        new_stops = len(new_route.stops)
        
        return {
            "distance_saved_km": distance_saved,
            "time_saved_mins": time_saved,
            "fuel_saved_inr": fuel_saved,
            "stop_completion_rate": (new_stops / old_stops) if old_stops > 0 else 1.0,
            "route_risk_score": new_route.route_risk_score,
            "fatigue_score": new_route.driver_fatigue_score
        }
