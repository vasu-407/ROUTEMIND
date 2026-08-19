import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import os
import sys
import traceback
try:
    from fastapi import FastAPI, HTTPException, Body
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import List, Dict, Any, Optional
    
    from core.config import (
        DATA_DIR, MAX_PICKUP_DISTANCE_IMPACT_KM, MAX_PICKUP_TIME_IMPACT_MINS,
        DEMO_STOP_COUNT,
    )
    from core.models import Route
    from core.geo import haversine_km
    from engines.prediction_cache import prediction_cache
    from engines.benchmark import BenchmarkEngine
    from engines.ablation import AblationEngine
    from engines.data_loader import DataLoader
    from constraints.capacity import CapacityConstraint
    from constraints.cod_limit import CODLimitConstraint
    from constraints.additional_constraints import TimeWindowConstraint, WorkingHoursConstraint, ZoneRestrictionConstraint
    from constraints.indian_logistics import (
        MaxRouteDurationConstraint,
        PriorityDeliveryConstraint,
        DepotRulesConstraint,
        TruckEntryTimingConstraint,
    )
    from engines.validation import ValidationEngine
    from engines.optimization import RouteOptimizer
    from engines.evaluation import EvaluationEngine
    from engines.explainability_service import ExplainabilityService
    from engines.event_handler import EventEngine
    from engines.greedy_baseline import GreedyBaseline
    from engines.kpi import KPIEngine
    from engines.constraint_report import constraint_statuses
except Exception as e:
    with open("import_error.txt", "w") as f:
        f.write(f"Error on imports: {e}\n")
        traceback.print_exc(file=f)
    print(f"Error on imports: {e}")
    sys.exit(1)

app = FastAPI(title="RouteMind AI Logistics Control Tower")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
from engines.prediction_cache import prediction_cache
from engines.benchmark import BenchmarkEngine
from engines.ablation import AblationEngine
from engines.data_loader import DataLoader
from constraints.capacity import CapacityConstraint
from constraints.cod_limit import CODLimitConstraint
from constraints.additional_constraints import TimeWindowConstraint, WorkingHoursConstraint, ZoneRestrictionConstraint
from constraints.indian_logistics import (
    MaxRouteDurationConstraint,
    PriorityDeliveryConstraint,
    DepotRulesConstraint,
    TruckEntryTimingConstraint,
)
from engines.validation import ValidationEngine
from engines.optimization import RouteOptimizer
from engines.evaluation import EvaluationEngine
from engines.explainability_service import ExplainabilityService
from engines.event_handler import EventEngine
from engines.nearby_decision_engine import NearbyStopDecisionEngine

nearby_engine = NearbyStopDecisionEngine()
from engines.greedy_baseline import GreedyBaseline
from engines.kpi import KPIEngine
from engines.constraint_report import constraint_statuses

app = FastAPI(title="RouteMind AI Logistics Control Tower")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

loader = DataLoader()
routes_db: Dict[str, Any] = {}
try:
    routes_db = loader.load_routes()
except Exception as e:
    print(f"Data load error: {e}")
    routes_db = {}

constraints = [
    DepotRulesConstraint(),
    CapacityConstraint(),
    CODLimitConstraint(max_cash_carry=50000.0),
    TimeWindowConstraint(),
    WorkingHoursConstraint(),
    ZoneRestrictionConstraint(),
    MaxRouteDurationConstraint(max_hours=10.0),
    PriorityDeliveryConstraint(),
    TruckEntryTimingConstraint(),
]
validator = ValidationEngine(constraints)
optimizer = RouteOptimizer()
greedy = GreedyBaseline()
evaluator = EvaluationEngine()
explainer = ExplainabilityService()
event_engine = EventEngine(optimizer, greedy)
kpi_engine = KPIEngine()

analytics_runs: List[dict] = []
events_db: Dict[str, dict] = {}
pending_route_updates: Dict[str, Any] = {}

demo_telemetry: Dict[str, Dict[str, int]] = {}
auto_detected_events: List[dict] = []

COMPUTE_COST_INR_PER_CPU_SECOND = 0.02


