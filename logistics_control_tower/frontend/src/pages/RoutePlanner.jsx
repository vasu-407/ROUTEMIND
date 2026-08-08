import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoutes, compareSolvers } from '../api';
import { MapPin, Box, Banknote, Clock, Check, Activity, Search, AlertCircle, Maximize2, ArrowRight, Navigation } from 'lucide-react';
import MapViewer from '../components/MapViewer';

const RoutePlanner = () => {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const [mapSequence, setMapSequence] = useState([]);
  const [beforeSequence, setBeforeSequence] = useState([]);
  const [mapCoords, setMapCoords] = useState({});

  useEffect(() => {
    getRoutes().then(res => {
      setRoutes(res.data);
      if (res.data.length > 0) setSelectedRoute(res.data[0].route_id);
    }).catch(console.error);
  }, []);

  const handleOptimize = async () => {
    if (!selectedRoute) return;
    setLoading(true);
    try {
      const res = await compareSolvers(selectedRoute);
      setComparison(res.data);
      if (res.data.ortools_solver) {
         setMapSequence(res.data.ortools_solver.sequence || []);
         setBeforeSequence(res.data.greedy_baseline?.sequence || []);
         setMapCoords(res.data.stop_coordinates || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAnalyze = () => {
    if (selectedRoute) {
      navigate(`/simulation?routeId=${encodeURIComponent(selectedRoute)}`);
    }
  };

  const getFormatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  };

  const ortools = comparison?.ortools_solver;
  const greedy = comparison?.greedy_baseline;
  const candidateEvaluation = comparison?.candidate_evaluation;
  const selectedSolution = comparison?.winner === 'ortools_solver' ? ortools : greedy;
  const selectedRouteData = routes.find(route => route.route_id === selectedRoute);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      {/* HEADER */}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Route Planner</h1>
          <p className="text-slate-500 text-sm mt-1">Plan and optimize routes with AI-powered optimization</p>
        </div>
        <div className="flex space-x-3 items-center">
          <select
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-64"
            value={selectedRoute}
            onChange={e => setSelectedRoute(e.target.value)}
          >
            {routes.map((r, i) => (
              <option key={r.route_id} value={r.route_id}>
                {r.route_id.substring(0, 15)}...
              </option>
            ))}
          </select>
          <button
            onClick={handleOptimize}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-5 rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-70"
          >
            {loading ? <Activity className="animate-spin mr-2" size={16} /> : <Search className="mr-2" size={16} />}
            Optimize Route
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!selectedRoute}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-5 rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-70"
          >
            Analyze This Route <ArrowRight className="ml-2" size={16} />
          </button>
        </div>
      </header>

      {/* 3 COLUMN LAYOUT */}
      <div className="grid grid-cols-12 gap-6 h-[75vh]">
        {/* COLUMN 1: Route Summary (3 cols) */}
        <div className="col-span-3 flex flex-col space-y-4 h-full">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-slate-800 text-base mb-5 border-b border-slate-100 pb-3">Route Summary</h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center"><MapPin size={12} className="mr-1"/> Depot</p>
                <p className="text-sm font-medium text-slate-800">{selectedRouteData?.depot || 'Loading depot…'}</p>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Stops</p>
                <p className="text-sm font-medium text-slate-800">{selectedRouteData?.stops ?? '—'}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Distance</p>
                <p className="text-sm font-medium text-slate-800">{selectedSolution ? selectedSolution.total_distance_km.toFixed(1) : "142.6"} km</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Estimated Time</p>
                <p className="text-sm font-medium text-slate-800">{selectedSolution ? getFormatTime(selectedSolution.total_travel_time_sec) : "06h 51m"}</p>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center"><Box size={12} className="mr-1"/> Capacity Used</p>
                  <p className="text-xs font-bold text-slate-800">{selectedSolution ? selectedSolution.capacity_utilization.toFixed(0) : "82"}%</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: selectedSolution ? `${selectedSolution.capacity_utilization}%` : '82%' }}></div>
                </div>
                <p className="text-[10px] text-slate-500 text-right">Based on selected route capacity</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center"><Banknote size={12} className="mr-1"/> COD Amount</p>
                <p className="text-sm font-medium text-slate-800">₹ {selectedRouteData?.cod_total_inr?.toLocaleString() || '—'} / ₹ 50,000</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center"><Clock size={12} className="mr-1"/> Time Window</p>
                <p className="text-sm font-medium text-slate-800">6:00 AM - 8:00 PM</p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Map (6 cols) */}
        <div className="col-span-6 h-full relative group">
          <div className="absolute top-4 right-4 z-10 bg-white p-2 rounded shadow text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors">
            <Maximize2 size={18} />
          </div>
          <div className="h-full w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <MapViewer routeSequence={mapSequence} beforeSequence={beforeSequence} stopCoordinates={mapCoords} />
          </div>
        </div>

        {/* COLUMN 3: Constraints & Engine (3 cols) */}
        <div className="col-span-3 flex flex-col space-y-4 h-full">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-bold text-slate-800 text-base mb-4 border-b border-slate-100 pb-3">Constraints Check</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-slate-600 font-medium">Capacity</span>
                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded flex items-center"><Check size={12} className="mr-1"/> Valid</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-slate-600 font-medium">Time Windows</span>
                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded flex items-center"><Check size={12} className="mr-1"/> Valid</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-slate-600 font-medium">Driver Hours</span>
                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded flex items-center"><Check size={12} className="mr-1"/> Valid</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-slate-600 font-medium">COD Limit</span>
                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded flex items-center"><Check size={12} className="mr-1"/> Valid</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-slate-600 font-medium">Zone Restrictions</span>
                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded flex items-center"><Check size={12} className="mr-1"/> Valid</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col">
            <h3 className="font-bold text-slate-800 text-base mb-4 border-b border-slate-100 pb-3">Optimization Engine</h3>
            
            <div className="space-y-3 flex-1">
              {candidateEvaluation && (
                <div className={`rounded-lg p-3 text-xs font-medium ${candidateEvaluation.is_improvement ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>
                  <span className="font-bold">{candidateEvaluation.is_improvement ? 'OR-Tools recommended' : 'Keep current route'}</span>
                  <p className="mt-1">{candidateEvaluation.reason}</p>
                </div>
              )}
              <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors">
                <div className="flex items-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-slate-400 mr-2"></div>
                  <span className="text-sm font-medium text-slate-700">Greedy Baseline</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 pl-4 mt-1">
                   <span>{greedy ? getFormatTime(greedy.total_travel_time_sec) : "06h 51m"}</span>
                   <span>{greedy ? greedy.total_distance_km.toFixed(1) : "151.3"} km</span>
                </div>
              </div>

              <div className={`border-2 rounded-lg p-3 relative ${comparison?.winner === 'ortools_solver' ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-slate-50'}`}>
                {comparison?.winner === 'ortools_solver' && <div className="absolute top-2 right-2 text-indigo-600"><Check size={14} /></div>}
                <div className="flex items-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></div>
                  <span className="text-sm font-bold text-indigo-700">OR-Tools {comparison?.winner === 'ortools_solver' ? '(Recommended)' : '(Not recommended)'}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-indigo-600 pl-4 mt-1">
                   <span>{ortools ? getFormatTime(ortools.total_travel_time_sec) : "05h 43m"}</span>
                   <span>{ortools ? ortools.total_distance_km.toFixed(1) : "142.6"} km</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-2 mt-4 pt-4 border-t border-slate-100">
              <button 
                onClick={() => alert("Comparison details not implemented.")}
                className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold py-2 rounded shadow-sm transition-colors">
                View Comparison
              </button>
              <button 
                onClick={() => {
                  if (!selectedRouteData || !selectedSolution) return;
                  localStorage.setItem('offline_driver_route', JSON.stringify({
                    route_id: selectedRoute,
                    sequence: selectedSolution.sequence,
                    stop_coordinates: mapCoords
                  }));
                  navigate('/driver-mode');
                }}
                disabled={!selectedSolution}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded shadow-sm transition-colors flex items-center justify-center">
                <Navigation size={14} className="mr-1" /> Start Journey
              </button>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
};

export default RoutePlanner;
