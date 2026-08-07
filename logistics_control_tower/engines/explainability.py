class ExplainabilityEngine:
    def generate_explanation(self, evaluation_metrics: dict, violations: list, event=None) -> dict:
        time_saved = evaluation_metrics.get("time_saved_mins", 0)
        dist_saved = evaluation_metrics.get("distance_saved_km", 0)
        fuel_saved = evaluation_metrics.get("fuel_saved_inr", 0)
        
        reason = "Standard initial optimization."
        if event:
            reason = f"Re-optimization triggered by {event}."
            
        return {
            "reason_changed": reason,
            "business_impact": "High" if time_saved > 30 else "Moderate",
            "distance_saved_km": dist_saved,
            "fuel_saved_inr": fuel_saved,
            "eta_improvement_mins": time_saved,
            "constraint_triggered": [v.__class__.__name__ for v in violations] if violations else ["None"],
            "confidence_score": 0.95,
            "supervisor_recommendation": "Approve route modification" if time_saved > 0 else "Review required",
            "driver_notification": f"Route updated. You save {time_saved} minutes." if time_saved > 0 else ""
        }
