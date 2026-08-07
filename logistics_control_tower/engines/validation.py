from typing import List
from core.models import Route
from core.interfaces import IConstraint

class ValidationEngine:
    def __init__(self, constraints: List[IConstraint]):
        self.constraints = constraints
        
    def validate_and_repair(self, route: Route) -> Route:
        print(f"Validating Route {route.id} against {len(self.constraints)} constraints...")
        
        is_valid = True
        for constraint in self.constraints:
            if not constraint.validate(route):
                print(f"Constraint {constraint.__class__.__name__} failed! Attempting repair...")
                is_valid = False
                route = constraint.repair(route)
                
                # Re-validate after repair
                if not constraint.validate(route):
                    print(f"CRITICAL: Failed to repair route {route.id} for {constraint.__class__.__name__}")
                    raise ValueError(f"Irreparable constraint violation: {constraint.__class__.__name__}")
                else:
                    print(f"Successfully repaired {constraint.__class__.__name__} violation.")
                    
        return route
