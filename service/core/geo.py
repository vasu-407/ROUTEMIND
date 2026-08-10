"""Shared geospatial helpers."""
import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def haversine_travel_sec(lat1: float, lon1: float, lat2: float, lon2: float, avg_speed_kmh: float = 30.0) -> int:
    dist = haversine_km(lat1, lon1, lat2, lon2)
    if dist <= 0:
        return 0
    return max(1, int((dist / avg_speed_kmh) * 3600))
