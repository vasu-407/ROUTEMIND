import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Truck, MapPin, Clock, AlertTriangle, Radio, Navigation, Bot, ArrowRight, Play, Square, RefreshCw, Zap, CheckCircle2, Box, Banknote, Activity } from 'lucide-react';
import { getRoutes, replanEvent, getSimulations, startMonitor, stopMonitor, scanMonitor, getMonitorStatus, getMonitorEvents, simulateTrafficDemo, getRouteMap } from '../api';
import MapViewer from '../components/MapViewer';

const EVENTS = [
  { type: 'NEW_PICKUP', label: 'New Pickup Request', desc: 'Add a new pickup to route', icon: <MapPin size={24} className="text-blue-500" />, color: 'border-blue-50 hover:border-blue-200' },
  { type: 'FAILED_DELIVERY', label: 'Failed Delivery', desc: 'Mark a delivery as failed', icon: <AlertTriangle size={24} className="text-red-500" />, color: 'border-red-50 hover:border-red-200' },
  { type: 'TRAFFIC_DELAY', label: 'Heavy Traffic Delay', desc: 'Add traffic delay to route', icon: <Clock size={24} className="text-orange-500" />, color: 'border-orange-50 hover:border-orange-200' },
  { type: 'VEHICLE_BREAKDOWN', label: 'Vehicle Breakdown', desc: 'Simulate vehicle breakdown', icon: <Truck size={24} className="text-indigo-500" />, color: 'border-indigo-50 hover:border-indigo-200' },
  { type: 'ROAD_CLOSURE', label: 'Road Closure', desc: 'Close a road segment', icon: <Navigation size={24} className="text-purple-500" />, color: 'border-purple-50 hover:border-purple-200' },
  { type: 'HUB_CONGESTION', label: 'Hub Congestion', desc: 'Simulate hub congestion', icon: <Radio size={24} className="text-pink-500" />, color: 'border-pink-50 hover:border-pink-200' },
];

