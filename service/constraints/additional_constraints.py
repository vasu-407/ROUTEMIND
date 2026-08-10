from core.interfaces import IConstraint
from core.models import Route

class TimeWindowConstraint(IConstraint):
    def validate(self, route: Route) -> bool:
        # In a real system, we simulate the route traversal to check ETA against Time Windows
        # For simplicity here, we assume if OR-Tools outputs it or if the raw sum of service times is huge, it fails.
        # But wait, validate() runs *before* OR-Tools. So we check if the raw Route is intrinsically broken.
        return True # Pre-validation is always true unless a package has a negative time window
        
    def cost(self, route: Route) -> float:
        return 0.0
        
    def repair(self, route: Route) -> Route:
        return route

class WorkingHoursConstraint(IConstraint):
    def validate(self, route: Route) -> bool:
        # Shift hours vs estimated route time
        estimated_seconds = sum(
            pkg.planned_service_time_seconds 
            for stop in route.stops.values() 
            for pkg in stop.packages
        )
        return estimated_seconds <= route.driver_shift_hours * 3600
        
    def cost(self, route: Route) -> float:
        estimated_seconds = sum(pkg.planned_service_time_seconds for stop in route.stops.values() for pkg in stop.packages)
        violation = estimated_seconds - (route.driver_shift_hours * 3600)
        return max(0, violation / 60.0)
        
    def repair(self, route: Route) -> Route:
        estimated_seconds = sum(pkg.planned_service_time_seconds for stop in route.stops.values() for pkg in stop.packages)
        max_sec = route.driver_shift_hours * 3600
        if estimated_seconds <= max_sec:
            return route
            
        # Repair by dropping stops (conceptually)
        for stop_id, stop in list(route.stops.items()):
            for pkg in stop.packages:
                estimated_seconds -= pkg.planned_service_time_seconds
            del route.stops[stop_id]
            if estimated_seconds <= max_sec:
                break
        return route

class ZoneRestrictionConstraint(IConstraint):
    def validate(self, route: Route) -> bool:
        return True
        
    def cost(self, route: Route) -> float:
        return 0.0
        
    def repair(self, route: Route) -> Route:
        return route
