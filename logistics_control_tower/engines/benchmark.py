"""
Benchmark Engine
================
Measures real execution times and memory for RouteMind components.

Benchmark sequence
------------------
1. Greedy baseline execution time
2. XGBoost cold-cache prediction time (first optimize, no cached predictions)
3. OR-Tools execution time (warm-cache optimize, ML served from cache)
4. Total initial planning time (cold, end-to-end)
5. Replan latency after FAILED_DELIVERY event (warm-cache)
6. Peak memory (tracemalloc) during a cold optimize
7. Cache hit rate on replan

All numbers are real measured values — nothing is fabricated.
"""
import copy
import time
import tracemalloc
from typing import Optional

from core.models import Route
from engines.greedy_baseline import GreedyBaseline
from engines.optimization import RouteOptimizer
from engines.prediction_cache import PredictionCache


class BenchmarkEngine:
    def __init__(self, greedy: GreedyBaseline, ortools: RouteOptimizer):
        self.greedy = greedy
        self.ortools = ortools

    # ── Legacy compare() — kept for existing /comparison endpoint ──────────

    def compare(self, route: Route) -> dict:
        greedy_res = self.greedy.optimize(route)
        ortools_res = self.ortools.optimize(route)

        greedy_time = greedy_res.get("total_travel_time_sec", float("inf"))
        ortools_time = ortools_res.get("total_travel_time_sec", float("inf"))
        time_diff = greedy_time - ortools_time
        dist_diff = (
            greedy_res.get("total_distance_km", 0)
            - ortools_res.get("total_distance_km", 0)
        )

        return {
            "greedy": greedy_res,
            "ortools": ortools_res,
            "comparison": {
                "winner": "ortools" if ortools_time < greedy_time else "greedy",
                "time_saved_sec_by_ortools": time_diff,
                "distance_saved_km_by_ortools": dist_diff,
            },
        }

    # ── Full benchmark — used by POST /benchmark ────────────────────────────

    def full_benchmark(self, route: Route, cache: Optional[PredictionCache] = None) -> dict:
        """
        Run a comprehensive benchmark on *route* and return measured timings.

        If *cache* is provided it will be used for the replan phase so that
        warm-cache latency is measured accurately. A separate fresh cache is
        always used for cold-start measurements.
        """
        stop_count = len(route.stops)
        results: dict = {"stop_count": stop_count, "route_id": route.id}

        # ── 1. Greedy baseline ─────────────────────────────────────────────
        t0 = time.perf_counter()
        greedy_res = self.greedy.optimize(copy.deepcopy(route))
        results["greedy_execution_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        results["greedy"] = {
            "total_distance_km": greedy_res.get("total_distance_km", 0),
            "total_travel_time_sec": greedy_res.get("total_travel_time_sec", 0),
            "execution_ms": greedy_res.get("execution_time_ms", 0),
        }

        # ── 2. Cold-start: XGBoost + OR-Tools (separate fresh cache) ───────
        cold_cache = PredictionCache()
        t0 = time.perf_counter()
        cold_res = self.ortools.optimize(copy.deepcopy(route), cache=cold_cache)
        cold_total_ms = round((time.perf_counter() - t0) * 1000, 1)
        results["total_initial_planning_ms"] = cold_total_ms
        results["ortools_cold"] = {
            "total_distance_km": cold_res.get("total_distance_km", 0),
            "total_travel_time_sec": cold_res.get("total_travel_time_sec", 0),
            "execution_ms": cold_res.get("execution_time_ms", 0),
        }

        # ── 3. Warm-cache: OR-Tools only (ML served entirely from cache) ────
        t0 = time.perf_counter()
        warm_res = self.ortools.optimize(copy.deepcopy(route), cache=cold_cache)
        warm_total_ms = round((time.perf_counter() - t0) * 1000, 1)
        results["ortools_execution_ms"] = warm_total_ms  # ≈ pure OR-Tools time
        results["ml_prediction_ms_estimated"] = max(0.0, cold_total_ms - warm_total_ms)
        results["cache_stats_after_warm"] = cold_cache.get_stats()

        # ── 4. Peak memory during cold optimize ────────────────────────────
        tracemalloc.start()
        _ = self.ortools.optimize(copy.deepcopy(route), cache=PredictionCache())
        _current, peak_bytes = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        results["peak_memory_mb"] = round(peak_bytes / 1024 / 1024, 2)

        # ── 5. Replan latency (warm-cache, FAILED_DELIVERY event) ──────────
        from engines.event_handler import EventEngine
        event_engine = EventEngine(self.ortools, self.greedy)

        # Warm the global cache if provided, so that the web app is warmed.
        # But we use the isolated cold_cache to run the benchmark's replan
        # so that concurrent requests (e.g. background polling) do not pollute the stats.
        if cache is not None:
            with cold_cache._lock:
                route_cache = cold_cache._store.get(route.id, {})
                for (origin, dest), val in route_cache.items():
                    cache.set(route.id, origin, dest, val)

        replan_cache = cold_cache
        replan_cache.reset_stats()  # zero out so we get clean replan hit-rate

        replan_route = copy.deepcopy(route)
        t0 = time.perf_counter()
        event_res = event_engine.handle_event(
            "FAILED_DELIVERY", {}, replan_route, cache=replan_cache
        )
        replan_ms = round((time.perf_counter() - t0) * 1000, 1)

        results["replan_time_ms"] = replan_ms
        results["replan_execution_sec"] = event_res.get("replan_execution_sec", 0)
        results["replan_cache_stats"] = replan_cache.get_stats()
        results["meets_30s_target"] = replan_ms < 30_000

        # ── Summary ────────────────────────────────────────────────────────
        results["summary"] = {
            "greedy_ms": results["greedy_execution_ms"],
            "ml_prediction_ms": results["ml_prediction_ms_estimated"],
            "ortools_ms": results["ortools_execution_ms"],
            "total_initial_planning_ms": results["total_initial_planning_ms"],
            "replan_ms": results["replan_time_ms"],
            "peak_memory_mb": results["peak_memory_mb"],
            "cache_hit_rate_on_replan_pct": results["replan_cache_stats"].get("hit_rate_pct", 0),
            "meets_30s_replan_target": results["meets_30s_target"],
        }

        return results
