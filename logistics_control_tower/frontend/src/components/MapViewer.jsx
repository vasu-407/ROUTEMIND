import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Layers, Map as MapIcon, Navigation } from 'lucide-react';

// Fix for default marker icons if we ever fallback
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapUpdater = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [60, 60] });
    }
  }, [positions, map]);
  return null;
};

// -- Custom Icons using L.divIcon & Tailwind classes --
const createIcon = (htmlContent, size = [32, 32], anchor = [16, 16], className = '') => {
  return new L.divIcon({
    className: `bg-transparent border-none ${className}`,
    html: htmlContent,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1]],
  });
};

// SVG Helpers
const svgDepot = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
const svgPickup = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
const svgVehicle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect width="18" height="14" x="3" y="5" rx="2"></rect><path d="M7 15h4M15 15h2M7 9h10"></path></svg>`; 

const getDepotIcon = () => createIcon(`
  <div class="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full shadow-lg border-2 border-white ring-4 ring-green-100">
    ${svgDepot}
  </div>
`);

const getDeliveryIcon = (num) => createIcon(`
  <div class="flex items-center justify-center w-7 h-7 bg-purple-600 rounded-full shadow-md border-2 border-white text-white text-[11px] font-bold">
    ${num}
  </div>
`);

const getPickupIcon = () => createIcon(`
  <div class="flex items-center justify-center w-7 h-7 bg-orange-500 rounded-full shadow-md border-2 border-white ring-4 ring-orange-100">
    ${svgPickup}
  </div>
`);

const getDelayedIcon = (num) => createIcon(`
  <div class="flex items-center justify-center w-7 h-7 bg-red-600 rounded-full shadow-md border-2 border-white text-white text-[11px] font-bold ring-4 ring-red-100">
    ${num}
  </div>
`);

const getVehicleIcon = () => createIcon(`
  <div class="flex items-center justify-center w-9 h-9 bg-purple-600 rounded-full shadow-lg border-2 border-white ring-4 ring-purple-200">
    ${svgVehicle}
  </div>
