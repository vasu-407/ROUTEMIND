import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, MapPin, Clock, AlertTriangle, Radio, Navigation, CheckCircle2, FileSearch } from 'lucide-react';
import { getRoutes, replanEvent } from '../api';

const EVENTS = [
  { type: 'NEW_PICKUP', label: 'New Pickup Request', desc: 'Add a new pickup to route', icon: <MapPin size={24} className="text-blue-500" />, color: 'border-blue-50 hover:border-blue-200' },
  { type: 'FAILED_DELIVERY', label: 'Failed Delivery', desc: 'Mark a delivery as failed', icon: <AlertTriangle size={24} className="text-red-500" />, color: 'border-red-50 hover:border-red-200' },
  { type: 'TRAFFIC_DELAY', label: 'Heavy Traffic Delay', desc: 'Add traffic delay to route', icon: <Clock size={24} className="text-orange-500" />, color: 'border-orange-50 hover:border-orange-200' },
  { type: 'VEHICLE_BREAKDOWN', label: 'Vehicle Breakdown', desc: 'Simulate vehicle breakdown', icon: <Truck size={24} className="text-indigo-500" />, color: 'border-indigo-50 hover:border-indigo-200' },
  { type: 'ROAD_CLOSURE', label: 'Road Closure', desc: 'Close a road segment', icon: <Navigation size={24} className="text-purple-500" />, color: 'border-purple-50 hover:border-purple-200' },
  { type: 'HUB_CONGESTION', label: 'Hub Congestion', desc: 'Simulate hub congestion', icon: <Radio size={24} className="text-pink-500" />, color: 'border-pink-50 hover:border-pink-200' },
];

const Simulation = () => {
  const [routeId, setRouteId] = useState('');
  const [routes, setRoutes] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    getRoutes().then(res => {
      setRoutes(res.data);
      if (res.data.length > 0) setRouteId(res.data[0].route_id);
    }).catch(err => console.error(err));
  }, []);

  const triggerEvent = async (eventType) => {
    if (!routeId) return;
    setLoading(true);
    setActiveEvent(eventType);
    try {
      const payload = { route_id: routeId, event_type: eventType, data: {} };
      const res = await replanEvent(payload);
      const data = res.data;
      
      setResult({ 
        eventType, 
        eventLabel: EVENTS.find(e => e.type === eventType)?.label,
        ...data 
      });
      
    } catch (e) {
      setResult({ error: 'Event simulation failed. Is the backend running?' });
    }
    setLoading(false);
    setActiveEvent(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Event Simulator</h1>
        <p className="text-slate-500 text-sm mt-1">Inject real-time events and observe incremental replanning.</p>
      </header>

      {/* Event Grid */}
      <div className="grid grid-cols-6 gap-4 mb-8">
        {EVENTS.map(e => (
          <button
            key={e.type}
            onClick={() => triggerEvent(e.type)}
            disabled={loading}
            className={`flex flex-col items-center justify-center p-5 bg-white border rounded-xl shadow-sm transition-all disabled:opacity-50 group cursor-pointer ${e.color}`}
          >
            <div className="mb-3 transform group-hover:scale-110 transition-transform">{e.icon}</div>
            <span className="text-sm font-bold text-slate-800 text-center mb-1 leading-tight">{e.label}</span>
            <span className="text-[10px] text-slate-500 text-center px-1">{e.desc}</span>
            {loading && activeEvent === e.type && (
              <span className="text-xs text-indigo-500 mt-2 animate-pulse font-medium">Replanning...</span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Recent Simulations Table */}
        <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-base">Recent Simulations</h3>
            <select
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1 shadow-sm focus:outline-none w-32"
              value={routeId}
              onChange={e => setRouteId(e.target.value)}
            >
              {routes.slice(0,10).map((r, i) => (
                <option key={r.route_id} value={r.route_id}>
                  {r.route_id.substring(0, 15)}...
                </option>
              ))}
            </select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50/50">
                <tr>
                  <th className="px-4 py-3 font-semibold rounded-tl-lg">Event Type</th>
                  <th className="px-4 py-3 font-semibold">Route ID</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Impact</th>
                  <th className="px-4 py-3 font-semibold rounded-tr-lg"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-4 font-medium text-slate-800">New Pickup</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">Route_00143bd</td>
                  <td className="px-4 py-4 text-xs">10:42 AM</td>
                  <td className="px-4 py-4"><span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Completed</span></td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-700">+4 min, +2.1 km</td>
                  <td className="px-4 py-4 text-right"><button className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-3 py-1 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors">View</button></td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-4 font-medium text-slate-800">Traffic Delay</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">Route_00143bd</td>
                  <td className="px-4 py-4 text-xs">09:15 AM</td>
                  <td className="px-4 py-4"><span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Completed</span></td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-700">+7 min, +3.8 km</td>
                  <td className="px-4 py-4 text-right"><button className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-3 py-1 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors">View</button></td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-4 font-medium text-slate-800">Failed Delivery</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">Route_80116ef</td>
                  <td className="px-4 py-4 text-xs">Yesterday</td>
                  <td className="px-4 py-4"><span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Completed</span></td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-700">-6 min, -2.4 km</td>
                  <td className="px-4 py-4 text-right"><button className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-3 py-1 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors">View</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Last Simulation Result */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col">
          <h3 className="font-bold text-slate-800 text-base mb-4 border-b border-slate-100 pb-3">Last Simulation Result</h3>
          
          <div className="flex-1">
            <p className="text-sm text-slate-500 mb-2">Event: <strong className="text-slate-800">{result?.eventLabel || 'New Pickup Request'}</strong></p>
            <p className="text-sm text-slate-500 mb-2 flex items-center">Status: <span className="ml-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Completed</span></p>
            <p className="text-sm text-slate-500 mb-6">Replanned in: <strong className="text-slate-800">18.4 seconds</strong></p>
            
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Impact Summary</h4>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4 marker:text-slate-300">
              <li>Added 1 pickup stop</li>
              <li>Distance increased by 2.1 km</li>
              <li>ETA increased by 4 minutes</li>
              <li>No constraint violations</li>
            </ul>
          </div>

          <button className="w-full mt-6 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold py-2.5 rounded shadow-sm transition-colors flex justify-center items-center">
            <FileSearch size={14} className="mr-2" />
            View Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default Simulation;
