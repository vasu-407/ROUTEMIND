"""Lazy travel-time matrix access for Amazon LMRRC dataset."""
import json
import os
from typing import Dict, Optional

from core.config import DATA_DIR

_cache: Dict[str, Dict[str, Dict[str, float]]] = {}
_full_file_loaded = False
_full_travel_times: Optional[Dict] = None


def _travel_times_path() -> str:
    return os.path.join(DATA_DIR, "travel_times.json")


def load_route_matrix(route_id: str) -> Dict[str, Dict[str, float]]:
    """Return travel-time matrix for one route (seconds or dataset units). Empty if unavailable."""
    if route_id in _cache:
        return _cache[route_id]

    path = _travel_times_path()
    if not os.path.isfile(path):
        _cache[route_id] = {}
        return _cache[route_id]

    global _full_file_loaded, _full_travel_times
    size = os.path.getsize(path)
    # Avoid loading multi-GB file into memory; use per-route cache files if present.
    cache_dir = os.path.join(DATA_DIR, "travel_times_cache")
    cache_file = os.path.join(cache_dir, f"{route_id}.json")
    if os.path.isfile(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            _cache[route_id] = json.load(f)
        return _cache[route_id]

    if size <= 80_000_000 and not _full_file_loaded:
        with open(path, "r", encoding="utf-8") as f:
            _full_travel_times = json.load(f)
        _full_file_loaded = True

    if _full_travel_times is not None:
        _cache[route_id] = _full_travel_times.get(route_id, {})
        return _cache[route_id]

    _cache[route_id] = {}
    return _cache[route_id]
