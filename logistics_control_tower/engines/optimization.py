from core.models import Route
import time

class RouteOptimizer:
    def __init__(self):
        try:
            from ortools.constraint_solver import routing_enums_pb2
            from ortools.constraint_solver import pywrapcp
            self.routing_enums = routing_enums_pb2
            self.pywrapcp = pywrapcp
            self.available = True
        except ImportError:
            self.available = False

    def optimize(self, route: Route) -> dict:
        """
        Runs OR-Tools VRP Solver.
        Returns a dictionary containing the optimized sequence and KPIs.
        """
        if not self.available:
            print("Warning: OR-Tools not installed. Returning original route.")
            return {
                "route_id": route.id,
                "sequence": list(route.stops.keys()),
                "total_distance_km": 0,
                "total_travel_time_sec": 0,
                "total_service_time_sec": 0,
                "route_efficiency_score": 0.0,
                "capacity_utilization": 0.0,
                "execution_time_ms": 0
            }
            
        start_ms = int(time.time() * 1000)
        
        stops_list = list(route.stops.keys())
        if len(stops_list) < 2:
            return self._build_empty_response(route)
            
        depot_index = 0
        depot_id = route.get_depot_id()
        if depot_id in stops_list:
            depot_index = stops_list.index(depot_id)
            
        # Data Model Assembly
        data = {}
        distance_matrix = [] # Assuming distance is correlated with travel time for this dataset
        travel_time_matrix = []
        demands = []
        service_times = []
        time_windows = []
        
        total_route_demand = 0
        
        for i, origin in enumerate(stops_list):
            row_time = []
            row_dist = []
            for j, dest in enumerate(stops_list):
                val = float(route.distance_matrix.get(origin, {}).get(dest, 0.0))
                if val == 0.0 and i != j:
                    import math
                    lat1, lon1 = route.stops[origin].lat, route.stops[origin].lng
                    lat2, lon2 = route.stops[dest].lat, route.stops[dest].lng
                    R = 6371  # km
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                    val = R * c
                
                # Fallback static proxy for travel time (e.g. 1 km = 2 mins = 120s)
                row_time.append(int(val * 120))
                row_dist.append(val)
            travel_time_matrix.append(row_time)
            distance_matrix.append(row_dist)
            
        # Try to use ML Predictions for Travel Time Matrix
        try:
            import requests
            ml_features = []
            for i, origin in enumerate(stops_list):
                stop = route.stops[origin]
                stop_vol = sum(p.volume_cm3 for p in stop.packages)
                stop_svc = sum(p.planned_service_time_seconds for p in stop.packages)
                num_pkgs = len(stop.packages)
                zone_id = hash(stop.zone_id) % 100 if stop.zone_id else 0
                
                for j, dest in enumerate(stops_list):
                    dist_km = distance_matrix[i][j]
                    ml_features.append({
                        "distance_km": dist_km,
                        "departure_hour": 8,
                        "num_stops": len(stops_list),
                        "load_ratio": 0.8,
                        "service_time_sec": stop_svc,
                        "stop_volume_cm3": stop_vol,
                        "num_packages": num_pkgs,
                        "zone_id": zone_id,
                        "stop_density": len(stops_list) / 100.0,
                        "executor_capacity_cm3": route.executor_capacity_cm3 or 1.0
                    })
            
            resp = requests.post("http://127.0.0.1:8001/predict", json={"stops": ml_features}, timeout=10)
            if resp.status_code == 200:
                predictions = resp.json().get("predictions", [])
                if len(predictions) == len(stops_list) * len(stops_list):
                    idx = 0
                    for i in range(len(stops_list)):
                        for j in range(len(stops_list)):
                            # Ensure time is at least 1s and integer
                            travel_time_matrix[i][j] = max(1, int(predictions[idx]))
                            idx += 1
                    print("Successfully used ML predictions for OR-Tools transit matrix.")
        except Exception as e:
            print(f"ML Prediction failed or timed out: {e}")
            
        for i, origin in enumerate(stops_list):
            # Stop Demand and Service Time
            stop_vol = 0
            stop_svc = 0
            earliest = 0
            latest = 86400
            
            for p in route.stops[origin].packages:
                stop_vol += p.volume_cm3
                stop_svc += p.planned_service_time_seconds
                if p.zone_restricted:
                    earliest = max(earliest, p.zone_allowed_from_sec)
                    latest = min(latest, p.zone_allowed_to_sec)
                    
            demands.append(int(stop_vol))
            service_times.append(int(stop_svc))
            total_route_demand += int(stop_vol)
            
            if i == depot_index:
                time_windows.append((0, 86400))
            else:
                time_windows.append((earliest, latest))
                
        data['time_matrix'] = travel_time_matrix
        data['demands'] = demands
        data['vehicle_capacities'] = [int(route.executor_capacity_cm3)]
        data['time_windows'] = time_windows
        data['num_vehicles'] = 1
        data['depot'] = depot_index
        
        # Create Routing Index Manager
        manager = self.pywrapcp.RoutingIndexManager(len(data['time_matrix']), data['num_vehicles'], data['depot'])
        routing = self.pywrapcp.RoutingModel(manager)
        
        # Transit Callback (Time)
        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return data['time_matrix'][from_node][to_node] + service_times[from_node]
            
        transit_callback_index = routing.RegisterTransitCallback(time_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Time Dimension
        routing.AddDimension(
            transit_callback_index,
            3600,  # allow waiting time (e.g., 1 hour)
            86400,  # maximum time per vehicle
            False,  # Don't force start cumul to zero
            'Time'
        )
        time_dimension = routing.GetDimensionOrDie('Time')
        
        # Add time window constraints
        for node_index in range(len(data['time_matrix'])):
            if node_index == data['depot']:
                continue
            index = manager.NodeToIndex(node_index)
            time_dimension.CumulVar(index).SetRange(data['time_windows'][node_index][0], data['time_windows'][node_index][1])
            
        # Capacity Dimension
        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return data['demands'][from_node]
            
        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,
            data['vehicle_capacities'],
            True,
            'Capacity'
        )
        
        # Search parameters
        search_parameters = self.pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = self.routing_enums.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_parameters.local_search_metaheuristic = self.routing_enums.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        search_parameters.time_limit.seconds = 5 # Production cap
            
        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        execution_time_ms = int(time.time() * 1000) - start_ms
        
        if solution:
            return self._extract_solution(manager, routing, solution, stops_list, data, service_times, total_route_demand, execution_time_ms)
        else:
            print("No OR-Tools solution found. Time windows or capacities might be too strict.")
            return self._build_empty_response(route)

    def _extract_solution(self, manager, routing, solution, stops_list, data, service_times, total_route_demand, execution_time_ms):
        index = routing.Start(0)
        optimized_order = []
        total_time = 0
        total_service = 0
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            optimized_order.append(stops_list[node_index])
            
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            
            if not routing.IsEnd(index):
                next_node = manager.IndexToNode(index)
                total_time += data['time_matrix'][node_index][next_node]
                total_service += service_times[node_index]
                
        # Add depot at end
        node_index = manager.IndexToNode(index)
        optimized_order.append(stops_list[node_index])
        
        capacity_utilization = (total_route_demand / data['vehicle_capacities'][0]) * 100 if data['vehicle_capacities'][0] > 0 else 0
        route_efficiency = 100.0 - (total_time / 86400 * 100) # Arbitrary score for demo
        
        return {
            "sequence": optimized_order,
            "total_distance_km": total_time / 100.0, # Simulated proxy
            "total_travel_time_sec": total_time,
            "total_service_time_sec": total_service,
            "route_efficiency_score": max(0, min(100, route_efficiency)),
            "capacity_utilization": capacity_utilization,
            "execution_time_ms": execution_time_ms
        }
        
    def _build_empty_response(self, route):
        return {
            "sequence": list(route.stops.keys()),
            "total_distance_km": 0,
            "total_travel_time_sec": 0,
            "total_service_time_sec": 0,
            "route_efficiency_score": 0.0,
            "capacity_utilization": 0.0,
            "execution_time_ms": 0
        }
