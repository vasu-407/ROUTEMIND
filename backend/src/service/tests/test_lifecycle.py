import requests
import json

base_url = "http://localhost:3000/api"

print("1. Getting routes...")
routes = requests.get(f"{base_url}/routes").json()
route_id = routes[0]["route_id"]
print(f"Using route: {route_id}")

print("2. Simulating event...")
payload = {
    "route_id": route_id,
    "event_type": "HEAVY_TRAFFIC",
    "data": {"demo": True}
}
simulate_res = requests.post(f"{base_url}/replan", json=payload)
print(simulate_res.status_code)
event_data = simulate_res.json()
print("Simulate response keys:", event_data.keys())

print("3. Fetching events...")
events_res = requests.get(f"{base_url}/events").json()
print(f"Found {len(events_res)} events.")
for e in events_res:
    print(f" - {e['id']} | {e['eventType']} | {e['status']}")

print("4. Fetching pending approvals...")
pending_res = requests.get(f"{base_url}/supervisor/pending").json()
print(f"Found {len(pending_res)} pending events.")

print("5. Approving event...")
event_id = events_res[0]["id"]
approve_res = requests.post(f"{base_url}/events/{event_id}/approve", json={"action": "approve", "notes": "LGTM", "route_id": route_id})
print(approve_res.status_code)
print(approve_res.json())

print("6. Fetching events again...")
events_res2 = requests.get(f"{base_url}/events").json()
print(f"Status of {event_id}: {events_res2[0]['status']}")
