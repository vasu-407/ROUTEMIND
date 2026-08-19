import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.data_loader import DataLoader
from constraints.capacity import CapacityConstraint
from constraints.cod_limit import CODLimitConstraint
from engines.validation import ValidationEngine
from engines.optimization import RouteOptimizer
from engines.evaluation import EvaluationEngine
from engines.explainability import ExplainabilityEngine
from api.supervisor_api import SupervisorAPI

def main():
    print("--- Amazon Enterprise AI Logistics Control Tower ---")
    
    # 1. Data Loader
    base_dir = "c:/amazon-last-mile/almrrc2021-data-training/model_build_inputs"
    loader = DataLoader(base_dir)
    # Load just 1 route for demo
    routes = loader.load_routes()
    
    if not routes:
        print("No routes loaded.")
        return
        
    route_id, test_route = list(routes.items())[0]
    print(f"\Loaded Route: {route_id} with {len(test_route.stops)} stops.")
    
    # 2. Constraint Engine Initialization
    constraints = [
        CapacityConstraint(),
        CODLimitConstraint(max_cash_carry=50000.0)
    ]
    
    # 3. Component Assembly
    validator = ValidationEngine(constraints)
    optimizer = RouteOptimizer()
    evaluator = EvaluationEngine()
    explainer = ExplainabilityEngine()
    
    api = SupervisorAPI(optimizer, validator, evaluator, explainer)
    
    # 4. Generate Decision
    print("\nExecuting Control Tower Pipeline...")
    decision = api.generate_decision_payload(test_route)
    
    print("\n--- Supervisor Dashboard Payload ---")
    import json
    print(json.dumps(decision, indent=2))

if __name__ == "__main__":
    main()
