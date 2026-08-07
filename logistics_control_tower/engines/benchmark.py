from engines.greedy_baseline import GreedyBaseline
from engines.optimization import RouteOptimizer
from core.models import Route

class BenchmarkEngine:
    def __init__(self, greedy: GreedyBaseline, ortools: RouteOptimizer):
        self.greedy = greedy
        self.ortools = ortools
        
    def compare(self, route: Route) -> dict:
        greedy_res = self.greedy.optimize(route)
        ortools_res = self.ortools.optimize(route)
        
        ortools_time = ortools_res.get("total_travel_time_sec", float('inf'))
        greedy_time = greedy_res.get("total_travel_time_sec", float('inf'))
        
        time_diff = greedy_time - ortools_time
        dist_diff = greedy_res.get("total_distance_km", 0) - ortools_res.get("total_distance_km", 0)
        
        return {
            "greedy": greedy_res,
            "ortools": ortools_res,
            "comparison": {
                "winner": "ortools" if ortools_time < greedy_time else "greedy",
                "time_saved_sec_by_ortools": time_diff,
                "distance_saved_km_by_ortools": dist_diff
            }
        }
