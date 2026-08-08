import React, { useState, useEffect } from 'react';
import { getRoutes } from '../api';
import { Search, Truck, Box, MapPin, Activity } from 'lucide-react';

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getRoutes().then(res => {
      // Map live routes to active vehicles
      const mappedVehicles = res.data.map((r, i) => ({
        id: `VAN-${r.route_id.substring(8, 16).toUpperCase()}`,
        type: 'Delivery Van',
        capacity: '2,800,000 cm³',
        station: r.station_code || 'Unknown',
        route: r.route_id,
        status: 'On Route',
        utilization: Math.floor(65 + Math.random() * 30) // Simulate between 65-95%
      }));
      setVehicles(mappedVehicles);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const filtered = vehicles.filter(v => 
    v.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.station.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fleet Vehicles</h1>
          <p className="text-slate-500 text-sm mt-1">Live vehicle assignments based on active routes.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search vehicles or routes..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm w-72"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        </div>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400 font-medium animate-pulse">Loading live fleet data...</div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {filtered.map(v => (
            <div key={v.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:border-indigo-200 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 mr-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 leading-tight">{v.id}</h3>
                    <p className="text-xs text-slate-500">{v.type}</p>
                  </div>
                </div>
                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase flex items-center">
                  <Activity size={10} className="mr-1" /> {v.status}
                </span>
              </div>
              
              <div className="space-y-3 mb-5 border-t border-slate-50 pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center"><MapPin size={14} className="mr-2" /> Station</span>
                  <span className="font-semibold text-slate-700">{v.station}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center"><Box size={14} className="mr-2" /> Max Capacity</span>
                  <span className="font-semibold text-slate-700">{v.capacity}</span>
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-semibold text-slate-600">Assigned Route</span>
                </div>
                <div className="font-mono text-xs text-indigo-600 font-medium truncate mb-3" title={v.route}>
                  {v.route}
                </div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Capacity Utilized</span>
                  <span className="text-xs font-bold text-slate-700">{v.utilization}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${v.utilization > 90 ? 'bg-orange-500' : 'bg-indigo-500'}`} style={{ width: `${v.utilization}%` }}></div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 py-12 text-center text-slate-400">No vehicles found matching your search.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Vehicles;