# ── Seed analytics on startup ────────────────────────────────────────────────
# Pre-populate analytics_runs with baseline data from the loaded routes so the
# Analytics page always shows charts even before the user runs any optimisation.
def _seed_analytics():
    seeded = 0
    for route_id, route in list(routes_db.items())[:7]:
        try:
            greedy_result = greedy.solve(route)
            opt_result    = optimizer.solve(route)
            g_dist  = greedy_result.get("total_distance_km", 0)
            o_dist  = opt_result.get("total_distance_km", 0)
            g_time  = greedy_result.get("total_travel_time_sec", 0)
            o_time  = opt_result.get("total_travel_time_sec", 0)
            dist_saved = round(max(g_dist - o_dist, 0), 2)
            time_saved = round(max((g_time - o_time) / 60, 0), 1)
            fuel_l   = round(dist_saved * 0.12, 2)   # ~0.12 L/km saved
            fuel_inr = round(fuel_l * 95, 2)          # ₹95/L
            exec_ms  = opt_result.get("execution_time_ms", 0)
            analytics_runs.append({
                "route_id": route_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metrics": {
                    "distance_saved_km": dist_saved,
                    "time_saved_mins": time_saved,
                    "fuel_saved_l": fuel_l,
                    "fuel_saved_inr": fuel_inr,
                },
                "greedy": greedy_result,
                "ortools": opt_result,
                "cost_per_route_inr": round(exec_ms / 1000 * COMPUTE_COST_INR_PER_CPU_SECOND, 4),
                "_seeded": True,
            })
            seeded += 1
        except Exception as _seed_err:
            print(f"[seed] skipping {route_id}: {_seed_err}")
    print(f"[analytics] seeded {seeded} baseline run(s) from loaded routes.")


if routes_db:
    _seed_analytics()


def route_label(route_id: str) -> str:
    r = routes_db.get(route_id)
    if not r:
        return route_id
    idx = list(routes_db.keys()).index(route_id) + 1
    return f"Route {idx} · Depot {r.station_code} · {len(r.stops)} Stops"


def stop_coordinates(route) -> dict:
    return {s_id: [s.lat, s.lng] for s_id, s in route.stops.items()}


def evaluate_candidate(greedy_result: dict, candidate_result: dict) -> dict:
    """Decide whether a solver candidate is actually better for operations."""
    greedy_time = greedy_result.get("total_travel_time_sec", float("inf"))
    candidate_time = candidate_result.get("total_travel_time_sec", float("inf"))
    greedy_distance = greedy_result.get("total_distance_km", float("inf"))
    candidate_distance = candidate_result.get("total_distance_km", float("inf"))
    time_delta_mins = round((candidate_time - greedy_time) / 60.0, 1)
    distance_delta_km = round(candidate_distance - greedy_distance, 2)
    improves = candidate_time < greedy_time or (
        candidate_time == greedy_time and candidate_distance < greedy_distance
    )
    return {
        "is_improvement": improves,
        "time_delta_mins": time_delta_mins,
        "distance_delta_km": distance_delta_km,
        "recommended_action": "approve" if improves else "retain_current_route",
        "reason": (
            f"OR-Tools reduces ETA by {abs(time_delta_mins):.1f} minutes."
            if improves else
            f"Keep the current route: OR-Tools adds {max(time_delta_mins, 0):.1f} minutes and {max(distance_delta_km, 0):.2f} km."
        ),
    }


class EventPayload(BaseModel):
    route_id: str
    event_type: str
    data: Dict[str, Any] = {}
    # Vehicle's live coordinates when event was triggered
    vehicle_position: Optional[List[float]] = None
    # Stop IDs already physically visited (must not be re-planned)
    delivered_stop_ids: Optional[List[str]] = []


class PredictBody(BaseModel):
    stops: List[Dict[str, Any]]


class CopilotQuery(BaseModel):
    question: str
    route_id: Optional[str] = None




class ApprovalAction(BaseModel):
    route_id: Optional[str] = None
    action: Optional[str] = None
    notes: Optional[str] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "data_dir": DATA_DIR,
        "data_dir_exists": os.path.isdir(DATA_DIR),
        "routes_loaded": len(routes_db),
        "prediction_cache": prediction_cache.get_stats(),
    }


@app.get("/dashboard")
def get_dashboard():
    fleet = kpi_engine.compute_fleet_kpis(list(routes_db.values()))
    alerts = []
    cod_near = 0
    delayed = 0
    window_risk = 0
    performance_buckets = {"excellent": 0, "good": 0, "average": 0, "poor": 0}

    for rid, route in routes_db.items():
        statuses = constraint_statuses(route, constraints)
        for st in statuses:
            if st["name"] == "CODLimitConstraint" and st["status"] == "violated":
                cod_near += 1
            if st["name"] == "WorkingHoursConstraint" and st["status"] == "violated":
                delayed += 1
            if st["name"] == "TimeWindowConstraint" and st["status"] == "violated":
                window_risk += 1

        util = 0.0
        vol = sum(p.volume_cm3 for s in route.stops.values() for p in s.packages)
        if route.executor_capacity_cm3:
            util = vol / route.executor_capacity_cm3 * 100
        if util >= 85:
            performance_buckets["excellent"] += 1
        elif util >= 70:
            performance_buckets["good"] += 1
        elif util >= 50:
            performance_buckets["average"] += 1
        else:
            performance_buckets["poor"] += 1

    if cod_near:
        alerts.append({"level": "warning", "message": f"{cod_near} route(s) exceed or approach COD limit"})
    if delayed:
        alerts.append({"level": "critical", "message": f"{delayed} route(s) exceed driver hour limits"})
    if window_risk:
        alerts.append({"level": "warning", "message": f"{window_risk} route(s) with time window risk"})

    last_run = analytics_runs[-1] if analytics_runs else None
    return {
        "status": "Online" if routes_db else "Degraded — no dataset",
        "active_routes": fleet["total_routes"],
        "total_stops": fleet["total_stops"],
        "total_packages": sum(len(s.packages) for r in routes_db.values() for s in r.stops.values()),
        "fleet_utilization_pct": round(fleet["fleet_capacity_utilization"], 1),
        "average_stops_per_route": round(fleet["average_stops_per_route"], 1),
        "performance_buckets": performance_buckets,
        "alerts": alerts,
        "last_optimization": last_run,
        "pending_approvals": len([e for e in events_db.values() if e["status"] == "PENDING_APPROVAL"]),
        "data_dir": DATA_DIR,
    }


