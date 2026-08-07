import React, { useState, useEffect } from 'react';
import { Activity, Clock, Box, ShieldCheck, MapPin, Play, AlertTriangle, AlertCircle, AlertOctagon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import MapViewer from '../components/MapViewer';
import { getRoutes, optimizeRoute } from '../api';

const Dashboard = () => {
  const [routes, setRoutes] = useState([]);
  const [activeRouteId, setActiveRouteId] = useState(null);
  
  const [mapSequence, setMapSequence] = useState([]);
  const [mapCoords, setMapCoords] = useState({});
  const [loading, setLoading] = useState(false);
  
  const [kpis, setKpis] = useState({
    distance: "1,428",
    time: "07h 32m",
    efficiency: "87",
    utilization: "96"
  });

  useEffect(() => {
    getRoutes().then(res => {
      setRoutes(res.data);
      if (res.data.length > 0) setActiveRouteId(res.data[0].route_id);
    }).catch(err => console.error(err));
  }, []);

  const handleOptimize = async () => {
    if (!activeRouteId) return;
    setLoading(true);
    try {
      const res = await optimizeRoute(activeRouteId);
      const data = res.data;
      setMapSequence(data.optimized_sequence);
      if (data.stop_coordinates) setMapCoords(data.stop_coordinates);
      
      const hrs = Math.floor(data.kpis.total_travel_time_sec / 3600);
      const mins = Math.floor((data.kpis.total_travel_time_sec % 3600) / 60);

      setKpis({
        distance: data.kpis.total_distance_km.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
        time: `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`,
        efficiency: data.kpis.route_efficiency_score.toFixed(0),
        utilization: data.kpis.capacity_utilization.toFixed(0)
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const performanceData = [
    { name: 'Score', value: parseInt(kpis.efficiency) || 87 },
    { name: 'Remaining', value: 100 - (parseInt(kpis.efficiency) || 87) }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      
      {/* HEADER */}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time overview of your fleet operations</p>
        </div>
        <div className="flex space-x-3 items-center">
          <div className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 shadow-sm">
            Today, 23 May 2025 ▼
          </div>
          <button 
            onClick={handleOptimize}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-5 rounded-lg shadow-sm transition-colors flex items-center"
          >
            {loading ? <Activity className="animate-spin mr-2" size={16} /> : <Play className="mr-2" size={16} />}
            Run OR-Tools Optimizer
          </button>
        </div>
      </header>

      {/* KPI STRIP */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Routes</div>
          <div className="text-3xl font-bold text-slate-800">17</div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 2 vs yesterday</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between border-l-4 border-l-transparent">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Stops</div>
          <div className="text-3xl font-bold text-slate-800">320</div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 18 vs yesterday</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><MapPin size={14} className="mr-1"/> Total Distance</div>
          <div className="text-3xl font-bold text-slate-800">{kpis.distance}<span className="text-lg text-slate-400 font-medium ml-1">km</span></div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 4.2% vs yesterday</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><Clock size={14} className="mr-1"/> Avg. ETA</div>
          <div className="text-3xl font-bold text-slate-800">{kpis.time}</div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↓ 8.5% vs yesterday</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between col-start-4 row-start-1 absolute invisible">
           {/* Fallback for the 4th box if grid gets misaligned */}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between col-start-4">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><Box size={14} className="mr-1"/> Capacity Utilized</div>
          <div className="text-3xl font-bold text-slate-800">{kpis.utilization}<span className="text-lg text-slate-400 font-medium ml-1">%</span></div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 3% vs yesterday</div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* MAP COLUMN (Left - 8 cols) */}
        <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-lg">Live Fleet Map</h3>
            <div className="flex space-x-4 text-xs font-medium text-slate-600">
              <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Depot</span>
              <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></div> Stops</span>
              <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-blue-400 mr-2"></div> Active Vehicle</span>
              <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Delayed Stop</span>
            </div>
          </div>
          <div className="h-[450px] w-full rounded-lg overflow-hidden border border-slate-200">
            <MapViewer routeSequence={mapSequence} stopCoordinates={mapCoords} />
          </div>
        </div>

        {/* SIDEBAR (Right - 4 cols) */}
        <div className="col-span-4 flex flex-col space-y-6">
          
          {/* Route Performance Gauge */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1">
            <h3 className="font-bold text-slate-800 text-base mb-4">Route Performance</h3>
            <div className="relative h-40 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceData}
                    cx="50%"
                    cy="50%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="#4F46E5" />
                    <Cell fill="#F1F5F9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center -mt-4">
                <span className="text-3xl font-bold text-slate-800">{performanceData[0].value}</span>
                <span className="text-xs text-slate-400 font-medium">/ 100</span>
              </div>
            </div>
            
            <div className="space-y-2 mt-4 text-sm font-medium">
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></div> Excellent</span><span className="text-slate-800">12</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-blue-400 mr-2"></div> Good</span><span className="text-slate-800">3</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-orange-400 mr-2"></div> Average</span><span className="text-slate-800">2</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Poor</span><span className="text-slate-800">0</span></div>
            </div>
          </div>
          
          {/* Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1">
            <h3 className="font-bold text-slate-800 text-base mb-4">Alerts</h3>
            <div className="space-y-3">
              <div className="flex items-start p-3 bg-red-50 rounded-lg border border-red-100">
                <AlertOctagon size={16} className="text-red-500 mt-0.5 mr-3 flex-shrink-0"/>
                <div className="text-sm text-red-800 font-medium">2 Vehicles delayed</div>
              </div>
              <div className="flex items-start p-3 bg-orange-50 rounded-lg border border-orange-100">
                <AlertTriangle size={16} className="text-orange-500 mt-0.5 mr-3 flex-shrink-0"/>
                <div className="text-sm text-orange-800 font-medium">1 COD limit approaching</div>
              </div>
              <div className="flex items-start p-3 bg-amber-50 rounded-lg border border-amber-100">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 mr-3 flex-shrink-0"/>
                <div className="text-sm text-amber-800 font-medium">3 Delivery window at risk</div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Dashboard;
