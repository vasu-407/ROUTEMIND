"""Constraint validation summary for API responses."""
from typing import List, Dict
from core.interfaces import IConstraint
from core.models import Route


def constraint_statuses(route: Route, constraints: List[IConstraint]) -> List[Dict]:
    rows = []
    for c in constraints:
        name = c.__class__.__name__
        valid = c.validate(route)
        rows.append({
            "name": name,
            "status": "valid" if valid else "violated",
            "penalty": c.cost(route),
        })
    return rows
