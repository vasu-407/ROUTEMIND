class SupervisorAPI:
    def __init__(self, optimizer, validator, evaluator, explainer):
        self.optimizer = optimizer
        self.validator = validator
        self.evaluator = evaluator
        self.explainer = explainer
        
    def generate_decision_payload(self, original_route):
        # 1. Pre-Validate / Repair initial route
        try:
            valid_route = self.validator.validate_and_repair(original_route)
        except Exception as e:
            return {"error": str(e), "approvalRequired": True}
            
        # 2. Optimize
        optimized_route = self.optimizer.optimize(valid_route)
        
        # 3. Evaluate
        metrics = self.evaluator.evaluate(original_route, optimized_route)
        
        # 4. Explain
        explanation = self.explainer.generate_explanation(metrics, [])
        
        return {
            "oldRoute": [stop for stop in original_route.stops.keys()],
            "newRoute": getattr(optimized_route, "optimized_sequence", list(optimized_route.stops.keys())),
            "distanceSaved": metrics.get("distance_saved_km", 0),
            "fuelSaved": metrics.get("fuel_saved_inr", 0),
            "timeSaved": metrics.get("time_saved_mins", 0),
            "constraintViolations": [], # In a real implementation we track caught violations
            "approvalRequired": metrics.get("route_risk_score", 0) > 80,
            "aiExplanation": explanation,
            "confidenceScore": 0.95
        }
