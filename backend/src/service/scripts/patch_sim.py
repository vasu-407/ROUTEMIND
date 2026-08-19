import os
import re

sim_path = "d:/amazon-last-mile/frontend/src/pages/Simulation.jsx"
with open(sim_path, "r") as f:
    content = f.read()

# 1. Fix the polling interval in triggerEvent
# It currently has:
poll_regex = r"      // Poll supervisor decision every 3s\n      approvalPollRef\.current = setInterval\(async \(\) => \{\n        try \{\n          const decRes = await getEvents\(routeId\);\n          const status = decRes\.data\?\.status;\n          if \(status === 'approved' \|\| status === 'rejected'\) \{\n            setApprovalStatus\(status\);\n            // Clear the pending result panel\n            setPendingResult\(null\);\n            // Refresh simulations list so event history updates\n            getEvents\(\)\.then\(r => setSimulations\(r\.data\)\)\.catch\(console\.error\);\n            clearInterval\(approvalPollRef\.current\);\n          \}\n        \} catch \(_\) \{\}\n      \}, 3000\);"

new_poll = """      // Poll supervisor decision every 3s
      approvalPollRef.current = setInterval(async () => {
        try {
          const decRes = await getEvents(routeId);
          setSimulations(decRes.data);
          if (decRes.data.length > 0) {
            const latest = decRes.data[0];
            const status = latest.status ? latest.status.toLowerCase() : latest.decision_status;
            if (status === 'approved' || status === 'rejected') {
              setApprovalStatus(status);
              clearInterval(approvalPollRef.current);
            }
          }
        } catch (_) {}
      }, 3000);"""
content = re.sub(poll_regex, new_poll, content)

# 2. Fix the Replanning Result panel mapping
# In Replanning Result panel, it uses `pendingResult.event_impact` and `pendingResult.after_sequence`.
# But new events have `impact` instead of `event_impact` (or we can just map it when creating `newResult`).
# Let's fix where we set `newResult`.
result_regex = r"      const newResult = \{ eventType, eventLabel, \.\.\.res\.data \};\n      const newMapSeq = res\.data\.event_impact\?\.after_sequence \|\| mapSequence;\n      const newBeforeSeq = res\.data\.event_impact\?\.before_sequence \|\| \[\];\n      const newCoords = res\.data\.stop_coordinates \|\| mapCoords;"

new_result = """      const newResult = { eventType, eventLabel, ...res.data };
      if (!newResult.event_impact && newResult.impact) {
          newResult.event_impact = newResult.impact;
          newResult.event_impact.distance_difference_km = newResult.impact.distance_saved_km !== undefined ? -newResult.impact.distance_saved_km : newResult.impact.distance_difference_km;
          newResult.event_impact.time_difference_mins = newResult.impact.time_saved_mins !== undefined ? -newResult.impact.time_saved_mins : newResult.impact.time_difference_mins;
      }
      const newMapSeq = res.data.after_sequence || res.data.proposedRoute || mapSequence;
      const newBeforeSeq = res.data.before_sequence || [];
      const newCoords = res.data.stop_coordinates || mapCoords;
"""
content = re.sub(result_regex, new_result, content)

# 3. Derive pendingResult correctly when loading page.
# If page loads, we don't have pendingResult.
# Wait, let's just add an effect that syncs pendingResult with the latest simulation if it's pending.
sync_effect = """
  // Sync pending result with backend events
  useEffect(() => {
    if (simulations.length > 0 && routeId) {
      const routeSims = simulations.filter(s => s.routeId === routeId || s.route_id === routeId);
      if (routeSims.length > 0) {
        const latest = routeSims[0];
        const status = latest.status ? latest.status.toLowerCase() : latest.decision_status;
        
        if (status === 'pending' || status === 'pending_approval') {
          if (!pendingResult || pendingResult.id !== latest.id) {
             const mappedLatest = { ...latest };
             if (!mappedLatest.event_impact && mappedLatest.impact) {
                 mappedLatest.event_impact = mappedLatest.impact;
                 mappedLatest.event_impact.distance_difference_km = mappedLatest.impact.distance_saved_km !== undefined ? -mappedLatest.impact.distance_saved_km : mappedLatest.impact.distance_difference_km;
                 mappedLatest.event_impact.time_difference_mins = mappedLatest.impact.time_saved_mins !== undefined ? -mappedLatest.impact.time_saved_mins : mappedLatest.impact.time_difference_mins;
             }
             mappedLatest.eventLabel = EVENTS.find(e => e.type === (latest.eventType || latest.event_type))?.label || latest.eventType;
             setPendingResult(mappedLatest);
             setApprovalStatus('pending');
          }
        } else if (status === 'approved' || status === 'rejected') {
          // If the latest event is approved/rejected, we show that status
          if (pendingResult && (pendingResult.id === latest.id || pendingResult.sim_id === latest.sim_id)) {
             setApprovalStatus(status);
          }
        }
      }
    }
  }, [simulations, routeId]);
"""

# Insert this effect right before `return (`
content = content.replace("  return (\n    <div className=\"min-h-screen", sync_effect + "\n  return (\n    <div className=\"min-h-screen")

with open(sim_path, "w") as f:
    f.write(content)
print("Simulation.jsx patched.")
