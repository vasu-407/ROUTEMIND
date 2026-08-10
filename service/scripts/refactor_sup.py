import os
import re

sup_path = "d:/amazon-last-mile/frontend/src/pages/Supervisor.jsx"
with open(sup_path, "r") as f:
    content = f.read()

# 1. Imports
content = content.replace("getPendingApprovals", "getEvents, approveEvent, rejectEvent")
content = content.replace("approveRoute", "")

# 2. Fetching pending
old_fetch = """      getPendingApprovals()
        .then(res => {
          setPending(res.data);
          // If the currently selected item is no longer pending, deselect it
          if (selectedItem && !res.data.find(i => i.route_id === selectedItem.route_id)) {
            setSelectedItem(null);
          }
        })"""

new_fetch = """      getEvents()
        .then(res => {
          const pendingEvents = res.data.filter(e => e.status === 'PENDING_APPROVAL');
          setPending(pendingEvents);
          // If the currently selected item is no longer pending, deselect it
          if (selectedItem && !pendingEvents.find(i => i.id === selectedItem.id)) {
            setSelectedItem(null);
          }
        })"""

content = content.replace(old_fetch, new_fetch)

# 3. Action handling
old_action = """  const handleAction = async (routeId, action) => {
    setLoading(true);
    try {
      await approveRoute({ route_id: routeId, action, notes: "" });
      // Remove from list immediately for snappy UI
      setPending(prev => prev.filter(item => item.route_id !== routeId));
      if (selectedItem?.route_id === routeId) {
        setSelectedItem(null);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to process approval.');
    }
    setLoading(false);
  };"""

new_action = """  const handleAction = async (eventId, action) => {
    setLoading(true);
    try {
      if (action === 'approve') {
        await approveEvent(eventId, { notes: "" });
      } else {
        await rejectEvent(eventId, { notes: "" });
      }
      // Remove from list immediately for snappy UI
      setPending(prev => prev.filter(item => item.id !== eventId));
      if (selectedItem?.id === eventId) {
        setSelectedItem(null);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to process approval.');
    }
    setLoading(false);
  };"""

content = content.replace(old_action, new_action)

# 4. Rendering properties (route_id -> routeId, event_type -> eventType)
# Note: old item had label, feasibility_check, explanation, metrics
# My refactor of the backend includes these for legacy compatibility!
# However, we must change key and selection logic: item.route_id -> item.id
content = content.replace("key={item.route_id}", "key={item.id}")
content = content.replace("selectedItem?.route_id === item.route_id", "selectedItem?.id === item.id")
content = content.replace("item.route_id.substring(0,8)", "item.routeId.substring(0,8)")
content = content.replace("selectedItem.route_id.substring(0,8)", "selectedItem.routeId.substring(0,8)")
content = content.replace("handleAction(selectedItem.route_id", "handleAction(selectedItem.id")
content = content.replace("item.event_type?.replace", "item.eventType?.replace")
content = content.replace("selectedItem.event_type?.replace", "selectedItem.eventType?.replace")

with open(sup_path, "w") as f:
    f.write(content)

print("Supervisor.jsx refactored!")
