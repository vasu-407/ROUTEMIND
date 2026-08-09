"""
ML Ablation Engine
==================
Scientifically compares routing quality between two modes:

  Mode A — Baseline:
      Haversine straight-line distance → speed formula arc costs.
      Equivalent to ROUTEMIND_USE_ML_TRAVEL_TIMES=false.

  Mode B — RouteMind ML:
      XGBoost learns travel-time patterns from historical Amazon LMRRC
      routing features and provides predicted arc costs to OR-Tools.
      Equivalent to ROUTEMIND_USE_ML_TRAVEL_TIMES=true.

Statistical metrics (per-leg comparison of predicted vs haversine seconds):
  MAE   — Mean Absolute Error
  RMSE  — Root Mean Square Error
  R²    — Coefficient of determination
         R² > 0  → XGBoost captures patterns beyond pure distance
         R² < 0  → haversine is a better arc-cost predictor for this route

Route-level metrics:
  Distance (km), travel time (sec), constraint violations, execution time.

IMPORTANT:
  The current XGBoost model is trained on historical Amazon LMRRC data.
  It learns travel-time patterns from routing features — NOT live traffic.
  Results reflect learned historical patterns, not real-time conditions.
"""
import copy
import math
import time
from typing import List, Optional, Tuple

import engines.optimization as _opt_module
from core.models import Route
from core.geo import haversine_travel_sec, haversine_km
from engines.optimization import RouteOptimizer
from engines.prediction_cache import PredictionCache


class AblationEngine:
    def __init__(self, optimizer: RouteOptimizer):
        self.optimizer = optimizer

    def compare(self, route: Route, constraints=None) -> dict:
        """
        Run haversine baseline and XGBoost ML modes on the same route and
        return a side-by-side comparison with statistical metrics.

        Parameters
        ----------
        route       : Route to evaluate (deep-copied for each mode).
        constraints : List of constraint objects for violation counting.
        """
        stops_list = list(route.stops.keys())

        # ── Mode A: Haversine baseline ──────────────────────────────────────
        route_a = copy.deepcopy(route)
        original_flag = _opt_module.USE_ML_TRAVEL_TIMES
        _opt_module.USE_ML_TRAVEL_TIMES = False
        t0 = time.perf_counter()
        try:
            result_a = self.optimizer.optimize(route_a, cache=None)
        finally:
            _opt_module.USE_ML_TRAVEL_TIMES = original_flag
        time_a_ms = round((time.perf_counter() - t0) * 1000, 1)

        # ── Mode B: XGBoost ML ──────────────────────────────────────────────
        route_b = copy.deepcopy(route)
        fresh_cache = PredictionCache()
        t0 = time.perf_counter()
        result_b = self.optimizer.optimize(route_b, cache=fresh_cache)
        time_b_ms = round((time.perf_counter() - t0) * 1000, 1)

        # ── Per-leg statistical comparison ───────────────────────────────────
        haversine_times: List[float] = []
        ml_times: List[float] = []

        for i, origin in enumerate(stops_list):
            for j, dest in enumerate(stops_list):
                if i == j:
                    continue
                o = route.stops[origin]
                d = route.stops[dest]
                h_sec = haversine_travel_sec(o.lat, o.lng, d.lat, d.lng)
                ml_val = fresh_cache.get(route.id, origin, dest)
                if ml_val is not None:
                    haversine_times.append(h_sec)
                    ml_times.append(ml_val)

        mae, rmse, r2 = _regression_metrics(haversine_times, ml_times)

        # ── Constraint violations ────────────────────────────────────────────
        violations_a = 0
        violations_b = 0
        if constraints:
            from engines.constraint_report import constraint_statuses
            violations_a = sum(
                1 for s in constraint_statuses(route_a, constraints)
                if s["status"] == "violated"
            )
            violations_b = sum(
                1 for s in constraint_statuses(route_b, constraints)
                if s["status"] == "violated"
            )

        # ── Route-level deltas ───────────────────────────────────────────────
        dist_delta = round(
            result_b.get("total_distance_km", 0) - result_a.get("total_distance_km", 0), 2
        )
        time_delta_sec = round(
            result_b.get("total_travel_time_sec", 0) - result_a.get("total_travel_time_sec", 0), 1
        )

        return {
            "route_id": route.id,
            "stop_count": len(stops_list),
            "leg_pairs_evaluated": len(ml_times),
            "note": (
                "XGBoost is trained on historical Amazon LMRRC data. "
                "It learns travel-time patterns from routing features — not live traffic. "
                "ROUTEMIND_USE_ML_TRAVEL_TIMES=false activates haversine-only (ablation) mode."
            ),

            # ── Per-mode results ─────────────────────────────────────────────
            "mode_a_haversine": {
                "label": "Baseline (Haversine)",
                "description": "Straight-line distance → speed formula arc costs",
                "total_distance_km": result_a.get("total_distance_km", 0),
                "total_travel_time_sec": result_a.get("total_travel_time_sec", 0),
                "execution_ms": time_a_ms,
                "constraint_violations": violations_a,
            },
            "mode_b_xgboost": {
                "label": "RouteMind ML (XGBoost)",
                "description": (
                    "XGBoost learns travel-time patterns from historical Amazon "
                    "routing features and provides predicted arc costs to OR-Tools."
                ),
                "total_distance_km": result_b.get("total_distance_km", 0),
                "total_travel_time_sec": result_b.get("total_travel_time_sec", 0),
                "execution_ms": time_b_ms,
                "constraint_violations": violations_b,
            },

            # ── Statistical comparison (XGBoost vs haversine per leg) ────────
            "statistical_comparison": {
                "mae_sec": mae,
                "rmse_sec": rmse,
                "r2": r2,
                "interpretation": _interpret_stats(mae, rmse, r2),
            },

            # ── Route-level delta ────────────────────────────────────────────
            "route_level_delta": {
                "distance_km_delta": dist_delta,
                "travel_time_sec_delta": time_delta_sec,
                "violation_delta": violations_b - violations_a,
                "execution_ms_delta": round(time_b_ms - time_a_ms, 1),
                "interpretation": _interpret_route(dist_delta, time_delta_sec),
            },
        }