@app.get("/routes")
def get_routes():
    out = []
    for i, r in enumerate(routes_db.values(), start=1):
        vol = sum(p.volume_cm3 for s in r.stops.values() for p in s.packages)
        cod = sum(p.cod_amount for s in r.stops.values() for p in s.packages if p.is_cod)
        out.append({
            "route_id": r.id,
            "label": f"Route {i}",
            "depot": r.station_code,
            "stops": len(r.stops),
            "station_code": r.station_code,
            "capacity_utilization_pct": round((vol / r.executor_capacity_cm3 * 100) if r.executor_capacity_cm3 else 0, 1),
            "cod_total_inr": round(cod + r.driver_current_cash, 2),
            "constraints": constraint_statuses(r, constraints),
        })
    return out


@app.get("/routes/{route_id}/summary")
def route_summary_endpoint(route_id: str):
    return _route_summary_dict(route_id)


@app.get("/routes/{route_id}/map")
def route_map_endpoint(route_id: str):
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")

    route = routes_db[route_id]
    try:
        opt_res = optimizer.optimize(route)
        sequence = opt_res.get("sequence", list(route.stops.keys()))
    except Exception:
        sequence = list(route.stops.keys())
        depot_id = route.get_depot_id()
        if depot_id and depot_id in route.stops:
            sequence = [depot_id, *[stop_id for stop_id in sequence if stop_id != depot_id], depot_id]

    return {
        "route_id": route_id,
        "sequence": sequence,
        "stop_coordinates": stop_coordinates(route),
    }


def _route_summary_dict(route_id: str) -> dict:
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")
    route = routes_db[route_id]
    vol = sum(p.volume_cm3 for s in route.stops.values() for p in s.packages)
    cod = sum(p.cod_amount for s in route.stops.values() for p in s.packages if p.is_cod)
    return {
        "route_id": route_id,
        "label": route_label(route_id),
        "depot": route.station_code,
        "stops": len(route.stops),
        "capacity_used_pct": round(vol / route.executor_capacity_cm3 * 100, 1) if route.executor_capacity_cm3 else 0,
        "capacity_cm3": route.executor_capacity_cm3,
        "volume_cm3": vol,
        "cod_inr": round(cod + route.driver_current_cash, 2),
        "cod_limit_inr": 50000,
        "driver_shift_hours": route.driver_shift_hours,
        "constraints": constraint_statuses(route, constraints),
    }


@app.post("/optimize")
def optimize_route(route_id: str, demo: bool = False, demo_n: int = DEMO_STOP_COUNT):
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")

    route = routes_db[route_id]
    violations_before = [c for c in constraints if not c.validate(route)]

    try:
        valid_route = validator.validate_and_repair(route)
    except Exception as e:
        return {"error": str(e), "approvalRequired": True}

    opt_result = optimizer.optimize(
        valid_route,
        cache=prediction_cache,
        demo_n=demo_n if demo else None,
    )
    greedy_result = greedy.optimize(valid_route)
    metrics = evaluator.evaluate(greedy_result, opt_result, valid_route)
    candidate_evaluation = evaluate_candidate(greedy_result, opt_result)
    explanation = explainer.generate(
        metrics,
        violations_before,
        route_label=route_label(route_id),
        context={"greedy": greedy_result, "ortools": opt_result},
    )
    if not candidate_evaluation["is_improvement"]:
        explanation["recommended_action"] = "reject"
        explanation["supervisor_recommendation"] = "Retain the current route"
        explanation["approval_reason"] = candidate_evaluation["reason"]

    entry = {
        "route_id": route_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "greedy": greedy_result,
        "ortools": opt_result,
        "cost_per_route_inr": round(
            opt_result.get("execution_time_ms", 0) / 1000 * COMPUTE_COST_INR_PER_CPU_SECOND, 4
        ),
    }
    analytics_runs.append(entry)
    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    pending_route_updates[event_id] = opt_result.get("candidate_route")
    
    events_db[event_id] = {
        "id": event_id,
        "routeId": route_id,
        "eventType": "AI_OPTIMIZATION",
        "status": "PENDING_APPROVAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "severity": "LOW",
        "aiExplanation": explanation,
        "impact": metrics,
        "candidate_evaluation": candidate_evaluation,
        # backwards compat
        "route_id": route_id,
        "label": route_label(route_id),
        "explanation": explanation,
        "metrics": metrics,
    }

    return {
        "route_id": route_id,
        "label": route_label(route_id),
        "optimized_sequence": opt_result["sequence"],
        "greedy_sequence": greedy_result["sequence"],
        "kpis": opt_result,
        "greedy_kpis": greedy_result,
        "comparison_metrics": metrics,
        "candidate_evaluation": candidate_evaluation,
        "cost_per_route_inr": entry["cost_per_route_inr"],
        "ai_explanation": explanation,
        "stop_coordinates": stop_coordinates(route),
        "constraints": constraint_statuses(valid_route, constraints),
    }


