from core.interfaces import IConstraint
from core.models import Route


class MaxRouteDurationConstraint(IConstraint):
    def __init__(self, max_hours: float = 10.0):
        self.max_sec = int(max_hours * 3600)

    def validate(self, route: Route) -> bool:
        svc = sum(p.planned_service_time_seconds for s in route.stops.values() for p in s.packages)
        return svc <= self.max_sec

    def cost(self, route: Route) -> float:
        svc = sum(p.planned_service_time_seconds for s in route.stops.values() for p in s.packages)
        return max(0.0, (svc - self.max_sec) / 60.0)

    def repair(self, route: Route) -> Route:
        return route


class PriorityDeliveryConstraint(IConstraint):
    """Ensures priority packages are assigned to routes that still have capacity headroom."""

    def validate(self, route: Route) -> bool:
        priority_vol = sum(
            p.volume_cm3 for s in route.stops.values() for p in s.packages if p.priority == "Priority"
        )
        total_vol = sum(p.volume_cm3 for s in route.stops.values() for p in s.packages)
        if priority_vol == 0:
            return True
        return total_vol <= route.executor_capacity_cm3

    def cost(self, route: Route) -> float:
        return 0.0 if self.validate(route) else 50.0

    def repair(self, route: Route) -> Route:
        return route


class DepotRulesConstraint(IConstraint):
    def validate(self, route: Route) -> bool:
        depot = route.get_depot_id()
        return bool(depot and depot in route.stops)

    def cost(self, route: Route) -> float:
        return 0.0 if self.validate(route) else 1000.0

    def repair(self, route: Route) -> Route:
        return route


class TruckEntryTimingConstraint(IConstraint):
    """Large vehicles: respect zone entry windows on restricted packages."""

    def validate(self, route: Route) -> bool:
        if (route.vehicle_type or "").lower() != "truck":
            return True
        for stop in route.stops.values():
            for pkg in stop.packages:
                if pkg.zone_restricted and pkg.zone_allowed_from_sec >= pkg.zone_allowed_to_sec:
                    return False
        return True

    def cost(self, route: Route) -> float:
        return 0.0 if self.validate(route) else 25.0

    def repair(self, route: Route) -> Route:
        return route
