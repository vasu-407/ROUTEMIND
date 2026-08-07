from typing import List
from core.models import Route

class KPIEngine:
    def compute_fleet_kpis(self, routes: List[Route]) -> dict:
        total_stops = 0
        total_capacity = 0
        total_demand = 0
        
        for route in routes:
            total_capacity += route.executor_capacity_cm3
            for stop in route.stops.values():
                total_stops += 1
                for pkg in stop.packages:
                    total_demand += pkg.volume_cm3
                    
        return {
            "total_routes": len(routes),
            "total_stops": total_stops,
            "fleet_capacity_utilization": (total_demand / total_capacity * 100) if total_capacity > 0 else 0,
            "average_stops_per_route": total_stops / len(routes) if routes else 0
        }