# ── Helper functions ─────────────────────────────────────────────────────────

def _regression_metrics(
    y_true: List[float], y_pred: List[float]
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """Compute MAE, RMSE, R² comparing XGBoost predictions to haversine baseline."""
    if not y_true or len(y_true) != len(y_pred):
        return None, None, None
    n = len(y_true)
    mae = sum(abs(p - t) for p, t in zip(y_pred, y_true)) / n
    rmse = math.sqrt(sum((p - t) ** 2 for p, t in zip(y_pred, y_true)) / n)
    mean_t = sum(y_true) / n
    ss_tot = sum((t - mean_t) ** 2 for t in y_true)
    ss_res = sum((t - p) ** 2 for t, p in zip(y_true, y_pred))
    r2 = (1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
    return round(mae, 2), round(rmse, 2), round(r2, 4)


def _interpret_stats(mae, rmse, r2) -> str:
    if mae is None:
        return "Insufficient leg pairs for statistical comparison (ML service may be unavailable)."
    lines = [f"MAE: {mae:.1f}s/leg, RMSE: {rmse:.1f}s/leg, R²: {r2:.3f}."]
    if r2 > 0.3:
        lines.append("XGBoost captures meaningful travel-time patterns beyond straight-line distance.")
    elif r2 > 0.0:
        lines.append("XGBoost provides marginal improvement over haversine arc-cost estimates.")
    else:
        lines.append(
            "For this route, XGBoost and haversine produce similar arc-cost rankings. "
            "Historical patterns may not differ significantly from distance-based estimates here."
        )
    return " ".join(lines)


def _interpret_route(dist_delta: float, time_delta_sec: float) -> str:
    time_delta_min = time_delta_sec / 60
    parts = []
    if abs(dist_delta) < 0.5:
        parts.append("Route distance is similar between both modes.")
    elif dist_delta < 0:
        parts.append(f"XGBoost mode produces a {abs(dist_delta):.1f} km shorter route.")
    else:
        parts.append(f"Haversine mode produces a {abs(dist_delta):.1f} km shorter route for this sample.")
    if abs(time_delta_min) < 1:
        parts.append("Travel time is nearly identical between both modes.")
    elif time_delta_min < 0:
        parts.append(f"XGBoost mode is {abs(time_delta_min):.1f} min faster.")
    else:
        parts.append(f"Haversine mode is {abs(time_delta_min):.1f} min faster for this sample.")
    return " ".join(parts)
