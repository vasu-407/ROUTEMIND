from abc import ABC, abstractmethod
from core.models import Route

class IConstraint(ABC):
    @abstractmethod
    def validate(self, route: Route) -> bool:
        """Returns True if the route is valid according to this constraint, False otherwise."""
        pass
        
    @abstractmethod
    def cost(self, route: Route) -> float:
        """Returns a penalty cost if violated (soft constraint), or 0 if valid."""
        pass
        
    @abstractmethod
    def repair(self, route: Route) -> Route:
        """Attempts to fix the constraint violation, returning the modified Route. Raises an error if unfixable."""
        pass
