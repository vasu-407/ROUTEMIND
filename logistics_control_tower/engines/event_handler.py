class EventEngine:
    def handle_event(self, event_type: str, payload: dict, route) -> dict:
        print(f"EventEngine received {event_type}...")
        
        old_stops = len(route.stops)
        old_dist = payload.get('current_distance', 0)
        
        if event_type == "TRAFFIC_DELAY":
            print(f"Applying incremental delay to ETA for route {route.id}")
            return {
                "changed_stops": 0,
                "distance_difference": 0.0,
                "time_difference": 45.0, # 45 min delay simulated
                "affected_deliveries": old_stops
            }
            
        elif event_type == "NEW_PICKUP":
            print(f"Attempting to insert new pickup locally...")
            return {
                "changed_stops": 1,
                "distance_difference": 2.5,
                "time_difference": 12.0,
                "affected_deliveries": 1
            }
            
        elif event_type == "FAILED_DELIVERY":
            print("Removing stop locally...")
            return {
                "changed_stops": -1,
                "distance_difference": -1.2,
                "time_difference": -5.0,
                "affected_deliveries": 1
            }
            
        else:
            return {"error": "Event requires full re-optimization."}
