import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from engines.data_loader import DataLoader
from constraints.capacity import CapacityConstraint
from constraints.cod_limit import CODLimitConstraint
from engines.validation import ValidationEngine
from engines.optimization import RouteOptimizer
from engines.evaluation import EvaluationEngine
from engines.explainability import ExplainabilityEngine
from engines.event_handler import EventEngine
from engines.greedy_baseline import GreedyBaseline

app = FastAPI(title="Amazon Enterprise AI Logistics Control Tower")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize global engines
base_dir = "c:/amazon-last-mile/almrrc2021-data-training/model_build_inputs"
loader = DataLoader(base_dir)
try:
    routes_db = loader.load_routes()
except Exception as e:
    routes_db = {}

constraints = [CapacityConstraint(), CODLimitConstraint(max_cash_carry=50000.0)]
validator = ValidationEngine(constraints)
optimizer = RouteOptimizer()
greedy = GreedyBaseline()
evaluator = EvaluationEngine()
explainer = ExplainabilityEngine()
event_engine = EventEngine()

class EventPayload(BaseModel):
    route_id: str
    event_type: str
    data: Dict[str, Any]

@app.get("/dashboard")
def get_dashboard():
    return {
        "status": "Online",
        "active_routes": len(routes_db),
        "total_packages": sum(len(s.packages) for r in routes_db.values() for s in r.stops.values()),
        "fleet_utilization": "87%"
    }

@app.get("/routes")
def get_routes():
    return [{"route_id": r.id, "stops": len(r.stops), "station_code": r.station_code} for r in routes_db.values()]

@app.post("/optimize")
def optimize_route(route_id: str):
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")
        
    route = routes_db[route_id]
    
    # 1. Validate & Repair
    try:
        valid_route = validator.validate_and_repair(route)
    except Exception as e:
        return {"error": str(e), "approvalRequired": True}
        
    # 2. Optimize
    opt_result = optimizer.optimize(valid_route)
    greedy_result = greedy.optimize(valid_route)
    
    # 3. Explain
    time_saved = max(0, (greedy_result.get("total_travel_time_sec", 0) - opt_result.get("total_travel_time_sec", 0)) / 60.0)
    dist_saved = max(0, greedy_result.get("total_distance_km", 0) - opt_result.get("total_distance_km", 0))
    fuel_saved = dist_saved * valid_route.fuel_cost_per_km
    
    metrics = {
        "time_saved_mins": round(time_saved, 1),
        "distance_saved_km": round(dist_saved, 1),
        "fuel_saved_inr": round(fuel_saved, 1)
    }
    explanation = explainer.generate_explanation(metrics, [])
    
    return {
        "route_id": route_id,
        "optimized_sequence": opt_result["sequence"],
        "kpis": opt_result,
        "ai_explanation": explanation,
        "stop_coordinates": {s_id: [s.lat, s.lng] for s_id, s in route.stops.items()}
    }

@app.post("/replan")
def replan(payload: EventPayload):
    if payload.route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")
        
    route = routes_db[payload.route_id]
    event_result = event_engine.handle_event(payload.event_type, payload.data, route)
    
    explanation = explainer.generate_explanation(
        {"time_saved_mins": event_result.get("time_difference", 0)}, 
        [], 
        event=payload.event_type
    )
    
    return {
        "route_id": payload.route_id,
        "event_impact": event_result,
        "ai_explanation": explanation,
        "stop_coordinates": {s_id: [s.lat, s.lng] for s_id, s in route.stops.items()}
    }

@app.get("/comparison")
def compare_solvers(route_id: str):
    if route_id not in routes_db:
        raise HTTPException(status_code=404, detail="Route not found")
        
    route = routes_db[route_id]
    
    # Run both
    greedy_res = greedy.optimize(route)
    or_tools_res = optimizer.optimize(route)
    
    return {
        "route_id": route_id,
        "greedy_baseline": greedy_res,
        "ortools_solver": or_tools_res,
        "winner": "ortools_solver" if or_tools_res.get("total_travel_time_sec", float('inf')) < greedy_res.get("total_travel_time_sec", float('inf')) else "greedy_baseline",
        "stop_coordinates": {s_id: [s.lat, s.lng] for s_id, s in route.stops.items()}
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