`, [36, 36], [18, 18]);

// --- API Logic from existing ---
const splitWaypoints = (positions, size = 25) => {
  const chunks = [];
  for (let start = 0; start < positions.length - 1; start += size - 1) {
    chunks.push(positions.slice(start, Math.min(start + size, positions.length)));
  }
  return chunks;
};

const roadGeometry = async (positions) => {
  if (positions.length < 2) return [];
  const parts = await Promise.all(splitWaypoints(positions).map(async chunk => {
    const coordinates = chunk.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`);
    if (!response.ok) throw new Error('Road routing unavailable');
    const data = await response.json();
    return data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];
  }));
  return parts.flatMap((part, index) => index ? part.slice(1) : part);
};

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const MapViewer = ({ routeSequence = EMPTY_ARRAY, beforeSequence = EMPTY_ARRAY, stopCoordinates = EMPTY_OBJECT }) => {
  const [roadPositions, setRoadPositions] = useState([]);
  const [beforeRoadPositions, setBeforeRoadPositions] = useState([]);
  const [mapType, setMapType] = useState('map'); // 'map' or 'satellite'

  const rawPositions = useMemo(
    () => routeSequence.map(id => stopCoordinates[id]).filter(Boolean),
    [routeSequence, stopCoordinates]
  );
  const beforePositions = useMemo(
    () => beforeSequence.map(id => stopCoordinates[id]).filter(Boolean),
    [beforeSequence, stopCoordinates]
  );

  useEffect(() => {
    if (rawPositions.length < 2) {
      setRoadPositions([]);
      setBeforeRoadPositions([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all([roadGeometry(rawPositions), roadGeometry(beforePositions)])
      .then(([orToolsRoad, greedyRoad]) => {
        if (!cancelled) {
          setRoadPositions(orToolsRoad);
          setBeforeRoadPositions(greedyRoad);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoadPositions([]);
          setBeforeRoadPositions([]);
        }
      });
    return () => { cancelled = true; };
  }, [rawPositions, beforePositions]);

  const displayPositions = roadPositions.length > 1 ? roadPositions : rawPositions;
  const displayBeforePositions = beforeRoadPositions.length > 1 ? beforeRoadPositions : beforePositions;

  // Render Map Overlay components inside the relative container
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
      
      {/* MAP CONTROLS OVERLAY (TOP RIGHT) */}
      <div className="absolute top-4 right-4 z-[1000] flex bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 overflow-hidden text-sm font-medium">
        <button 
          onClick={() => setMapType('map')} 
          className={`px-4 py-2 flex items-center transition-colors ${mapType === 'map' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <MapIcon size={14} className="mr-2" /> Map
        </button>
        <div className="w-px bg-slate-200"></div>
        <button 
          onClick={() => setMapType('satellite')} 
          className={`px-4 py-2 flex items-center transition-colors ${mapType === 'satellite' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Layers size={14} className="mr-2" /> Satellite
        </button>
      </div>

      {/* LEGEND OVERLAY (TOP LEFT) */}
      <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-md border border-slate-200 text-sm w-52">
        <div className="space-y-3">
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-green-500 mr-3 border-2 border-white ring-2 ring-green-100 flex-shrink-0"></div> <span className="font-medium text-slate-700">Depot</span></div>
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-purple-600 mr-3 border-2 border-white flex-shrink-0"></div> <span className="font-medium text-slate-700">Delivery Stop</span></div>
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-orange-500 mr-3 border-2 border-white ring-2 ring-orange-100 flex-shrink-0"></div> <span className="font-medium text-slate-700">Pickup Stop</span></div>
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-red-600 mr-3 border-2 border-white ring-2 ring-red-100 flex-shrink-0"></div> <span className="font-medium text-slate-700">Delayed Stop</span></div>
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-purple-600 mr-3 flex flex-shrink-0 items-center justify-center text-white"><Navigation size={10} className="transform rotate-45"/></div> <span className="font-medium text-slate-700">Current Vehicle</span></div>
          
          <div className="w-full h-px bg-slate-200 my-2"></div>
          
          <div className="flex items-center"><div className="w-4 h-1 border-t-2 border-dashed border-purple-400 mr-3 flex-shrink-0"></div> <span className="text-slate-600 text-xs font-medium">Replanned Segment</span></div>
          <div className="flex items-center"><div className="w-4 h-1 bg-purple-600 mr-3 flex-shrink-0"></div> <span className="text-slate-600 text-xs font-medium">Original Route</span></div>
        </div>
      </div>

      <MapContainer 
        center={rawPositions[0] || [12.9716, 77.5946]} 
        zoom={12} 
        zoomControl={false} 
        scrollWheelZoom 
        className="h-full w-full z-0"
      >
        {mapType === 'map' ? (
          <TileLayer 
            attribution="&copy; OpenStreetMap contributors" 
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
          />
        ) : (
          <TileLayer 
            attribution="Esri World Imagery" 
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
          />
        )}
        
        {displayPositions.length > 1 && <MapUpdater positions={[...displayPositions, ...displayBeforePositions]} />}
        
        {/* Replanned route (dashed) */}
        {displayBeforePositions.length > 1 && (
          <Polyline 
            positions={displayBeforePositions} 
            color="#a855f7" 
            weight={3} 
            dashArray="6, 8" 
            opacity={0.8}
          />
        )}
        
        {/* Original Route (solid) */}
        {displayPositions.length > 1 && (
          <Polyline 
            positions={displayPositions} 
            color="#7e22ce" 
            weight={4} 
            opacity={0.9} 
          />
        )}
        
        {/* Markers Generation */}
        {routeSequence.map((stopId, index) => {
          if (!stopCoordinates[stopId]) return null;
          const pos = stopCoordinates[stopId];
          const isDepot = index === 0;
          const isLast = index === routeSequence.length - 1;
          const isPickup = index === 2; // Mocking a pickup for visual effect
          const isDelayed = index === routeSequence.length - 2 && routeSequence.length > 3; // Mocking delayed
          
          let icon = getDeliveryIcon(index);
          if (isDepot) icon = getDepotIcon();
          else if (isLast) icon = getVehicleIcon();
          else if (isPickup) icon = getPickupIcon();
          else if (isDelayed) icon = getDelayedIcon(index);

          return (
            <Marker key={`${stopId}-${index}`} position={pos} icon={icon}>
              <Popup className="custom-popup" closeButton={false}>
                {isDepot && (
                  <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Depot DLA7
                  </div>
                )}
                {isPickup && (
                  <div className="text-sm font-medium">
                    <div className="text-orange-600 font-bold mb-1">New Pickup</div>
                    <div className="text-slate-600">10:45 AM</div>
                  </div>
                )}
                {isDelayed && (
                  <div className="text-sm font-medium">
                    <div className="text-red-600 font-bold mb-1">Delayed Stop</div>
                    <div className="text-slate-600">Est. 45m late</div>
                  </div>
                )}
                {isLast && (
                  <div className="text-sm font-medium">
                    <div className="text-purple-700 font-bold mb-1">Vehicle KA-01-AB-1234</div>
                    <div className="text-slate-600">Speed: 32 km/h</div>
                  </div>
                )}
                {!isDepot && !isPickup && !isDelayed && !isLast && (
                  <div className="font-semibold text-slate-700 text-sm">Stop {index}: {stopId}</div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapViewer;