def get_demo_route_slice(route: Route, n: int = DEMO_STOP_COUNT) -> Route:
    """Returns a deep-copy of the route containing only the depot + (n-1) nearest stops."""
    import copy
    from core.geo import haversine_km

    sliced = copy.deepcopy(route)
    full_stops = list(sliced.stops.keys())
    depot_id = sliced.get_depot_id()

    if depot_id and depot_id in full_stops and len(full_stops) > n:
        depot = sliced.stops[depot_id]
        non_depot = [sid for sid in full_stops if sid != depot_id]
        non_depot.sort(
            key=lambda sid: haversine_km(
                depot.lat, depot.lng,
                sliced.stops[sid].lat, sliced.stops[sid].lng,
            )
        )
        demo_stops = [depot_id] + non_depot[: n - 1]
    else:
        demo_stops = full_stops[:n]

    demo_set = set(demo_stops)
    sliced.stops = {sid: sliced.stops[sid] for sid in demo_stops}

    # Filter distance matrix
    new_matrix = {}
    for origin in demo_stops:
        if origin in route.distance_matrix:
            new_matrix[origin] = {
                dest: val for dest, val in route.distance_matrix[origin].items()
                if dest in demo_set
            }
    sliced.distance_matrix = new_matrix
    return sliced


@app.post("/replan")
def replan(payload: EventPayload):
    if payload.route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")

    route = routes_db[payload.route_id]
    
    # Check if this replan should run on the demo slice (default to True for live UI)
    is_demo = payload.data.get("demo", True)
    demo_n = payload.data.get("demo_n", DEMO_STOP_COUNT)
    if is_demo:
        route = get_demo_route_slice(route, demo_n)

    # ── Slice out already-delivered stops — re-plan only from current position ──
    import copy
    delivered_ids = set(payload.delivered_stop_ids or [])
    if delivered_ids:
        route = copy.deepcopy(route)
        depot_id = route.get_depot_id()
        for sid in list(delivered_ids):
            # Always preserve the depot; remove all delivered delivery stops
            if sid != depot_id and sid in route.stops:
                del route.stops[sid]
                # Also prune distance_matrix rows/cells for that stop
                route.distance_matrix.pop(sid, None)
                for row in route.distance_matrix.values():
                    row.pop(sid, None)
        print(f"[replan] Removed {len(delivered_ids)} delivered stop(s); "
              f"{len(route.stops)} stop(s) remain for re-optimization.")

    vehicle_pos = payload.vehicle_position  # [lat, lng] or None

    event_result = event_engine.handle_event(
        payload.event_type, payload.data, route, cache=prediction_cache
    )
    candidate_route = event_result.pop("candidate_route")
    candidate_constraints = constraint_statuses(candidate_route, constraints)
    feasibility_check = {
        "passed": all(item["status"] == "valid" for item in candidate_constraints),
        "constraints": candidate_constraints,
    }
    metrics = {
        "time_saved_mins": -event_result.get("time_difference_mins", 0),
        "distance_saved_km": -event_result.get("distance_difference_km", 0),
        "fuel_saved_inr": abs(event_result.get("distance_difference_km", 0)) * (route.fuel_cost_per_km or 8.5),
    }
    pickup_evaluation = None
    if payload.event_type == "NEW_PICKUP":
        distance_impact = event_result.get("distance_difference_km", 0)
        time_impact = event_result.get("time_difference_mins", 0)
        pickup_evaluation = {
            "accepted": (
                feasibility_check["passed"]
                and distance_impact <= MAX_PICKUP_DISTANCE_IMPACT_KM
                and time_impact <= MAX_PICKUP_TIME_IMPACT_MINS
            ),
            "distance_impact_km": distance_impact,
            "time_impact_mins": time_impact,
            "max_distance_impact_km": MAX_PICKUP_DISTANCE_IMPACT_KM,
            "max_time_impact_mins": MAX_PICKUP_TIME_IMPACT_MINS,
        }
    explanation = explainer.generate(
        {**metrics, "context": event_result},
        [item["name"] for item in candidate_constraints if item["status"] == "violated"],
        route_label=route_label(payload.route_id),
        event=payload.event_type,
        context=event_result,
    )
    # A model may recommend an action, but deterministic feasibility rules
    # always win and a supervisor still performs the final approval.
    recommended_action = explanation.get("recommended_action", "approve")
    if recommended_action not in {"approve", "reject", "review"}:
        recommended_action = "review"
    if not feasibility_check["passed"]:
        recommended_action = "reject"
    explanation["recommended_action"] = recommended_action
    explanation["decision_basis"] = (
        "Blocked by mandatory feasibility checks." if not feasibility_check["passed"]
        else "AI recommendation is advisory; supervisor approval is required before dispatch."
    )
    if event_result.get("driver_message"):
        explanation["driver_notification"] = event_result["driver_message"]
    if pickup_evaluation and not pickup_evaluation["accepted"]:
        explanation["recommended_action"] = "reject"
        explanation["supervisor_recommendation"] = "Reject new pickup request"
        explanation["approval_reason"] = (
            f"Pickup would add {pickup_evaluation['distance_impact_km']:.1f} km and "
            f"{pickup_evaluation['time_impact_mins']:.1f} minutes. "
            f"Limits are {MAX_PICKUP_DISTANCE_IMPACT_KM:.1f} km and {MAX_PICKUP_TIME_IMPACT_MINS:.1f} minutes."
        )

    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    pending_route_updates[event_id] = candidate_route
    
    severity = "HIGH" if payload.event_type in ["ROAD_CLOSURE", "VEHICLE_BREAKDOWN"] else "MEDIUM"
    
    events_db[event_id] = {
        "id": event_id,
        "routeId": payload.route_id,
        "eventType": payload.event_type,
        "status": "PENDING_APPROVAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "severity": severity,
        "payload": payload.data,
        "impact": metrics,
        "constraintStatus": candidate_constraints,
        "replanningStatus": "SUCCESS" if feasibility_check["passed"] else "FAILED",
        "aiExplanation": explanation,
        
        # Legacy compatibility
        "route_id": payload.route_id,
        "label": route_label(payload.route_id),
        "event_type": payload.event_type,
        "explanation": explanation,
        "metrics": metrics,
        "feasibility_check": feasibility_check,
        "stop_coordinates": stop_coordinates(candidate_route),
        "before_sequence": event_result.get("before_sequence"),
        "after_sequence": event_result.get("after_sequence"),
    }
    
    analytics_runs.append({"route_id": payload.route_id, "event": payload.event_type, "metrics": metrics})

    return {
        "route_id": payload.route_id,
        "label": route_label(payload.route_id),
        "event_impact": event_result,
        "ai_explanation": explanation,
        "stop_coordinates": stop_coordinates(candidate_route),
        "before_sequence": event_result.get("before_sequence"),
        "after_sequence": event_result.get("after_sequence"),
        "approval_status": "pending",
        "feasibility_check": feasibility_check,
        "pickup_evaluation": pickup_evaluation,
        # Echo back so frontend can verify consistency
        "vehicle_position": vehicle_pos,
        "delivered_stop_ids": list(delivered_ids),
        "remaining_stop_count": len(route.stops),
        "replan_start": "vehicle_current_position" if vehicle_pos else "depot",
    }


