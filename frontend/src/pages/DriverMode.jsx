import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, Navigation, WifiOff, Wifi, AlertTriangle } from 'lucide-react';
import MapViewer from '../components/MapViewer';

const DriverMode = () => {
  const navigate = useNavigate();
  const [routeData, setRouteData] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    // Load route from local storage
    const loadRoute = () => {
      const storedRoute = localStorage.getItem('offline_driver_route');
      if (storedRoute) {
        try {
          setRouteData(JSON.parse(storedRoute));
        } catch (e) {
          console.error("Failed to parse offline route", e);
        }
      }
    };
    
    loadRoute();

    // Listen for cross-tab local storage changes (e.g., Supervisor dispatched a replan)
    const handleStorageChange = (e) => {
      if (e.key === 'offline_driver_route' && e.newValue) {
        try {
          setRouteData(JSON.parse(e.newValue));
          setNotification('⚠️ Route updated dynamically due to real-time events!');
          setTimeout(() => setNotification(null), 10000);
        } catch (err) {}
      }
    };

    // Monitor online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!routeData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300 p-6">
        <AlertTriangle size={48} className="text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">No Active Journey</h1>
        <p className="text-center max-w-md">
          There is no route stored for offline use. Please start a journey from the Route Planner or Supervisor Console.
        </p>
        <button 
          onClick={() => navigate('/route-planner')}
          className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
        >
          Return to Planner
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-900 flex flex-col relative font-sans">
      {/* Top Navigation Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Navigation size={20} />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Driver Map</h1>
            <p className="text-slate-400 text-xs">Route {routeData.route_id.substring(0, 8)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isOffline ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
            {isOffline ? (
              <><WifiOff size={14} /> Offline Mode Active</>
            ) : (
              <><Wifi size={14} /> Online</>
            )}
          </div>
          <button 
            onClick={() => navigate(`/simulation?routeId=${routeData.route_id}&autoStart=true`)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
      
      {/* Map Container */}
      <div className="flex-1 relative z-10 bg-slate-800">
        <MapViewer 
          routeSequence={routeData.sequence} 
          stopCoordinates={routeData.stop_coordinates} 
        />
        
        {/* Offline overlay warning if offline but tile cache might be limited */}
        {isOffline && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-slate-700 text-white px-4 py-2 rounded-full text-xs font-medium shadow-xl flex items-center gap-2 z-[1000]">
            <WifiOff size={14} className="text-red-400" />
            Using downloaded offline map data
          </div>
        )}

        {/* Live Notification */}
        {notification && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-indigo-600/90 backdrop-blur border border-indigo-400 text-white px-6 py-3 rounded-lg font-bold shadow-2xl z-[1000] animate-bounce">
            {notification}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverMode;
