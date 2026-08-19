import sys
import traceback
from engines.data_loader import DataLoader
from engines.optimization import RouteOptimizer

print("Loading routes...")
try:
    routes = DataLoader().load_routes()
    optimizer = RouteOptimizer()
    
    for i, route_id in enumerate(list(routes.keys())[:7]):
        route = routes[route_id]
        print(f"[{i+1}/7] Solving route {route.id} with {len(route.stops)} stops...")
        result = optimizer.solve(route)
        print(f"Solved successfully! Total distance: {result.get('total_distance_km')}")
except Exception as e:
    print(f"Exception: {e}")
    traceback.print_exc()
