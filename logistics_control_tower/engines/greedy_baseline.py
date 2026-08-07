from core.models import Route
import time

class GreedyBaseline:
    def optimize(self, route: Route) -> dict:
        """
        Runs a Nearest Neighbor Greedy Solver.
        Returns a dictionary containing the optimized sequence and KPIs.
        """
        start_ms = int(time.time() * 1000)
        
        stops_list = list(route.stops.keys())
        if len(stops_list) < 2:
            return self._build_empty_response(route)
            
        depot_id = route.get_depot_id()
        if not depot_id or depot_id not in stops_list:
            depot_id = stops_list[0]
            
        unvisited = set(stops_list)
        unvisited.remove(depot_id)
        
        sequence = [depot_id]
        current_node = depot_id
        
        total_time = 0
        total_service = 0
        
        while unvisited:
            best_next = None
            best_cost = float('inf')
            
            for candidate in unvisited:
                cost = float(route.distance_matrix.get(current_node, {}).get(candidate, 0.0))
                if cost == 0.0:
                    import math
                    lat1, lon1 = route.stops[current_node].lat, route.stops[current_node].lng
                    lat2, lon2 = route.stops[candidate].lat, route.stops[candidate].lng
                    R = 6371  # km
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                    cost = R * c * 120 # convert to approx seconds like optimization.py does

                if cost < best_cost:
                    best_cost = cost
                    best_next = candidate
                    
            if not best_next:
                # If disconnected graph, just pop an arbitrary node
                best_next = unvisited.pop()
                best_cost = 1000 # arbitrary penalty
            else:
                unvisited.remove(best_next)
                
            sequence.append(best_next)
            total_time += best_cost
            
            # Add service time
            stop_svc = sum(p.planned_service_time_seconds for p in route.stops[best_next].packages)
            total_service += stop_svc
            current_node = best_next
            
        # Return to depot
        return_cost = float(route.distance_matrix.get(current_node, {}).get(depot_id, 0.0))
        if return_cost == 0.0:
            import math
            lat1, lon1 = route.stops[current_node].lat, route.stops[current_node].lng
            lat2, lon2 = route.stops[depot_id].lat, route.stops[depot_id].lng
            R = 6371  # km
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            return_cost = R * c * 120

        total_time += return_cost
        sequence.append(depot_id)
        
        execution_time_ms = int(time.time() * 1000) - start_ms
        route_efficiency = 100.0 - (total_time / 86400 * 100)
        
        total_vol = sum(p.volume_cm3 for s in route.stops.values() for p in s.packages)
        capacity_utilization = (total_vol / route.executor_capacity_cm3) * 100 if route.executor_capacity_cm3 > 0 else 0
        
        return {
            "sequence": sequence,
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
