import React, { useState, useEffect } from 'react';
import { Activity, Clock, Box, MapPin, Play, AlertTriangle, AlertOctagon, Bot, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import MapViewer from '../components/MapViewer';
import { getRoutes, getRouteMap, optimizeRoute, getDashboardData } from '../api';

const ROUTE_CACHE_KEY = 'routemind:last-route-map';

const Dashboard = () => {
  const [routes, setRoutes] = useState([]);
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  
  const [mapSequence, setMapSequence] = useState([]);
  const [mapCoords, setMapCoords] = useState({});
  const [loading, setLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  
  const [kpis, setKpis] = useState({
    distance: "1,428",
    time: "07h 32m",
    efficiency: "87",
    utilization: "96"
  });

  useEffect(() => {
    Promise.all([getRoutes(), getDashboardData()])
      .then(([routesRes, dashboardRes]) => {
        setRoutes(routesRes.data);
        const firstRouteId = routesRes.data[0]?.route_id;
        if (firstRouteId) {
          setActiveRouteId(firstRouteId);
          getRouteMap(firstRouteId)
            .then(({ data }) => {
              setMapSequence(data.sequence || []);
              setMapCoords(data.stop_coordinates || {});
              localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(data));
            })
            .catch(console.error);
        }
        setDashboardData(dashboardRes.data);
      })
      .catch(err => {
        const cached = localStorage.getItem(ROUTE_CACHE_KEY);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setMapSequence(data.sequence || []);
            setMapCoords(data.stop_coordinates || {});
          } catch (_) {}
        }
        console.error(err);
      });
  }, []);

  const selectRoute = async (routeId) => {
    setActiveRouteId(routeId);
    try {
      const { data } = await getRouteMap(routeId);
      setMapSequence(data.sequence || []);
      setMapCoords(data.stop_coordinates || {});
      localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error(error);
    }
  };

  const handleOptimize = async () => {
    if (!activeRouteId) return;
    setLoading(true);
    try {
      const res = await optimizeRoute(activeRouteId);
      const data = res.data;
      setMapSequence(data.optimized_sequence);
      if (data.stop_coordinates) setMapCoords(data.stop_coordinates);
      localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify({
        route_id: data.route_id,
        sequence: data.optimized_sequence,
        stop_coordinates: data.stop_coordinates || {},
      }));
      
      const hrs = Math.floor(data.kpis.total_travel_time_sec / 3600);
      const mins = Math.floor((data.kpis.total_travel_time_sec % 3600) / 60);

      setKpis({
        distance: data.kpis.total_distance_km.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
        time: `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`,
        efficiency: data.kpis.route_efficiency_score.toFixed(0),
        utilization: data.kpis.capacity_utilization.toFixed(0)
      });
      setAiRecommendation(data.ai_explanation || null);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const performanceData = [
    { name: 'Score', value: parseInt(kpis.efficiency) || 87 },
    { name: 'Remaining', value: 100 - (parseInt(kpis.efficiency) || 87) }
  ];
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      
      {/* HEADER */}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time overview of your fleet operations</p>
        </div>
        <div className="flex space-x-3 items-center">
          <div className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 shadow-sm">Today · {todayLabel}</div>
          <select value={activeRouteId || ''} onChange={(event) => selectRoute(event.target.value)} className="max-w-52 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 shadow-sm">
            {routes.slice(0, 25).map(route => <option key={route.route_id} value={route.route_id}>{route.label || route.route_id}</option>)}
          </select>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Routes</div>
          <div className="text-3xl font-bold text-slate-800">{dashboardData?.active_routes || 0}</div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ Active Fleet</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between border-l-4 border-l-transparent">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Stops</div>
          <div className="text-3xl font-bold text-slate-800">{dashboardData?.total_stops || 0}</div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ System Wide</div>
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><Box size={14} className="mr-1"/> Capacity Utilized</div>
          <div className="text-3xl font-bold text-slate-800">{dashboardData?.fleet_utilization_pct || kpis.utilization}<span className="text-lg text-slate-400 font-medium ml-1">%</span></div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">Average Fleet Capacity</div>
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
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 text-indigo-100 text-xs font-semibold uppercase tracking-wider"><Bot size={15} /> AI planning assistant</div>
            <p className="mt-3 text-sm leading-relaxed">{aiRecommendation?.reason_changed || 'Choose a route and run the optimizer to receive an explainable route recommendation.'}</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold"><Sparkles size={14} /> {aiRecommendation?.supervisor_recommendation || 'Waiting for an optimization run'}</div>
          </div>
          
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
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></div> Excellent</span><span className="text-slate-800">{dashboardData?.performance_buckets?.excellent || 0}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-blue-400 mr-2"></div> Good</span><span className="text-slate-800">{dashboardData?.performance_buckets?.good || 0}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-orange-400 mr-2"></div> Average</span><span className="text-slate-800">{dashboardData?.performance_buckets?.average || 0}</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Poor</span><span className="text-slate-800">{dashboardData?.performance_buckets?.poor || 0}</span></div>
            </div>
          </div>
          
          {/* Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1">
            <h3 className="font-bold text-slate-800 text-base mb-4">Alerts</h3>
            <div className="space-y-3">
              {dashboardData?.alerts && dashboardData.alerts.length > 0 ? (
                dashboardData.alerts.map((alert, idx) => (
                  <div key={idx} className={`flex items-start p-3 rounded-lg border ${alert.level === 'critical' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                    {alert.level === 'critical' ? <AlertOctagon size={16} className="text-red-500 mt-0.5 mr-3 flex-shrink-0"/> : <AlertTriangle size={16} className="text-orange-500 mt-0.5 mr-3 flex-shrink-0"/>}
                    <div className={`text-sm font-medium ${alert.level === 'critical' ? 'text-red-800' : 'text-orange-800'}`}>{alert.message}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 text-center py-4">No active alerts</div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Dashboard;
