from core.interfaces import IConstraint
from core.models import Route

class CapacityConstraint(IConstraint):
    def validate(self, route: Route) -> bool:
        total_volume = sum(
            pkg.volume_cm3 
            for stop in route.stops.values() 
            for pkg in stop.packages
        )
        return total_volume <= route.executor_capacity_cm3
        
    def cost(self, route: Route) -> float:
        total_volume = sum(
            pkg.volume_cm3 
            for stop in route.stops.values() 
            for pkg in stop.packages
        )
        violation = total_volume - route.executor_capacity_cm3
        return max(0, violation * 10.0) # Penalty multiplier
        
    def repair(self, route: Route) -> Route:
        # Simplistic repair: remove packages until under capacity
        # In a real scenario, we would mark them as failed deliveries or split the route
        total_volume = sum(pkg.volume_cm3 for stop in route.stops.values() for pkg in stop.packages)
        if total_volume <= route.executor_capacity_cm3:
            return route
            
        for stop in route.stops.values():
            while stop.packages and total_volume > route.executor_capacity_cm3:
                removed = stop.packages.pop()
                total_volume -= removed.volume_cm3
                
        return route
