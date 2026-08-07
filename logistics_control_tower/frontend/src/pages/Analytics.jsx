import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { MapPin, Clock, Fuel, IndianRupee, Download } from 'lucide-react';

const distData = [
  { name: 'Mon', Greedy: 180, 'OR-Tools': 140 },
  { name: 'Tue', Greedy: 190, 'OR-Tools': 150 },
  { name: 'Wed', Greedy: 170, 'OR-Tools': 130 },
  { name: 'Thu', Greedy: 200, 'OR-Tools': 160 },
  { name: 'Fri', Greedy: 210, 'OR-Tools': 165 },
  { name: 'Sat', Greedy: 160, 'OR-Tools': 120 },
  { name: 'Sun', Greedy: 140, 'OR-Tools': 110 },
];

const etaData = [
  { name: 'Mon', Greedy: 420, 'OR-Tools': 350 },
  { name: 'Tue', Greedy: 400, 'OR-Tools': 330 },
  { name: 'Wed', Greedy: 380, 'OR-Tools': 320 },
  { name: 'Thu', Greedy: 450, 'OR-Tools': 380 },
  { name: 'Fri', Greedy: 460, 'OR-Tools': 390 },
  { name: 'Sat', Greedy: 300, 'OR-Tools': 250 },
  { name: 'Sun', Greedy: 280, 'OR-Tools': 240 },
];

const violationData = [
  { name: 'Capacity', value: 1 },
  { name: 'Time Window', value: 2 },
  { name: 'COD Limit', value: 1 },
  { name: 'Other', value: 1 },
];
const VIOLATION_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

const Analytics = () => {

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      {/* HEADER */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Deep insights into your operations</p>
        </div>
        <div className="flex space-x-3 items-center">
          <select className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 shadow-sm focus:outline-none">
            <option>This Week</option>
          </select>
          <select className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 shadow-sm focus:outline-none">
            <option>All Depots</option>
          </select>
          <button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center">
            <Download className="mr-2" size={16} /> Export Report
          </button>
        </div>
      </header>
      
      {/* KPI STRIP */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><MapPin size={14} className="mr-1"/> Distance Saved</div>
          <div className="text-3xl font-bold text-slate-800">185<span className="text-lg text-slate-400 font-medium ml-1">km</span></div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 12.5% vs last week</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><Clock size={14} className="mr-1"/> Time Saved</div>
          <div className="text-3xl font-bold text-slate-800">5h 23m</div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 15.2% vs last week</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><Fuel size={14} className="mr-1"/> Fuel Saved</div>
          <div className="text-3xl font-bold text-slate-800">23.7<span className="text-lg text-slate-400 font-medium ml-1">L</span></div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 13.8% vs last week</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center"><IndianRupee size={14} className="mr-1"/> Cost Saved</div>
          <div className="text-3xl font-bold text-slate-800">₹ 12,450</div>
          <div className="text-green-500 text-xs font-medium mt-2 flex items-center">↑ 11.3% vs last week</div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-12 gap-6 h-[400px]">
        
        <div className="col-span-5 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 mb-6">Distance Comparison</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Greedy" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="OR-Tools" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 mb-6">ETA Comparison (Minutes)</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={etaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Greedy" stroke="#94A3B8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="OR-Tools" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-3 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col relative">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Constraint Violations</h3>
          <div className="flex-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={violationData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                  {violationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={VIOLATION_COLORS[index % VIOLATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
              <span className="text-3xl font-bold text-slate-800">5</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total</span>
            </div>
            
            <div className="absolute bottom-0 w-full">
              <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-xs">
                 {violationData.map((entry, index) => (
                   <div key={index} className="flex items-center">
                     <div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: VIOLATION_COLORS[index]}}></div>
                     <span className="text-slate-600 truncate">{entry.name} ({entry.value})</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;
