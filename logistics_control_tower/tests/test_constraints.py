import pytest
from core.models import Route, Stop, Package
from constraints.capacity import CapacityConstraint
from constraints.cod_limit import CODLimitConstraint

def test_capacity_constraint():
    route = Route(id="test", station_code="depot", executor_capacity_cm3=100.0)
    stop = Stop(id="s1", lat=0, lng=0, type="Dropoff")
    stop.packages.append(Package(id="p1", volume_cm3=50.0))
    stop.packages.append(Package(id="p2", volume_cm3=60.0))
    route.stops["s1"] = stop
    
    constraint = CapacityConstraint()
    assert not constraint.validate(route), "Should fail validation"
    assert constraint.cost(route) > 0
    
    repaired_route = constraint.repair(route)
    assert constraint.validate(repaired_route), "Should pass after repair"

def test_cod_limit_constraint():
    route = Route(id="test", station_code="depot", executor_capacity_cm3=100.0)
    stop = Stop(id="s1", lat=0, lng=0, type="Dropoff")
    stop.packages.append(Package(id="p1", volume_cm3=10, is_cod=True, cod_amount=30000.0))
    stop.packages.append(Package(id="p2", volume_cm3=10, is_cod=True, cod_amount=40000.0))
    route.stops["s1"] = stop
    
    constraint = CODLimitConstraint(max_cash_carry=50000.0)
    assert not constraint.validate(route), "Should fail COD limit"
    
    repaired = constraint.repair(route)
    assert constraint.validate(repaired), "Should pass after popping COD package"
