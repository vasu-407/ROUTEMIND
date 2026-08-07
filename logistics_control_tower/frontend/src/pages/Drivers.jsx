import React, { useState, useEffect } from 'react';
import { getRoutes } from '../api';
import { Search, UserCircle, MapPin, Truck, Phone } from 'lucide-react';

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getRoutes().then(res => {
      // Map live routes to active drivers
      const mappedDrivers = res.data.map((r, i) => ({
        id: `D-${r.route_id.substring(0, 8).toUpperCase()}`,
        name: `Driver ${r.route_id.substring(0, 5)}`,
        station: r.station_code || 'Unknown',
        route: r.route_id,
        stops: r.stops,
        status: 'Active',
        phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`
      }));
      setDrivers(mappedDrivers);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const filtered = drivers.filter(d => 
    d.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.route.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Drivers Directory</h1>
          <p className="text-slate-500 text-sm mt-1">Live driver assignments based on active routes.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search drivers or routes..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm w-72"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        </div>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400 font-medium animate-pulse">Loading live driver data...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Driver</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Assigned Route</th>
                  <th className="px-6 py-4 font-semibold">Station / Depot</th>
                  <th className="px-6 py-4 font-semibold">Stops</th>
                  <th className="px-6 py-4 font-semibold">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <UserCircle size={32} className="text-slate-300 mr-3" />
                        <div>
                          <div className="font-bold text-slate-800">{d.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{d.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase">
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-indigo-600 flex items-center mt-2">
                      <Truck size={14} className="mr-2 text-indigo-400" />
                      {d.route.substring(0,12)}...
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-600">
                        <MapPin size={14} className="mr-1 text-slate-400" /> {d.station}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {d.stops}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-500">
                        <Phone size={14} className="mr-2 text-slate-400" /> {d.phone}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">No drivers found matching your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;
