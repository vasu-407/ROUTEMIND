import os
import re

sim_path = "d:/amazon-last-mile/frontend/src/pages/Simulation.jsx"
with open(sim_path, "r") as f:
    content = f.read()

# 1. Imports
content = content.replace("getSimulations", "getEvents")
content = content.replace("getSupervisorDecision", "getEvents") # It's imported twice now, but that's fine, we'll fix it below
content = re.sub(r"getEvents,\s*startMonitor,\s*stopMonitor,\s*scanMonitor,\s*getMonitorStatus,\s*getMonitorEvents,\s*simulateTrafficDemo,\s*getRouteMap,\s*getEvents", "getEvents, startMonitor, stopMonitor, scanMonitor, getMonitorStatus, getMonitorEvents, simulateTrafficDemo, getRouteMap", content)

# 2. Initial load getEvents
content = content.replace("getEvents().then(res => setSimulations(res.data))", "getEvents(routeId).then(res => setSimulations(res.data))")

# 3. Inside triggerEvent
content = content.replace("getEvents().then(res => setSimulations(res.data))", "getEvents(routeId).then(res => setSimulations(res.data))")

# 4. Polling logic
old_poll = """      // Poll supervisor decision every 3s
      approvalPollRef.current = setInterval(async () => {
        try {
          const decRes = await getSupervisorDecision(routeId);
          const status = decRes.data?.status;
          if (status === 'approved' || status === 'rejected') {
            setApprovalStatus(status);
            // Clear the pending result panel
            setPendingResult(null);
            // Refresh simulations list so event history updates
            getEvents(routeId).then(r => setSimulations(r.data)).catch(console.error);
            clearInterval(approvalPollRef.current);
          }
        } catch (_) {}
      }, 3000);"""

new_poll = """      // Poll event status every 3s
      approvalPollRef.current = setInterval(async () => {
        try {
          const evRes = await getEvents(routeId);
          setSimulations(evRes.data);
          
          if (evRes.data.length > 0) {
            const latest = evRes.data[0];
            if (latest.eventType === eventType) { // Ensure it's the one we triggered
              const status = latest.status.toLowerCase();
              if (status === 'approved' || status === 'rejected') {
                setApprovalStatus(status);
                // We keep pendingResult around so the UI doesn't suddenly vanish immediately?
                // Actually the user requirements say: update Simulation history. The old code cleared it.
                // Let's clear it, since the map will update anyway if approved.
                setPendingResult(null);
                clearInterval(approvalPollRef.current);
              }
            }
          }
        } catch (_) {}
      }, 3000);"""

content = content.replace(old_poll, new_poll)

# 5. Event History table mapping
# Currently: simulations.map((sim, i) => ...)
# We need to render properties of the new Event object!
# The new event object has:
# id, routeId, eventType, status, createdAt, severity, payload, impact, etc.
# But for legacy compatibility, my refactor script also included:
# route_id, label, event_type, explanation, metrics, feasibility_check
# Let's check how the old table renders.
# It uses sim.sim_id, sim.timestamp, sim.event_type, sim.impact.time_difference_mins, sim.decision_status
# I'll update it to use the new fields.
old_table_body = """              <tbody>
                {simulations.length > 0 ? simulations.map((sim, i) => (
                  <tr key={sim.sim_id || i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 text-xs font-medium text-slate-700">
                      {new Date(sim.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span className="text-xs font-bold text-slate-800">{EVENTS.find(e => e.type === sim.event_type)?.label || sim.event_type}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {sim.impact?.time_difference_mins > 0 ? (
                        <span className="text-red-500 font-medium">+{sim.impact.time_difference_mins.toFixed(1)}m</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {sim.decision_status === 'pending' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">PENDING</span>}
                      {sim.decision_status === 'approved' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">APPROVED</span>}
                      {sim.decision_status === 'rejected' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">REJECTED</span>}
                    </td>
                  </tr>
                )) : ("""

new_table_body = """              <tbody>
                {simulations.length > 0 ? simulations.map((sim, i) => (
                  <tr key={sim.id || i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 text-xs font-medium text-slate-700">
                      {new Date(sim.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span className="text-xs font-bold text-slate-800">{EVENTS.find(e => e.type === sim.eventType)?.label || sim.eventType}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {sim.impact?.time_saved_mins < 0 ? (
                        <span className="text-red-500 font-medium">+{Math.abs(sim.impact.time_saved_mins).toFixed(1)}m</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {sim.status === 'PENDING_APPROVAL' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">PENDING</span>}
                      {sim.status === 'APPROVED' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">APPROVED</span>}
                      {sim.status === 'REJECTED' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">REJECTED</span>}
                    </td>
                  </tr>
                )) : ("""
content = content.replace(old_table_body, new_table_body)

with open(sim_path, "w") as f:
    f.write(content)
print("Simulation.jsx refactored!")
