import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, ShieldCheck, Box, IndianRupee, Clock, BellRing } from 'lucide-react';

const Settings = () => {
  const [saving, setSaving] = useState(false);
  
  const [config, setConfig] = useState({
    capacityLimit: "2800000",
    codLimit: "50000",
    timeWindowStrictness: "Hard",
    maxStopsPerRoute: "185",
    enableAutoReplan: true,
    notifyDrivers: true
  });

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Configure AI constraint thresholds and operational limits.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center disabled:opacity-50"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </header>

      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Col */}
        <div className="col-span-8 space-y-6">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center border-b border-slate-100 pb-3">
              <ShieldCheck size={18} className="mr-2 text-indigo-500" /> Core Routing Constraints
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center">
                  <Box size={14} className="mr-1.5 text-slate-400" /> Max Vehicle Capacity (cm³)
                </label>
                <input 
                  type="number" 
                  value={config.capacityLimit}
                  onChange={e => setConfig({...config, capacityLimit: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                />
                <p className="text-[10px] text-slate-500 mt-1">Default is 2,800,000 based on standard van dimensions.</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center">
                  <IndianRupee size={14} className="mr-1.5 text-slate-400" /> COD Cash Carry Limit (₹)
                </label>
                <input 
                  type="number" 
                  value={config.codLimit}
                  onChange={e => setConfig({...config, codLimit: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                />
                <p className="text-[10px] text-slate-500 mt-1">Safety threshold before triggering intermediate deposit.</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center">
                  <Clock size={14} className="mr-1.5 text-slate-400" /> Time Window Strictness
                </label>
                <select 
                  value={config.timeWindowStrictness}
                  onChange={e => setConfig({...config, timeWindowStrictness: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                >
                  <option value="Hard">Hard Constraints (Do not violate)</option>
                  <option value="Soft">Soft Constraints (Allow penalties)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center">
                  <SettingsIcon size={14} className="mr-1.5 text-slate-400" /> Max Stops Per Route
                </label>
                <input 
                  type="number" 
                  value={config.maxStopsPerRoute}
                  onChange={e => setConfig({...config, maxStopsPerRoute: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Col */}
        <div className="col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center border-b border-slate-100 pb-3">
              <BellRing size={18} className="mr-2 text-indigo-500" /> Automation Rules
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-start cursor-pointer group">
                <div className="relative flex items-center justify-center w-10 h-5 mt-0.5">
                  <input type="checkbox" className="peer sr-only" checked={config.enableAutoReplan} onChange={e => setConfig({...config, enableAutoReplan: e.target.checked})} />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <div className="ml-3">
                  <span className="block text-sm font-bold text-slate-800">Enable Auto-Replanning</span>
                  <span className="block text-[11px] text-slate-500 mt-1">Automatically fix constraints on the fly without supervisor approval for minor deviations.</span>
                </div>
              </label>

              <label className="flex items-start cursor-pointer group">
                <div className="relative flex items-center justify-center w-10 h-5 mt-0.5">
                  <input type="checkbox" className="peer sr-only" checked={config.notifyDrivers} onChange={e => setConfig({...config, notifyDrivers: e.target.checked})} />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <div className="ml-3">
                  <span className="block text-sm font-bold text-slate-800">Push Notifications to Drivers</span>
                  <span className="block text-[11px] text-slate-500 mt-1">Send immediate alerts when route gets replanned due to traffic or violations.</span>
                </div>
              </label>
            </div>
          </div>
          
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
            <h4 className="font-bold text-indigo-900 text-sm mb-2">Backend Configuration Sync</h4>
            <p className="text-xs text-indigo-700 leading-relaxed">
              These settings are synced in real-time with the Python FastAPI backend engine. Updates to constraints will affect all future route optimizations globally.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
