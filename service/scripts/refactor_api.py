import os
import re

app_path = "d:/amazon-last-mile/service/api/app.py"
with open(app_path, "r") as f:
    content = f.read()

# 1. Globals
content = re.sub(
    r"simulation_log: List\[dict\] = \[\]\napproval_queue: Dict\[str, dict\] = \{\}\npending_route_updates: Dict\[str, Any\] = \{\}\nsimulation_decisions: Dict\[str, dict\] = \{\}.*",
    "events_db: Dict[str, dict] = {}\npending_route_updates: Dict[str, Any] = {}",
    content
)

# 2. /optimize
opt_replace = """    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
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
    }"""
content = re.sub(r"    approval_queue\[route_id\] = \{\n.*?\n    \}", opt_replace, content, flags=re.DOTALL)

# 3. /replan (formerly /simulate)
replan_replace = """    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
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
    
    analytics_runs.append({"route_id": payload.route_id, "event": payload.event_type, "metrics": metrics})"""

content = re.sub(
    r"    sim_id = str\(uuid\.uuid4\(\)\)\n    log_entry = \{\n.*?    \}\n    simulation_log\.insert\(0, log_entry\)\n    analytics_runs\.append\([^)]+\)\n    pending_route_updates\[payload\.route_id\] = candidate_route\n    approval_queue\[payload\.route_id\] = \{\n.*?\n    \}",
    replan_replace,
    content,
    flags=re.DOTALL
)

# 4. /simulations (now returns all events)
sims_replace = """@app.get("/events")
def list_events(route_id: str = None):
    evts = list(events_db.values())
    if route_id:
        evts = [e for e in evts if e["routeId"] == route_id]
    # sort newest first
    evts.sort(key=lambda x: x["createdAt"], reverse=True)
    return evts[:50]"""
content = re.sub(
    r"@app\.get\(\"/simulations\"\)\ndef list_simulations\(\):\n    return simulation_log\[:50\]",
    sims_replace,
    content,
    flags=re.DOTALL
)

# 5. /supervisor/pending
pending_replace = """@app.get("/supervisor/pending")
def pending_approvals():
    return [e for e in events_db.values() if e["status"] == "PENDING_APPROVAL"]"""
content = re.sub(
    r"@app\.get\(\"/supervisor/pending\"\)\ndef pending_approvals\(\):\n    return list\(approval_queue\.values\(\)\)",
    pending_replace,
    content,
    flags=re.DOTALL
)

# 6. /supervisor/approve
approve_replace = """@app.post("/events/{event_id}/{action}")
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
    
    return {"status": "success", "event": evt}"""

content = re.sub(
    r"@app\.post\(\"/supervisor/approve\"\)\ndef supervisor_approve\(body: ApprovalAction\):\n.*?(?=\n\n@|\Z)",
    approve_replace,
    content,
    flags=re.DOTALL
)

# 7. /supervisor/decision/{route_id}
# We keep this for backward compatibility for now if any component calls it, but change it to look up events_db
decision_replace = """@app.get("/supervisor/decision/{route_id}")
def check_decision(route_id: str):
    # Find most recent event for this route
    evts = [e for e in events_db.values() if e["routeId"] == route_id]
    if not evts:
        return {"status": "none"}
    evts.sort(key=lambda x: x["createdAt"], reverse=True)
    latest = evts[0]
    return {
        "status": latest["status"].lower(),
        "notes": latest.get("notes", ""),
        "timestamp": latest["supervisorDecisionAt"],
        "metrics": latest.get("metrics"),
        "explanation": latest.get("aiExplanation")
    }"""
content = re.sub(
    r"@app\.get\(\"/supervisor/decision/\{route_id\}\"\)\ndef check_decision\(route_id: str\):\n.*?(?=\n\n@|\Z)",
    decision_replace,
    content,
    flags=re.DOTALL
)

# 8. Minor cleanups
content = content.replace('"pending_approvals": len(approval_queue),', '"pending_approvals": len([e for e in events_db.values() if e["status"] == "PENDING_APPROVAL"]),')
content = content.replace('"simulations": simulation_log[:5],', '"simulations": list(events_db.values())[:5],')

with open(app_path, "w") as f:
    f.write(content)
print("Done modifying app.py")
