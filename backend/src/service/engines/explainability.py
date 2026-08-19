class ExplainabilityEngine:
    def generate_explanation(self, evaluation_metrics: dict, violations: list, event=None) -> dict:
        time_saved = evaluation_metrics.get("time_saved_mins", 0)
        dist_saved = evaluation_metrics.get("distance_saved_km", 0)
        fuel_saved = evaluation_metrics.get("fuel_saved_inr", 0)
        
        context = evaluation_metrics.get("context", {})
        event_label = (event or "route update").replace("_", " ").title()
        changed_stops = context.get("changed_stops", 0)
        time_delta = context.get("time_difference_mins", 0)
        distance_delta = context.get("distance_difference_km", 0)
        violation_names = [
            item if isinstance(item, str) else item.__class__.__name__
            for item in violations
        ]

        if event:
            change_text = (
                f"{abs(changed_stops)} stop(s) were {'added' if changed_stops > 0 else 'removed' if changed_stops < 0 else 'resequenced'}; "
                f"the proposed plan changes travel by {distance_delta:+.1f} km and ETA by {time_delta:+.1f} minutes."
            )
            reason = f"{event_label} requires a route change. {change_text}"
        else:
            reason = "The solver produced a new route candidate."

        constraints_ok = not violation_names
        approval_reason = (
            "Supervisor approval is required because this candidate changes the driver's assigned stop sequence. "
            "Partners are never silently re-routed while on the road."
        )
        if not constraints_ok:
            approval_reason = (
                f"Approval is blocked because the candidate violates: {', '.join(violation_names)}. "
                "Resolve the exception before sending a route update to the driver."
            )
            
        return {
            "reason_changed": reason,
            "business_impact": "High" if time_saved > 30 else "Moderate",
            "distance_saved_km": dist_saved,
            "fuel_saved_inr": fuel_saved,
            "eta_improvement_mins": time_saved,
            "constraint_triggered": violation_names or ["All constraints passed"],
            "approval_reason": approval_reason,
            "constraint_summary": "All required feasibility checks passed." if constraints_ok else f"Blocked by: {', '.join(violation_names)}.",
            "recommended_action": "approve" if constraints_ok else "reject",
            "confidence_score": 0.95,
            "supervisor_recommendation": "Approve candidate route" if constraints_ok else "Do not approve until constraints are resolved",
            "driver_notification": f"Route update is pending supervisor approval: {event_label}."
        }
