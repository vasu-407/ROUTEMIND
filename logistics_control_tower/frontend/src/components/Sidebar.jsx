import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, LineChart, ShieldAlert, Route, Activity, Bot, Users, Truck, Settings, BrainCircuit } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const links = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Route Planner', path: '/route-planner', icon: <Route size={20} /> },
    { name: 'Simulation', path: '/simulation', icon: <Activity size={20} /> },
    { name: 'Analytics', path: '/analytics', icon: <LineChart size={20} /> },
    { name: 'AI Insights', path: '/ai-insights', icon: <Bot size={20} /> },
    { name: 'Supervisor Console', path: '/supervisor', icon: <ShieldAlert size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  if (location.pathname.startsWith('/driver-mode')) {
    return null;
  }

  return (
    <div className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col border-r border-slate-800 font-sans shrink-0">
      <div className="p-5 flex items-center space-x-3">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <BrainCircuit size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white leading-tight tracking-wide">RouteMind AI</h2>
          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">Control Tower</p>
        </div>
      </div>
      
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {links.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive 
                  ? 'bg-indigo-600/10 text-indigo-400 relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-8 before:bg-indigo-600 before:rounded-r-md' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <div className={`${link.path === location.pathname ? 'text-indigo-500' : 'text-slate-400'}`}>
              {link.icon}
            </div>
            <span>{link.name}</span>
          </NavLink>
        ))}
      </div>
      
      <div className="p-4 bg-slate-800/50 mt-auto">
        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center text-green-400 font-bold text-sm">
            S
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Supervisor</p>
            <p className="text-xs text-slate-400">Station BLR1</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
