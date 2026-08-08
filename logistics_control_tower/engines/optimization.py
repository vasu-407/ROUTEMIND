from core.models import Route
from core.geo import haversine_km, haversine_travel_sec
from core.config import ML_API_URL, USE_ML_TRAVEL_TIMES
from engines.route_metrics import sequence_totals
import time
import os
import requests

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
                o_stop, d_stop = route.stops[origin], route.stops[dest]
                if val == 0.0 and i != j:
                    val_dist = haversine_km(o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng)
                    val_time = haversine_travel_sec(o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng)
                elif val > 0 and i != j:
                    val_dist = haversine_km(o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng)
                    val_time = val if val > 50 else haversine_travel_sec(o_stop.lat, o_stop.lng, d_stop.lat, d_stop.lng)
                else:
                    val_dist, val_time = 0.0, 0

                row_time.append(int(val_time))
                row_dist.append(val_dist)
            travel_time_matrix.append(row_time)
            distance_matrix.append(row_dist)
            
        # ML prediction will override the baseline travel times for the optimizer.
        if USE_ML_TRAVEL_TIMES:
            ml_features_flat = []
            pair_indices = []
            
            # Pre-calculate route load ratio
            route_total_vol = sum(sum(p.volume_cm3 for p in s.packages) for s in route.stops.values())
            executor_cap = route.executor_capacity_cm3 or 1000000
            route_load_ratio = min(1.0, route_total_vol / max(executor_cap, 1.0))
            
            for i, origin in enumerate(stops_list):
                for j, dest in enumerate(stops_list):
                    if i != j:
                        d_stop = route.stops[dest]
                        val_dist = distance_matrix[i][j]
                        stop_vol = sum(p.volume_cm3 for p in d_stop.packages)
                        svc_time = sum(p.planned_service_time_seconds for p in d_stop.packages)
                        
                        # stop_density was 1 / distance in features.csv
                        stop_density = 1.0 / max(val_dist, 0.001)
                        
                        ml_features_flat.append({
                            "distance_km": val_dist,
                            "departure_hour": 8,
                            "num_stops": len(stops_list),
                            "load_ratio": route_load_ratio,
                            "service_time_sec": svc_time,
                            "stop_volume_cm3": stop_vol,
                            "num_packages": len(d_stop.packages),
                            "zone_id": hash(d_stop.zone_id) % 1000 if d_stop.zone_id else 0,
                            "stop_density": stop_density,
                            "executor_capacity_cm3": executor_cap
                        })
                        pair_indices.append((i, j))
                        
            if ml_features_flat:
                try:
                    resp = requests.post(f"{ML_API_URL}/predict", json={"stops": ml_features_flat}, timeout=30)
                    if resp.status_code == 200:
                        predicted_times = resp.json().get("predicted_travel_times_sec", [])
                        if len(predicted_times) == len(pair_indices):
                            for idx, (i, j) in enumerate(pair_indices):
                                travel_time_matrix[i][j] = int(max(0, predicted_times[idx]))
                            print(f"Successfully integrated {len(predicted_times)} XGBoost travel-time predictions.")
                    else:
                        print(f"ML API returned {resp.status_code}: {resp.text}")
                except Exception as e:
                    print(f"Failed to fetch ML predictions: {e}")
            
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
            result = self._extract_solution(manager, routing, solution, stops_list, data, service_times, total_route_demand, execution_time_ms, distance_matrix)
            seq_metrics = sequence_totals(route, result["sequence"])
            result.update({
                "total_distance_km": seq_metrics["total_distance_km"],
                "total_travel_time_sec": seq_metrics["total_travel_time_sec"],
                "total_service_time_sec": seq_metrics["total_service_time_sec"],
                "fuel_estimate_l": seq_metrics["fuel_estimate_l"],
                "fuel_estimate_inr": seq_metrics["fuel_estimate_inr"],
            })
            return result
        else:
            print("No OR-Tools solution found. Time windows or capacities might be too strict.")
            return self._build_empty_response(route)

    def _extract_solution(self, manager, routing, solution, stops_list, data, service_times, total_route_demand, execution_time_ms, distance_matrix):
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
            "total_distance_km": 0,
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
