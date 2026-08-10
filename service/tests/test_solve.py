import sys
import traceback

with open("solve_debug.txt", "w") as f:
    f.write("Starting test_solve.py\n")
    f.flush()
    try:
        f.write("importing DataLoader\n")
        f.flush()
        from engines.data_loader import DataLoader
        f.write("importing RouteOptimizer\n")
        f.flush()
        from engines.optimization import RouteOptimizer

        f.write("Loading routes...\n")
        f.flush()
        routes = DataLoader().load_routes()
        route = next(iter(routes.values()))
        route.route_mode = "open"
        f.write(f"Loaded route {route.id} with {len(route.stops)} stops.\n")
        f.flush()
        
        optimizer = RouteOptimizer()
        f.write("Solving...\n")
        f.flush()
        result = optimizer.solve(route)
        f.write("Solved successfully!\n")
        f.flush()
    except Exception as e:
        f.write(f"Exception: {e}\n")
        traceback.print_exc(file=f)
        f.flush()
