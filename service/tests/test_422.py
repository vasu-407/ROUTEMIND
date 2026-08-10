import requests

base_url = "http://localhost:3000/api"

routes = requests.get(f"{base_url}/routes").json()
route_id = routes[0]["route_id"]

payload = {
    "route_id": route_id,
    "event_type": "HEAVY_TRAFFIC",
    "data": {"demo": True}
}
simulate_res = requests.post(f"{base_url}/replan", json=payload)
event_data = simulate_res.json()
event_id = event_data["id"]

approve_res = requests.post(f"{base_url}/events/{event_id}/approve", json={"notes": "LGTM"})
print("Approve Status:", approve_res.status_code)
print(approve_res.json())
