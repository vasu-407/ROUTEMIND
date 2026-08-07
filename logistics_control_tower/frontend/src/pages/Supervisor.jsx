import React, { useState, useEffect } from 'react';
import { getRoutes } from '../api';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const Supervisor = () => {
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    getRoutes().then(res => setRoutes(res.data)).catch(err => console.error(err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-amazon-dark">Supervisor Console</h1>
        <p className="text-gray-500 font-medium">Monitor active routes and constraint violations. (Showing top 100 routes)</p>
      </header>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Route ID</th>
                <th className="px-6 py-4">Stops</th>
                <th className="px-6 py-4">Capacity Status</th>
                <th className="px-6 py-4">COD Limit Status</th>
                <th className="px-6 py-4">Time Window Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.slice(0, 100).map((route, idx) => (
                <tr key={route.route_id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 truncate max-w-xs">{route.route_id}</td>
                  <td className="px-6 py-4">{route.stops}</td>
                  
                  {/* Mocking constraint statuses for the demo flow */}
                  <td className="px-6 py-4">
                    <div className="flex items-center text-green-600">
                      <CheckCircle size={16} className="mr-2" /> Valid
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {idx === 0 ? (
                      <div className="flex items-center text-orange-600 font-semibold">
                        <AlertTriangle size={16} className="mr-2" /> Repaired
                      </div>
                    ) : (
                      <div className="flex items-center text-green-600">
                        <CheckCircle size={16} className="mr-2" /> Valid
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center text-green-600">
                      <CheckCircle size={16} className="mr-2" /> Valid
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-1 px-3 rounded shadow-sm transition-colors">
                      Reject
                    </button>
                    <button className="bg-amazon-blue hover:bg-blue-800 text-white font-medium py-1 px-3 rounded shadow-sm transition-colors">
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
              {routes.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">No routes active.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Supervisor;
