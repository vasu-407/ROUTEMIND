import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Supervisor from './pages/Supervisor';
import RoutePlanner from './pages/RoutePlanner';
import Simulation from './pages/Simulation';
import AiInsights from './pages/AiInsights';
import Settings from './pages/Settings';
import DriverMode from './pages/DriverMode';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto custom-scrollbar">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/route-planner" element={<RoutePlanner />} />
              <Route path="/simulation" element={<Simulation />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/ai-insights" element={<AiInsights />} />
              <Route path="/supervisor" element={<Supervisor />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/driver-mode" element={<DriverMode />} />
            </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
