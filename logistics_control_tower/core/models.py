from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any

@dataclass
class Package:
    id: str
    volume_cm3: float
    is_cod: bool = False
    cod_amount: float = 0.0
    priority: str = "Standard"
    weight_kg: float = 0.0
    zone_restricted: bool = False
    zone_allowed_from_sec: int = 0
    zone_allowed_to_sec: int = 86400
    planned_service_time_seconds: float = 0.0

@dataclass
class Stop:
    id: str
    lat: float
    lng: float
    type: str  # 'Dropoff' or 'Station'
    zone_id: Optional[str] = None
    packages: List[Package] = field(default_factory=list)

@dataclass
class Route:
    id: str
    station_code: str
    executor_capacity_cm3: float
    stops: Dict[str, Stop] = field(default_factory=dict)
    distance_matrix: Dict[str, Dict[str, float]] = field(default_factory=dict)
    
    # Enriched metadata
    driver_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    driver_shift_hours: int = 8
    driver_current_cash: float = 0.0
    traffic_level: str = "Low"
    fuel_cost_per_km: float = 0.0
    driver_fatigue_score: float = 0.0
    route_risk_score: float = 0.0
    
    def get_depot_id(self) -> str:
        for stop_id, stop in self.stops.items():
            if stop.type == "Station":
                return stop_id
        return ""
