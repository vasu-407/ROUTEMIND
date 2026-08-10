import React from 'react';
import { Truck, AlertTriangle, Clock, MapPin } from 'lucide-react';

const Simulator = ({ onEventTrigger }) => {
  const events = [
    { type: 'NEW_PICKUP', label: 'New Pickup Request', icon: <MapPin className="text-blue-500"/> },
    { type: 'TRAFFIC_DELAY', label: 'Heavy Traffic Delay', icon: <Clock className="text-orange-500"/> },
    { type: 'FAILED_DELIVERY', label: 'Customer Not Home', icon: <AlertTriangle className="text-red-500"/> },
    { type: 'VEHICLE_BREAKDOWN', label: 'Vehicle Breakdown', icon: <Truck className="text-gray-500"/> }
  ];

  return (
    <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200">
      <h3 className="font-bold text-gray-800 mb-4 text-lg">Event Simulator</h3>
      <p className="text-sm text-gray-500 mb-4">Inject real-time perturbations to test incremental replanning.</p>
      
      <div className="grid grid-cols-2 gap-3">
        {events.map((e) => (
          <button 
            key={e.type}
            onClick={() => onEventTrigger(e.type)}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-amazon-blue transition-all"
          >
            <div className="mb-2">{e.icon}</div>
            <span className="text-xs font-semibold text-center text-gray-700">{e.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Simulator;
