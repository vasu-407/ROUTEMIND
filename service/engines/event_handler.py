"""
Event Handler — Incremental Replanning
=======================================
Handles logistics events (new pickup, failed delivery, traffic, etc.) by
mutating a deep-copy of the current route and running OR-Tools to propose
a new sequence for supervisor approval.

Incremental cache strategy
--------------------------
When a cache is provided, only the arc costs touching *affected* stops are
invalidated and re-predicted.  All other cached predictions are reused,
keeping replan latency well below the 30-second target even on large routes.

Affected-stop rules per event type:
  NEW_PICKUP        → new stop + depot (new arcs radiating from depot)
  FAILED_DELIVERY   → removed stop + depot
  TRAFFIC_DELAY     → all stops (global delay)
  VEHICLE_BREAKDOWN → all removed stops
  ROAD_CLOSURE      → from_stop + to_stop (one arc goes to ∞)
  HUB_CONGESTION    → depot + stops directly adjacent to depot in sequence
"""
import copy
import time
from typing import Optional, Set

from core.models import Route, Stop, Package
from core.geo import haversine_km
from engines.optimization import RouteOptimizer
from engines.greedy_baseline import GreedyBaseline
from engines.route_metrics import sequence_totals


class EventEngine:
    def __init__(
        self,
        optimizer: Optional[RouteOptimizer] = None,
        greedy: Optional[GreedyBaseline] = None,
    ):
        self.optimizer = optimizer or RouteOptimizer()
        self.greedy = greedy or GreedyBaseline()

    # ── Public API ─────────────────────────────────────────────────────────

    def handle_event(
        self,
        event_type: str,
        payload: dict,
        route: Route,
        cache=None,
    ) -> dict:
        """
        Process a logistics event and return a candidate replan result.

        Parameters
        ----------
        event_type : One of NEW_PICKUP | FAILED_DELIVERY | TRAFFIC_DELAY |
                     VEHICLE_BREAKDOWN | ROAD_CLOSURE | HUB_CONGESTION
        payload    : Event-specific data dict.
        route      : Current live route (not mutated — we work on a deep-copy).
        cache      : PredictionCache singleton. Affected segments are invalidated
                     before re-optimization; unaffected predictions are reused.
        """
        start = time.time()
        before_sequence = list(route.stops.keys())

        # Capture the baseline BEFORE any stop removals
        before_metrics = self.greedy.optimize(route)
        before_tot = sequence_totals(route, before_sequence)

        failed_stop_id = None
        failed_stop = None

        # Events mutate a deep-copy — live route is unchanged until supervisor approves
        mutated_route = copy.deepcopy(route)

        # ── Apply event mutation ──────────────────────────────────────────
        if event_type == "NEW_PICKUP":
            loc = payload.get("location", {})
            lat = loc.get("lat", route.stops[before_sequence[0]].lat + 0.01)
            lng = loc.get("lng", route.stops[before_sequence[0]].lng + 0.01)
            new_id = payload.get("pickupId", payload.get("stop_id", f"pickup_{int(time.time())}"))
            mutated_route.stops[new_id] = Stop(id=new_id, lat=lat, lng=lng, type="Pickup")
            mutated_route.stops[new_id].packages.append(
                Package(
                    id=f"pkg_{new_id}", 
                    volume_cm3=payload.get("demand", payload.get("volume_cm3", 1000.0)),
                    planned_service_time_seconds=payload.get("serviceTime", 180)
                )
            )

        elif event_type == "FAILED_DELIVERY":
            stop_id = payload.get("stop_id")
            if not stop_id:
                for sid, stop in route.stops.items():
                    if stop.type != "Station":
                        stop_id = sid
                        break
            if stop_id and stop_id in mutated_route.stops and mutated_route.stops[stop_id].type != "Station":
                failed_stop_id = stop_id
                failed_stop = route.stops[stop_id]   # original ref for message
                del mutated_route.stops[stop_id]

        elif event_type == "TRAFFIC_DELAY":
            delay_sec = int(payload.get("delay_sec", 2700))
            for origin in mutated_route.stops:
                row = mutated_route.distance_matrix.setdefault(origin, {})
                for dest in list(row):
                    row[dest] = float(row[dest]) + delay_sec / max(len(mutated_route.stops), 1)

        elif event_type == "VEHICLE_BREAKDOWN":
            depot = mutated_route.get_depot_id()
            dropoffs = [s for s, st in mutated_route.stops.items() if st.type != "Station"]
            for sid in dropoffs[len(dropoffs) // 2:]:
                del mutated_route.stops[sid]

        elif event_type == "ROAD_CLOSURE":
            a = payload.get("from_stop")
            b = payload.get("to_stop")
            if not (a and b) and len(before_sequence) >= 2:
                a = before_sequence[0]
                b = before_sequence[1]
            if a and b and a in mutated_route.distance_matrix:
                mutated_route.distance_matrix[a][b] = 999_999

        elif event_type == "HUB_CONGESTION":
            depot = mutated_route.get_depot_id()
            if depot:
                for dest in mutated_route.stops:
                    mutated_route.distance_matrix.setdefault(depot, {})[dest] = (
                        mutated_route.distance_matrix.get(depot, {}).get(dest, 0) + 600
                    )

        # ── Incremental cache invalidation ────────────────────────────────
        if cache is not None:
            affected = self._get_affected_stop_ids(
                event_type, payload, route, mutated_route, before_sequence, failed_stop_id
            )
            removed = cache.invalidate_segments(route.id, affected)
            if removed:
                print(
                    f"[cache] Invalidated {removed} arc(s) for {len(affected)} "
                    f"affected stop(s) — event: {event_type}."
                )
            else:
                print(f"[cache] No cache entries affected by event: {event_type}.")

        # ── Re-optimize with cached predictions for unchanged arcs ────────
        after_sequence = list(mutated_route.stops.keys())
        opt = self.optimizer.optimize(mutated_route, cache=cache)
        replan_sec = round(time.time() - start, 2)

        after_tot = {
            "total_distance_km": opt.get("total_distance_km", 0),
            "total_travel_time_sec": opt.get("total_travel_time_sec", 0),
        }

        # ── Driver message for failed delivery ────────────────────────────
        next_nearby_stop = None
        driver_message = None
        if event_type == "FAILED_DELIVERY" and failed_stop:
            remaining = [s for s in mutated_route.stops.values() if s.type != "Station"]
            if remaining:
                nearest = min(
                    remaining,
                    key=lambda s: haversine_km(failed_stop.lat, failed_stop.lng, s.lat, s.lng),
                )
                next_nearby_stop = nearest.id
                dist = haversine_km(failed_stop.lat, failed_stop.lng, nearest.lat, nearest.lng)
                driver_message = (
                    f"Delivery at {failed_stop_id} failed. "
                    f"Proceed to nearby delivery {nearest.id} ({dist:.1f} km away)."
                )

        return {
            "event_type": event_type,
            "before_sequence": before_sequence,
            "after_sequence": opt.get("sequence", after_sequence),
            "changed_stops": len(after_sequence) - len(before_sequence),
            "distance_difference_km": round(
                after_tot["total_distance_km"] - before_tot["total_distance_km"], 2
            ),
            "time_difference_mins": round(
                (after_tot["total_travel_time_sec"] - before_tot["total_travel_time_sec"]) / 60.0, 1
            ),
            "replan_execution_sec": replan_sec,
            "optimized": opt,
            "baseline_before": before_metrics,
            "candidate_route": mutated_route,
            "next_nearby_stop": next_nearby_stop,
            "driver_message": driver_message,
        }

    # ── Private helpers ─────────────────────────────────────────────────────

    def _get_affected_stop_ids(
        self,
        event_type: str,
        payload: dict,
        original_route: Route,
        mutated_route: Route,
        before_sequence: list,
        failed_stop_id: Optional[str],
    ) -> Set[str]:
        """
        Return the set of stop IDs whose arc costs must be re-predicted.
        All other (origin, dest) pairs remain valid in the cache.
        """
        affected: Set[str] = set()
        depot = original_route.get_depot_id()

        if event_type == "NEW_PICKUP":
            new_id = payload.get("stop_id", "")
            if new_id:
                affected.add(new_id)
            # New stop connects to/from depot and nearby stops
            if depot:
                affected.add(depot)

        elif event_type == "FAILED_DELIVERY":
            if failed_stop_id:
                affected.add(failed_stop_id)
            if depot:
                affected.add(depot)

        elif event_type in ("TRAFFIC_DELAY", "VEHICLE_BREAKDOWN"):
            # Global delay / mass removal → invalidate entire route cache
            affected.update(before_sequence)

        elif event_type == "ROAD_CLOSURE":
            a = payload.get("from_stop")
            b = payload.get("to_stop")
            if a:
                affected.add(a)
            if b:
                affected.add(b)

        elif event_type == "HUB_CONGESTION":
            if depot:
                affected.add(depot)
            # First few stops in sequence are most affected by depot congestion
            affected.update(before_sequence[1:4])

        return affected