const Simulation = () => {
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('routeId');
  
  const [routes, setRoutes] = useState([]);
  const [activeRouteData, setActiveRouteData] = useState(null);
  const [mapSequence, setMapSequence] = useState([]);
  const [mapCoords, setMapCoords] = useState({});
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [simulations, setSimulations] = useState([]);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [autoEvents, setAutoEvents] = useState([]);

  useEffect(() => {
    getRoutes().then(res => {
      setRoutes(res.data);
      if (routeId) {
        const routeData = res.data.find(r => r.route_id === routeId);
        setActiveRouteData(routeData || null);
      }
    }).catch(console.error);

    if (routeId) {
      getRouteMap(routeId).then(res => {
        setMapSequence(res.data.sequence || []);
        setMapCoords(res.data.stop_coordinates || {});
      }).catch(console.error);
    }
    
    getSimulations().then(res => {
      setSimulations(res.data);
    }).catch(console.error);

    const fetchMonitor = async () => {
      try {
        const statRes = await getMonitorStatus();
        setIsMonitoring(statRes.data.isMonitoring);
        const evRes = await getMonitorEvents();
        // Deduplicate and filter by current routeId
        if (routeId) {
          const routeEvents = evRes.data.filter(e => e.route_id === routeId);
          // Deduplicate by event_type and affected_segment
          const deduped = [];
          const seen = new Set();
          for (const ev of routeEvents) {
            const key = ev.event_type + '_' + ev.affected_segment;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(ev);
            }
          }
          setAutoEvents(deduped);
        } else {
          setAutoEvents([]);
        }
      } catch (err) {}
    };
    
    fetchMonitor();
    const interval = setInterval(fetchMonitor, 5000);

    const autoStart = searchParams.get('autoStart');
    if (autoStart === 'true') {
      startMonitor().then(() => setIsMonitoring(true)).catch(console.error);
    }

    return () => clearInterval(interval);
  }, [routeId, searchParams]);

  const triggerEvent = async (eventType) => {
    if (!routeId) return;
    setLoading(true);
    setActiveEvent(eventType);
    try {
      const payload = { route_id: routeId, event_type: eventType, data: {} };
      const res = await replanEvent(payload);
      setResult({ 
        eventType, 
        eventLabel: EVENTS.find(e => e.type === eventType)?.label,
        ...res.data 
      });
      getSimulations().then(res => setSimulations(res.data)).catch(console.error);
    } catch (e) {
      setResult({ error: 'Event simulation failed. Is the backend running?' });
    }
    setLoading(false);
    setActiveEvent(null);
  };

  const handleToggleMonitor = async () => {
    try {
      if (isMonitoring) {
        await stopMonitor();
        setIsMonitoring(false);
      } else {
        await startMonitor();
        setIsMonitoring(true);
      }
    } catch(e) { console.error("Monitor toggle failed", e); }
  };

  const handleScanNow = async () => {
    try {
      await scanMonitor();
      const evRes = await getMonitorEvents();
      if (routeId) {
          const routeEvents = evRes.data.filter(e => e.route_id === routeId);
          const deduped = [];
          const seen = new Set();
          for (const ev of routeEvents) {
            const key = ev.event_type + '_' + ev.affected_segment;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(ev);
            }
          }
          setAutoEvents(deduped);
      }
      getSimulations().then(res => setSimulations(res.data)).catch(console.error);
    } catch (e) { console.error("Scan failed", e); }
  };

  const handleSimulateTraffic = async () => {
    if (!routeId) return;
    try {
      await simulateTrafficDemo({ route_id: routeId, from_stop: 'auto', to_stop: 'auto', delay_sec: 2100 });
      alert(`Demo traffic delay injected on Route ${routeId.substring(0, 8)}... Wait for the monitor to detect it!`);
    } catch(e) { console.error("Traffic injection failed", e); }
  };

  if (!routeId) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center font-sans">
        <h2 className="text-xl font-bold text-slate-800 mb-4">No Route Selected</h2>
        <p className="text-slate-500 mb-6">Please go to the Route Planner and select a route to analyze.</p>
        <Link to="/route-planner" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold shadow-md transition-colors">
          Go to Route Planner
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Route Analysis & Simulation</h1>
          <p className="text-slate-500 text-sm mt-1">Simulate and monitor real-time perturbations for Route {routeId.substring(0, 8)}...</p>
        </div>
        <div className="flex gap-3">
          <Link to="/route-planner" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-bold shadow-sm transition-colors">
            Back to Planner
          </Link>
          <button 
            onClick={() => {
              if (mapSequence && mapCoords) {
                localStorage.setItem('offline_driver_route', JSON.stringify({
                  route_id: routeId,
                  sequence: mapSequence,
                  stop_coordinates: mapCoords
                }));
                // Navigate in new tab or same window? Same window.
                window.location.href = '/driver-mode';
              }
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center"
          >
            <Navigation size={16} className="mr-2" /> Start Journey
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* ROUTE ANALYSIS PANEL */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-slate-800 p-4">
            <h2 className="text-white font-bold flex items-center"><Box size={18} className="mr-2" /> Route Analysis</h2>
          </div>
          <div className="p-5 flex-1 grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Route</p>
              <p className="text-sm font-semibold text-slate-800">{activeRouteData?.label || routeId.substring(0, 8)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Depot</p>
              <p className="text-sm font-semibold text-slate-800">{activeRouteData?.depot || 'DLA3'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Stops</p>
              <p className="text-sm font-semibold text-slate-800">{activeRouteData?.stops || 119}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Vehicle</p>
              <p className="text-sm font-semibold text-slate-800">VAN-{routeId.substring(8, 16).toUpperCase()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Distance</p>
              <p className="text-sm font-semibold text-slate-800">142.6 km</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">ETA</p>
              <p className="text-sm font-semibold text-slate-800">05h 43m</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Capacity</p>
              <p className="text-sm font-semibold text-slate-800">{activeRouteData?.capacity_utilization_pct || 82}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm font-bold text-green-600 flex items-center">
                {isMonitoring ? <span className="animate-pulse flex items-center"><Activity size={14} className="mr-1" /> MONITORING</span> : <span className="text-slate-400">PAUSED</span>}
              </p>
            </div>
          </div>
        </div>

        {/* MAP PANEL */}
        <div className="col-span-8 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative shadow-inner h-[600px] flex items-center justify-center">
          {activeRouteData && mapSequence.length > 0 ? (
             <MapViewer 
                routeSequence={mapSequence} 
                stopCoordinates={mapCoords} 
                focusedSegment={autoEvents.length > 0 ? autoEvents[0].affected_segment.split('->').map(s => s.trim()) : null}
             />
          ) : (
             <div className="flex items-center justify-center h-full text-slate-400 bg-slate-900 rounded-xl">Loading Map Data...</div>
          )}
        </div>
      </div>

      {/* AI ROUTE MONITOR SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Bot size={20} className="text-indigo-600" /> Event Engine Monitoring
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Automatically scans active routes to detect anomalies via XGBoost telemetry.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleToggleMonitor} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${isMonitoring ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
            {isMonitoring ? <><Square size={16}/> Pause</> : <><Play size={16}/> Start Automatic Monitoring</>}
          </button>
          
          <button onClick={handleScanNow} className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2 transition-colors">
            <RefreshCw size={16} /> Scan
          </button>

          <div className="w-px h-8 bg-slate-200 mx-1"></div>
          
          <button onClick={handleSimulateTraffic} className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center gap-2 transition-colors" title="Inject an artificial delay">
            <Zap size={16} /> Force Demo Traffic Event
          </button>
        </div>
      </div>

      {/* AI DETECTED EVENTS */}
      {autoEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Detected Events on this Route</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {autoEvents.map((evt, idx) => (
              <div key={idx} className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-red-400"></div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-red-800 font-bold text-base flex items-center gap-2">
                    <AlertTriangle size={18} /> {EVENTS.find(e => e.type === evt.event_type)?.label || 'Anomaly Detected'}
                  </h3>
                  <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase">{evt.severity} Severity</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                  <div className="text-red-900/70">Segment:</div>
                  <div className="text-red-900 font-medium">{evt.affected_segment}</div>
                  <div className="text-red-900/70">Delay Impact:</div>
                  <div className="text-red-900 font-medium">+{evt.delay_mins} minutes</div>
                  <div className="text-red-900/70">Status:</div>
                  <div className="text-red-900 font-bold bg-white/50 px-2 rounded w-fit">{evt.status}</div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Link to="/supervisor" className="text-xs bg-white text-red-600 font-bold px-3 py-1.5 rounded border border-red-200 hover:bg-red-50 transition-colors shadow-sm text-center block w-full">
                    View Impact & Recommendation in Supervisor Console
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EVENT GRID */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manual Event Simulation</h2>
        <div className="flex-1 border-t border-slate-200"></div>
      </div>
      <div className="grid grid-cols-6 gap-4 mb-8">
        {EVENTS.map(e => (
          <button key={e.type} onClick={() => triggerEvent(e.type)} disabled={loading} className={`flex flex-col items-center justify-center p-5 bg-white border rounded-xl shadow-sm transition-all disabled:opacity-50 group cursor-pointer ${e.color}`}>
            <div className="mb-3 transform group-hover:scale-110 transition-transform">{e.icon}</div>
            <span className="text-sm font-bold text-slate-800 text-center mb-1 leading-tight">{e.label}</span>
            <span className="text-[10px] text-slate-500 text-center px-1">{e.desc}</span>
            {loading && activeEvent === e.type && <span className="text-xs text-indigo-500 mt-2 animate-pulse font-medium">Replanning...</span>}
          </button>
        ))}
      </div>

      {/* BOTTOM */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 text-base mb-4">Event History for Selected Route</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50/50">
                <tr>
                  <th className="px-4 py-3 font-semibold rounded-tl-lg">Event Type</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Impact</th>
                </tr>
              </thead>
              <tbody>
                {simulations.filter(s => s.route_id === routeId).length > 0 ? simulations.filter(s => s.route_id === routeId).map((sim, idx) => {
                  const impact = sim.impact || {};
                  return (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-medium text-slate-800">{EVENTS.find(e => e.type === sim.event_type)?.label || sim.event_type}</td>
                      <td className="px-4 py-4 text-xs">{new Date(sim.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-700">{impact.time_difference_mins > 0 ? '+' : ''}{impact.time_difference_mins} min, {impact.distance_difference_km > 0 ? '+' : ''}{impact.distance_difference_km} km</td>
                    </tr>
                  );
                }) : <tr><td colSpan="3" className="text-center py-4 text-sm text-slate-500">No events simulated for this route yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col">
          <h3 className="font-bold text-slate-800 text-base mb-4 border-b border-slate-100 pb-3">Replanning Result</h3>
          <div className="flex-1">
            {result ? (
              <>
                <p className="text-sm text-slate-500 mb-2">Event: <strong className="text-slate-800">{result.eventLabel || result.event_type}</strong></p>
                <p className="text-sm text-slate-500 mb-6">Replanned in: <strong className="text-slate-800">{result.event_impact?.replan_execution_sec || 0} seconds</strong></p>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Impact Summary</h4>
                <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4 marker:text-slate-300">
                  <li>Distance {result.event_impact?.distance_difference_km >= 0 ? 'increased' : 'decreased'} by {Math.abs(result.event_impact?.distance_difference_km || 0)} km</li>
                  <li>ETA {result.event_impact?.time_difference_mins >= 0 ? 'increased' : 'decreased'} by {Math.abs(result.event_impact?.time_difference_mins || 0)} minutes</li>
                </ul>
              </>
            ) : <p className="text-sm text-slate-500 text-center mt-10">Trigger an event to see the replanning impact.</p>}
          </div>
          {result && <Link to="/supervisor" className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded shadow-sm transition-colors flex justify-center items-center"><CheckCircle2 size={14} className="mr-2" /> Review in Supervisor Console <ArrowRight size={14} className="ml-2" /></Link>}
        </div>
      </div>
    </div>
  );
};

export default Simulation;