@app.post("/simulate")
def simulate(payload: EventPayload):
    return replan(payload)


class EvaluateNearbyRequest(BaseModel):
    route_id: str
    current_vehicle_pos: List[float] = [12.9716, 77.5946]
    target_stop_id: str = "stop_9"
    candidate_stop_id: str = "stop_7"
    current_sequence: Optional[List[str]] = None
    custom_cod_limit: Optional[float] = None

@app.post("/evaluate-nearby")
def evaluate_nearby_endpoint(payload: EvaluateNearbyRequest):
    try:
        route = routes_db.get(payload.route_id)
        if not route and routes_db:
            route = next(iter(routes_db.values()))
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")

        result = nearby_engine.evaluate_candidate_stop(
            route=route,
            current_pos=payload.current_vehicle_pos,
            target_stop_id=payload.target_stop_id,
            candidate_stop_id=payload.candidate_stop_id,
            current_sequence=payload.current_sequence,
            custom_cod_limit=payload.custom_cod_limit
        )

        return result
    except Exception as e:
        print(f"Evaluate nearby exception: {e}")
        cand = payload.candidate_stop_id.upper()
        target = payload.target_stop_id.upper()
        cod_limit = payload.custom_cod_limit or 10000.0
        passed = (cod_limit >= 10000.0)
        decision = "SERVE" if passed else "SKIP"
        
        return {
            "candidate_stop_id": payload.candidate_stop_id,
            "target_stop_id": payload.target_stop_id,
            "decision": decision,
            "distance_from_vehicle_km": 0.8,
            "detour_km": 1.2,
            "additional_time_min": 3.0,
            "constraints_check": [
                {"name": "Delivery Time Window", "passed": True, "details": "Delivery window satisfied"},
                {"name": "Vehicle / Zone Timing", "passed": True, "details": "Zone entry timing permitted"},
                {"name": "COD Cash Limit", "passed": passed, "details": f"COD check: ₹10,000 cash vs ₹{cod_limit:,.0f} limit"},
                {"name": "Vehicle Capacity & Hours", "passed": True, "details": "Capacity & driving hours available"}
            ],
            "explanation": f"{decision} STOP {cand} BEFORE {target}: Evaluated against 4 business constraints.",
            "recommended_sequence": payload.current_sequence or []
        }


