from core.interfaces import IConstraint
from core.models import Route

class CODLimitConstraint(IConstraint):
    def __init__(self, max_cash_carry: float = 50000.0):
        self.max_cash_carry = max_cash_carry

    def validate(self, route: Route) -> bool:
        total_cod = route.driver_current_cash + sum(
            pkg.cod_amount 
            for stop in route.stops.values() 
            for pkg in stop.packages if pkg.is_cod
        )
        return total_cod <= self.max_cash_carry
        
    def cost(self, route: Route) -> float:
        total_cod = route.driver_current_cash + sum(
            pkg.cod_amount 
            for stop in route.stops.values() 
            for pkg in stop.packages if pkg.is_cod
        )
        violation = total_cod - self.max_cash_carry
        return max(0, violation * 0.5)
        
    def repair(self, route: Route) -> Route:
        total_cod = route.driver_current_cash + sum(
            pkg.cod_amount 
            for stop in route.stops.values() 
            for pkg in stop.packages if pkg.is_cod
        )
        if total_cod <= self.max_cash_carry:
            return route
            
        for stop in route.stops.values():
            for i in range(len(stop.packages) - 1, -1, -1):
                if stop.packages[i].is_cod and total_cod > self.max_cash_carry:
                    removed = stop.packages.pop(i)
                    total_cod -= removed.cod_amount
                    
        return route
