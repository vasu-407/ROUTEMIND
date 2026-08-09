"""
Prediction Cache
================
Route-scoped, thread-safe in-memory cache for XGBoost travel-time predictions.

Keys are (origin_stop_id, dest_stop_id) string pairs — stable across index
shifts caused by stop additions/removals during replanning events.

Architecture:
    _store: { route_id -> { (origin_id, dest_id) -> predicted_sec: float } }

Usage (module-level singleton):
    from engines.prediction_cache import prediction_cache

    # Warm on first optimize
    prediction_cache.set(route_id, origin_id, dest_id, value)

    # Retrieve during replan (cache hit → skip ML call)
    val = prediction_cache.get(route_id, origin_id, dest_id)  # None if missing

    # Invalidate only segments touching changed stops
    prediction_cache.invalidate_segments(route_id, {"stop_abc", "stop_xyz"})
"""
import threading
from typing import Dict, Optional, Set, Tuple


class PredictionCache:
    def __init__(self):
        # { route_id: { (origin_id, dest_id): predicted_sec } }
        self._store: Dict[str, Dict[Tuple[str, str], float]] = {}
        self._lock = threading.Lock()
        self._hits: int = 0
        self._misses: int = 0

    # ── Read / Write ─────────────────────────────────────────────────────────

    def get(self, route_id: str, origin_id: str, dest_id: str) -> Optional[float]:
        """Return cached prediction in seconds, or None on a cache miss."""
        with self._lock:
            val = self._store.get(route_id, {}).get((origin_id, dest_id))
            if val is not None:
                self._hits += 1
            else:
                self._misses += 1
            return val

    def set(self, route_id: str, origin_id: str, dest_id: str, value: float) -> None:
        """Store a single prediction."""
        with self._lock:
            if route_id not in self._store:
                self._store[route_id] = {}
            self._store[route_id][(origin_id, dest_id)] = value

    def warm(
        self,
        route_id: str,
        pair_ids: list,   # list of (origin_id, dest_id)
        values: list,     # list of floats (same length)
    ) -> None:
        """Bulk-populate from a single ML batch call result."""
        with self._lock:
            if route_id not in self._store:
                self._store[route_id] = {}
            for (origin_id, dest_id), val in zip(pair_ids, values):
                self._store[route_id][(origin_id, dest_id)] = val

    # ── Invalidation ─────────────────────────────────────────────────────────

    def invalidate_segments(self, route_id: str, affected_stop_ids: Set[str]) -> int:
        """
        Remove cached pairs where either endpoint is in affected_stop_ids.
        This is called before a replan so only changed arc costs are re-predicted.

        Returns the number of cache entries removed.
        """
        if not affected_stop_ids:
            return 0
        with self._lock:
            route_cache = self._store.get(route_id)
            print(f"[cache debug] invalidate_segments for {route_id}. Stored routes: {list(self._store.keys())}, cache size for this route: {len(route_cache) if route_cache else 0}")
            if not route_cache:
                return 0
            to_delete = [
                key for key in route_cache
                if key[0] in affected_stop_ids or key[1] in affected_stop_ids
            ]
            for k in to_delete:
                del route_cache[k]
            return len(to_delete)

    def invalidate_route(self, route_id: str) -> None:
        """Full cache eviction for a route (e.g. when the route itself changes)."""
        with self._lock:
            self._store.pop(route_id, None)

    # ── Introspection ─────────────────────────────────────────────────────────

    def has_route(self, route_id: str) -> bool:
        """True if the route has any cached predictions."""
        with self._lock:
            return bool(self._store.get(route_id))

    def entry_count(self, route_id: str) -> int:
        with self._lock:
            return len(self._store.get(route_id, {}))

    def get_stats(self) -> dict:
        with self._lock:
            total_requests = self._hits + self._misses
            return {
                "cached_routes": len(self._store),
                "total_entries": sum(len(v) for v in self._store.values()),
                "cache_hits": self._hits,
                "cache_misses": self._misses,
                "hit_rate_pct": (
                    round(self._hits / total_requests * 100, 1)
                    if total_requests > 0 else 0.0
                ),
            }

    def reset_stats(self) -> None:
        with self._lock:
            self._hits = 0
            self._misses = 0


# Module-level singleton shared across all API requests
prediction_cache = PredictionCache()