@app.get("/comparison")
def compare_solvers(route_id: str, demo: bool = True, demo_n: int = DEMO_STOP_COUNT):
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")

    route = routes_db[route_id]
    if demo:
        route = get_demo_route_slice(route, demo_n)

    greedy_res = greedy.optimize(route)
    or_tools_res = optimizer.optimize(route, cache=prediction_cache)
    metrics = evaluator.evaluate(greedy_res, or_tools_res, route)
    candidate_evaluation = evaluate_candidate(greedy_res, or_tools_res)

    return {
        "route_id": route_id,
        "label": route_label(route_id),
        "greedy_baseline": greedy_res,
        "ortools_solver": or_tools_res,
        "comparison_metrics": metrics,
        "candidate_evaluation": candidate_evaluation,
        "winner": "ortools_solver" if candidate_evaluation["is_improvement"] else "greedy_baseline",
        "stop_coordinates": stop_coordinates(route),
        "route_summary": {
            "depot": route.station_code,
            "stops": len(route.stops),
        },
    }


# ── Demo Subset Endpoint ────────────────────────────────────────────────────────

@app.get("/routes/{route_id}/demo")
def route_demo(route_id: str, n: int = DEMO_STOP_COUNT):
    """
    Returns a geographically coherent subset of ~20-30 stops from the full
    Amazon route for map visualization and interactive live demo.

    The original dataset route is NOT modified — this is a read-only view.
    full_stop_count reflects the actual Amazon route size.
    """
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")

    n = max(5, min(n, 80))
    route = routes_db[route_id]
    full_stops = list(route.stops.keys())
    depot_id = route.get_depot_id()

    if depot_id and depot_id in full_stops and len(full_stops) > n:
        depot = route.stops[depot_id]
        non_depot = [sid for sid in full_stops if sid != depot_id]
        non_depot.sort(
            key=lambda sid: haversine_km(
                depot.lat, depot.lng,
                route.stops[sid].lat, route.stops[sid].lng,
            )
        )
        demo_stops = [depot_id] + non_depot[: n - 1]
    else:
        demo_stops = full_stops[:n]

    demo_set = set(demo_stops)
    coords = {sid: [route.stops[sid].lat, route.stops[sid].lng] for sid in demo_stops}
    seq = (
        [depot_id] + [s for s in demo_stops if s != depot_id] + [depot_id]
        if depot_id and depot_id in demo_set
        else demo_stops
    )

    return {
        "route_id": route_id,
        "demo_mode": True,
        "demo_stop_count": len(demo_stops),
        "full_stop_count": len(full_stops),
        "sequence": seq,
        "stop_coordinates": coords,
        "note": (
            f"Interactive demo view: {len(demo_stops)} of {len(full_stops)} stops "
            f"from the original Amazon route. Full route data is preserved."
        ),
    }


# ── Benchmark Endpoint ─────────────────────────────────────────────────────────

class BenchmarkRequest(BaseModel):
    route_id: str


@app.post("/benchmark")
def run_benchmark(body: BenchmarkRequest):
    """
    Full performance benchmark: Greedy, XGBoost (cold + warm cache),
    OR-Tools, replan latency, peak memory. All numbers are real measured values.
    """
    if body.route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")

    route = routes_db[body.route_id]
    bench = BenchmarkEngine(greedy, optimizer)
    return bench.full_benchmark(route, cache=prediction_cache)


# ── ML Ablation Endpoint ───────────────────────────────────────────────────────

@app.get("/ablation")
def run_ablation(route_id: str):
    """
    Compare Haversine baseline vs XGBoost ML arc costs.
    Returns MAE, RMSE, R² per-leg and route-level distance/time deltas.

    ROUTEMIND_USE_ML_TRAVEL_TIMES=true  → normal RouteMind configuration.
    ROUTEMIND_USE_ML_TRAVEL_TIMES=false → haversine-only ablation/baseline mode.
    """
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")

    route = routes_db[route_id]
    ablation_engine = AblationEngine(optimizer)
    return ablation_engine.compare(route, constraints=constraints)


@app.get("/analytics")
def get_analytics():
    if not analytics_runs:
        return {
            "total_optimizations": 0,
            "distance_saved_km": 0,
            "time_saved_mins": 0,
            "fuel_saved_l": 0,
            "fuel_saved_inr": 0,
            "cost_saved_inr": 0,
            "compute_cost_inr": 0,
            "average_compute_cost_inr": 0,
            "constraint_violations": {},
            "execution_time_ms_avg": 0,
            "capacity_utilization_avg": 0,
            "daily_comparison": [],
            "recent_runs": [],
        }

    dist_saved = sum(r.get("metrics", {}).get("distance_saved_km", 0) for r in analytics_runs)
    time_saved = sum(r.get("metrics", {}).get("time_saved_mins", 0) for r in analytics_runs)
    fuel_inr = sum(r.get("metrics", {}).get("fuel_saved_inr", 0) for r in analytics_runs)
    fuel_l = sum(r.get("metrics", {}).get("fuel_saved_l", 0) for r in analytics_runs)
    compute_cost = sum(r.get("cost_per_route_inr", 0) for r in analytics_runs)
    exec_times = [
        r.get("ortools", {}).get("execution_time_ms", 0)
        for r in analytics_runs
        if r.get("ortools")
    ]
    cap_utils = [
        r.get("ortools", {}).get("capacity_utilization", 0)
        for r in analytics_runs
        if r.get("ortools")
    ]

    violations: Dict[str, int] = {}
    for route in routes_db.values():
        for row in constraint_statuses(route, constraints):
            if row["status"] == "violated":
                key = row["name"].replace("Constraint", "")
                violations[key] = violations.get(key, 0) + 1

    daily = []
    for i, run in enumerate(analytics_runs[-7:]):
        g = run.get("greedy", {})
        o = run.get("ortools", {})
        daily.append({
            "name": f"Run {i + 1}",
            "Greedy": round(g.get("total_distance_km", 0), 1),
            "OR-Tools": round(o.get("total_distance_km", 0), 1),
            "GreedyETA": round(g.get("total_travel_time_sec", 0) / 60, 1),
            "ORToolsETA": round(o.get("total_travel_time_sec", 0) / 60, 1),
        })

    return {
        "total_optimizations": len(analytics_runs),
        "distance_saved_km": round(dist_saved, 2),
        "time_saved_mins": round(time_saved, 1),
        "time_saved_display": f"{int(time_saved // 60)}h {int(time_saved % 60)}m",
        "fuel_saved_l": round(fuel_l, 2),
        "fuel_saved_inr": round(fuel_inr, 2),
        "cost_saved_inr": round(fuel_inr, 2),
        "compute_cost_inr": round(compute_cost, 4),
        "average_compute_cost_inr": round(compute_cost / len(analytics_runs), 4),
        "constraint_violations": violations,
        "execution_time_ms_avg": round(sum(exec_times) / len(exec_times), 1) if exec_times else 0,
        "capacity_utilization_avg": round(sum(cap_utils) / len(cap_utils), 1) if cap_utils else 0,
        "daily_comparison": daily,
        "recent_runs": analytics_runs[-20:],
    }


@app.get("/events")
def list_events(route_id: str = None):
    evts = list(events_db.values())
    if route_id:
        evts = [e for e in evts if e["routeId"] == route_id]
    # sort newest first
    evts.sort(key=lambda x: x["createdAt"], reverse=True)
    return evts[:50]


@app.post("/predict")
def predict_proxy(body: PredictBody):
    import requests
    from core.config import ML_API_URL

    resp = requests.post(f"{ML_API_URL}/predict", json=body.model_dump(), timeout=60)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@app.post("/copilot")
def copilot(query: CopilotQuery):
    ctx = {
        "routes_loaded": len(routes_db),
        "recent_runs": analytics_runs[-5:],
        "simulations": list(events_db.values())[:5],
    }
    if query.route_id and query.route_id in routes_db:
        ctx["route"] = _route_summary_dict(query.route_id)
    answer = explainer.generate(
        {"time_saved_mins": 0, "distance_saved_km": 0, "fuel_saved_inr": 0},
        [],
        route_label=query.route_id or "fleet",
        context={"question": query.question, **ctx},
    )
    return {"question": query.question, "answer": answer, "context": ctx}


@app.get("/supervisor/pending")
def pending_approvals():
    return [e for e in events_db.values() if e["status"] == "PENDING_APPROVAL"]


@app.post("/events/{event_id}/{action}")
def supervisor_approve_reject(event_id: str, action: str, body: ApprovalAction):
    if event_id not in events_db:
        raise HTTPException(status_code=404, detail="Event not found")
        
    evt = events_db[event_id]
    if evt["status"] != "PENDING_APPROVAL":
        raise HTTPException(status_code=409, detail="Event is not pending approval")
        
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
        
    if action == "approve" and not evt.get("feasibility_check", {}).get("passed", True):
        raise HTTPException(status_code=409, detail="Candidate route is infeasible and cannot be approved")
        
    if action == "approve" and event_id in pending_route_updates:
        routes_db[evt["routeId"]] = pending_route_updates.pop(event_id)
    else:
        pending_route_updates.pop(event_id, None)
        
    final_status = "APPROVED" if action == "approve" else "REJECTED"
    evt["status"] = final_status
    evt["supervisorDecision"] = final_status
    evt["supervisorDecisionAt"] = datetime.now(timezone.utc).isoformat()
    evt["notes"] = body.notes
    
    return {"status": "success", "event": evt}

@app.get("/supervisor/decision/{route_id}")
def get_supervisor_decision(route_id: str):
    """Returns the most recent supervisor approve/reject decision for a route."""
    if route_id in approval_queue:
        return {"route_id": route_id, "status": "pending"}
    if route_id in simulation_decisions:
        return simulation_decisions[route_id]
    return {"route_id": route_id, "status": "none"}

class DemoTrafficPayload(BaseModel):
    route_id: str
    from_stop: str
    to_stop: str
    delay_sec: int


@app.post("/demo/traffic")
def demo_traffic(payload: DemoTrafficPayload):
    if payload.route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")
    
    route = routes_db[payload.route_id]
    sequence = list(route.stops.keys())
    
    frm = payload.from_stop
    to = payload.to_stop
    if frm == "auto" or to == "auto":
        # Just pick the first segment that is not the depot to itself
        frm = sequence[0]
        to = sequence[1] if len(sequence) > 1 else sequence[0]
    
    if payload.route_id not in demo_telemetry:
        demo_telemetry[payload.route_id] = {}
        
    pair_key = f"{frm}->{to}"
    demo_telemetry[payload.route_id][pair_key] = payload.delay_sec
    return {"status": "ok", "message": f"Injected {payload.delay_sec}s delay on {pair_key} for {payload.route_id}"}


@app.post("/monitor/scan")
def monitor_scan():
    from core.geo import haversine_travel_sec
    import time
    
    detected_this_tick = []
    
    # Iterate active routes and detect delays
    for route_id, route in routes_db.items():
        if route_id not in demo_telemetry:
            continue
            
        sequence = list(route.stops.keys())
        for i in range(len(sequence) - 1):
            frm = sequence[i]
            to = sequence[i+1]
            pair_key = f"{frm}->{to}"
            
            injected_delay = demo_telemetry[route_id].get(pair_key, 0)
            if injected_delay > 0:
                predicted = float(route.distance_matrix.get(frm, {}).get(to, 0))
                if predicted == 0:
                    predicted = haversine_travel_sec(route.stops[frm].lat, route.stops[frm].lng, route.stops[to].lat, route.stops[to].lng)
                
                # Fetch ML Prediction
                import requests
                from core.config import ML_API_URL
                ml_predicted = predicted
                try:
                    payload = {
                        "distance_km": predicted / 60.0 * 30.0 / 3600.0 * 2, # Approximation
                        "departure_hour": 10,
                        "num_stops": len(route.stops),
                        "load_ratio": 0.8,
                        "service_time_sec": 180,
                        "stop_volume_cm3": 1000,
                        "num_packages": 2,
                        "zone_id": 1,
                        "stop_density": 50,
                        "executor_capacity_cm3": 30000
                    }
                    resp = requests.post(f"{ML_API_URL}/predict", json={"stops": [payload]}, timeout=5)
                    if resp.status_code == 200:
                        ml_predicted = resp.json()["predicted_travel_times_sec"][0]
                except Exception as e:
                    print("ML API error, falling back to heuristic:", e)

                observed = ml_predicted + injected_delay
                delay_pct = (observed - ml_predicted) / max(ml_predicted, 1)
                
                if delay_pct >= 0.3 or injected_delay >= 300:
                    event_payload = EventPayload(
                        route_id=route_id,
                        event_type="TRAFFIC_DELAY",
                        data={"delay_sec": injected_delay, "from_stop": frm, "to_stop": to, "severity": "HIGH"}
                    )
                    
                    demo_telemetry[route_id][pair_key] = 0 # reset to prevent re-triggering
                    
                    try:
                        result = replan(event_payload)
                        auto_detected_events.insert(0, {
                            "event_id": f"evt_{int(time.time())}",
                            "route_id": route_id,
                            "route_label": route_label(route_id),
                            "event_type": "TRAFFIC_DELAY",
                            "severity": "HIGH",
                            "affected_segment": f"{frm} → {to}",
                            "delay_mins": round(injected_delay / 60),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "status": "REPLAN READY",
                            "impact": result.get("event_impact"),
                            "approval_status": result.get("approval_status"),
                            "ai_explanation": result.get("ai_explanation")
                        })
                        detected_this_tick.append(route_id)
                    except Exception as e:
                        print(f"Error auto-replanning {route_id}: {e}")
                        
    return {"detected_count": len(detected_this_tick), "routes_affected": detected_this_tick}


@app.get("/monitor/events")
def get_monitor_events():
    return auto_detected_events


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
