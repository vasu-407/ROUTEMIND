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

// MapUpdater to handle both automatic scrubbing snaps and animated fitBounds clicks
const MapUpdater = ({ positions, fitTrigger, visibleCount, depotPosition }) => {
  const map = useMap();

  // 1. Manual Animated fitBounds (View Map or Fit to Stops button)
  useEffect(() => {
    if (fitTrigger > 0) {
      if (positions.length > 0) {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 0.8 });
      } else if (depotPosition) {
        map.setView(depotPosition, 14, { animate: true });
      }
    }
  }, [fitTrigger, map]);

  // 2. Instant Scrubbing Snap (without animation to avoid jumps during dragging)
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: false });
    } else if (depotPosition) {
      map.setView(depotPosition, 14, { animate: false });
    }
  }, [positions, map, depotPosition]);

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

const getClusterIcon = (count) => createIcon(`
  <div class="flex items-center justify-center px-3 py-1 bg-purple-700 rounded-full shadow-lg border-2 border-white text-white text-xs font-bold ring-4 ring-purple-100 whitespace-nowrap">
    ${count} stops
  </div>
`, [60, 28], [30, 14]);

// Custom Final Destination Icon
const getDestinationIcon = () => createIcon(`
  <div class="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full shadow-lg border-2 border-white ring-4 ring-blue-100">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
  </div>
`);

// --- API Logic for OSRM Road routing ---
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

const MapViewer = ({ 
  routeSequence = EMPTY_ARRAY, 
  beforeSequence = EMPTY_ARRAY, 
  stopCoordinates = EMPTY_OBJECT,
  visibleCount = 9999,
  fitTrigger = 0
}) => {
  const [roadPositions, setRoadPositions] = useState([]);
  const [beforeRoadPositions, setBeforeRoadPositions] = useState([]);
  const [mapType, setMapType] = useState('map'); // 'map' or 'satellite'
  const [showOriginal, setShowOriginal] = useState(true);
  const [showProposed, setShowProposed] = useState(true);

  const isReturnToDepot = routeSequence.length > 1 && routeSequence[0] === routeSequence[routeSequence.length - 1];

  // Fetch OSRM Road Geometry only for the original FULL route coordinates, preventing API calls during slider scrubbing
  const fullRawPositions = useMemo(
    () => routeSequence.map(id => stopCoordinates[id]).filter(Boolean),
    [routeSequence, stopCoordinates]
  );
  const fullBeforePositions = useMemo(
    () => beforeSequence.map(id => stopCoordinates[id]).filter(Boolean),
    [beforeSequence, stopCoordinates]
  );

  useEffect(() => {
    if (fullRawPositions.length < 2) {
      setRoadPositions([]);
      setBeforeRoadPositions([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all([roadGeometry(fullRawPositions), roadGeometry(fullBeforePositions)])
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
  }, [fullRawPositions, fullBeforePositions]);

  // Sliced sequence based on visibleCount
  const slicedRouteSequence = useMemo(() => {
    if (routeSequence.length === 0) return EMPTY_ARRAY;
    if (visibleCount === 0) return [routeSequence[0]];
    if (visibleCount >= routeSequence.length - 1) return routeSequence;
    return routeSequence.slice(0, visibleCount + 1);
  }, [routeSequence, visibleCount]);

  const slicedBeforeSequence = useMemo(() => {
    if (beforeSequence.length === 0) return EMPTY_ARRAY;
    if (visibleCount === 0) return [beforeSequence[0]];
    if (visibleCount >= beforeSequence.length - 1) return beforeSequence;
    return beforeSequence.slice(0, visibleCount + 1);
  }, [beforeSequence, visibleCount]);

  // Display Polyline: Use OSRM road geometry for full view, straight lines during slider changes to avoid API calls
  const displayPositions = useMemo(() => {
    if (visibleCount >= routeSequence.length - 1 && roadPositions.length > 1) {
      return roadPositions;
    }
    return slicedRouteSequence.map(id => stopCoordinates[id]).filter(Boolean);
  }, [visibleCount, routeSequence, roadPositions, slicedRouteSequence, stopCoordinates]);

  const displayBeforePositions = useMemo(() => {
    if (visibleCount >= beforeSequence.length - 1 && beforeRoadPositions.length > 1) {
      return beforeRoadPositions;
    }
    return slicedBeforeSequence.map(id => stopCoordinates[id]).filter(Boolean);
  }, [visibleCount, beforeSequence, beforeRoadPositions, slicedBeforeSequence, stopCoordinates]);

  // Markers filtering and custom clustering
  const stopsToRender = useMemo(() => {
    const list = [];
    if (routeSequence.length === 0) return list;
    const depotId = routeSequence[0];
    const vehicleId = routeSequence[routeSequence.length - 1];

    if (depotId) list.push({ id: depotId, originalIndex: 0, type: 'depot' });

    routeSequence.forEach((stopId, idx) => {
      if (idx === 0 || idx === routeSequence.length - 1) return;
      if (idx <= visibleCount) {
        list.push({ id: stopId, originalIndex: idx, type: 'stop' });
      }
    });

    if (vehicleId && vehicleId !== depotId) {
      list.push({ id: vehicleId, originalIndex: routeSequence.length - 1, type: 'vehicle' });
    }

    return list;
  }, [routeSequence, visibleCount]);

  // Clustered delivery stops (purple markers only)
  const clusteredDeliveryStops = useMemo(() => {
    const deliveryStops = stopsToRender.filter(s => {
      const idx = s.originalIndex;
      const isDepot = idx === 0;
      const isLast = idx === routeSequence.length - 1;
      const isPickup = idx === 2;
      const isDelayed = idx === routeSequence.length - 2 && routeSequence.length > 3;
      return !isDepot && !isLast && !isPickup && !isDelayed;
    });

    const threshold = 0.0; // Grouping distance delta (Disabled as requested)
    const clusters = [];

    deliveryStops.forEach(item => {
      const coords = stopCoordinates[item.id];
      if (!coords) return;
      const [lat, lng] = coords;

      let found = false;
      for (const c of clusters) {
        const dist = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2));
        if (dist < threshold) {
          c.items.push(item);
          c.lat = (c.lat * (c.items.length - 1) + lat) / c.items.length;
          c.lng = (c.lng * (c.items.length - 1) + lng) / c.items.length;
          found = true;
          break;
        }
      }
      if (!found) {
        clusters.push({ lat, lng, items: [item] });
      }
    });

    return clusters;
  }, [stopsToRender, stopCoordinates, routeSequence]);

  // Non-clustered stops (depot, vehicle, pickup, delayed, final destination)
  const nonClusteredStops = useMemo(() => {
    return stopsToRender.filter(s => {
      const idx = s.originalIndex;
      const isDepot = idx === 0;
      const isLast = idx === routeSequence.length - 1;
      const isPickup = idx === 2; // Demo logic hardcodes pickup here
      const isDelayed = idx === routeSequence.length - 2 && routeSequence.length > 3;
      return isDepot || isLast || isPickup || isDelayed;
    });
  }, [stopsToRender, routeSequence]);

  const visibleCoordsForFit = useMemo(() => {
    return stopsToRender.map(s => stopCoordinates[s.id]).filter(Boolean);
  }, [stopsToRender, stopCoordinates]);

  const depotPos = routeSequence[0] ? stopCoordinates[routeSequence[0]] : null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
      
      {/* MAP CONTROLS OVERLAY (TOP RIGHT) */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="flex bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 overflow-hidden text-sm font-medium">
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
        
        {beforeSequence.length > 0 && routeSequence.length > 0 && beforeSequence.join(',') !== routeSequence.join(',') && (
          <div className="flex flex-col bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-md border border-slate-200 text-sm font-medium gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} className="rounded text-green-500 focus:ring-green-500 w-4 h-4" />
              <div className="w-3 h-1 bg-green-500"></div> Original Route
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input type="checkbox" checked={showProposed} onChange={(e) => setShowProposed(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4" />
              <div className="w-3 h-1 bg-purple-600"></div> Proposed Route
            </label>
          </div>
        )}
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
          
          <div className="flex items-center"><div className="w-4 h-1 bg-green-500 mr-3 flex-shrink-0"></div> <span className="text-slate-600 text-xs font-medium">Replanned Route</span></div>
          <div className="flex items-center"><div className="w-4 h-1 bg-red-500 mr-3 flex-shrink-0"></div> <span className="text-slate-600 text-xs font-medium">Normal Route</span></div>
        </div>
      </div>

      <MapContainer 
        center={fullRawPositions[0] || [12.9716, 77.5946]} 
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
        
        <MapUpdater 
          positions={visibleCoordsForFit} 
          fitTrigger={fitTrigger} 
          visibleCount={visibleCount} 
          depotPosition={depotPos} 
        />
        
        {/* Normal Route (original/before replanning) - Render first (below) */}
        {showOriginal && displayBeforePositions.length > 1 && (
          <Polyline 
            positions={displayBeforePositions} 
            color="#22c55e" 
            weight={4} 
            opacity={0.9} 
          />
        )}
        
        {/* Replanned / Final Route - Render second (above) */}
        {showProposed && displayPositions.length > 1 && (
          <Polyline 
            positions={displayPositions} 
            color={beforeSequence.length > 0 && beforeSequence.join(',') !== routeSequence.join(',') ? "#9333ea" : "#22c55e"} 
            weight={4} 
            opacity={0.9} 
          />
        )}
        
        {/* Non-clustered Markers */}
        {nonClusteredStops.map(s => {
          const stopId = s.id;
          const index = s.originalIndex;
          const pos = stopCoordinates[stopId];
          const isDepot = index === 0;
          const isLast = index === routeSequence.length - 1;
          const isPickup = index === 2;
          const isDelayed = index === routeSequence.length - 2 && routeSequence.length > 3;

          let icon = getDeliveryIcon(index);
          let isFinalDestination = false;
          if (isDepot) {
            icon = getDepotIcon();
            if (isLast && isReturnToDepot) isFinalDestination = true; // depot is also final
          } else if (isLast) {
            icon = getDestinationIcon();
            isFinalDestination = true;
          } else if (isPickup) icon = getPickupIcon();
          else if (isDelayed) icon = getDelayedIcon(index);

          return (
            <Marker key={`noncluster-${stopId}-${index}`} position={pos} icon={icon}>
              <Popup className="custom-popup" closeButton={false}>
                {isDepot && !isFinalDestination && (
                  <div className="text-sm">
                    <div className="font-bold text-green-600 mb-1">DEPOT / START</div>
                    <div className="text-slate-700">Sequence: <span className="font-medium">{index}</span></div>
                    <div className="text-slate-700">Stop ID: <span className="font-medium text-slate-500">{stopId}</span></div>
                    <div className="text-slate-700">Type: <span className="font-medium text-slate-500">Station</span></div>
                    <div className="text-slate-500 text-xs mt-1">Lat: {pos[0].toFixed(5)}, Lng: {pos[1].toFixed(5)}</div>
                  </div>
                )}
                {isFinalDestination && (
                  <div className="text-sm">
                    <div className="font-bold text-blue-600 mb-1">{isReturnToDepot ? "DESTINATION / RETURN TO DEPOT" : "FINAL DESTINATION"}</div>
                    <div className="text-slate-700">Sequence: <span className="font-medium">{index}</span></div>
                    <div className="text-slate-700">Stop ID: <span className="font-medium text-slate-500">{stopId}</span></div>
                    <div className="text-slate-700">Type: <span className="font-medium text-slate-500">{isReturnToDepot ? "Station" : "Dropoff"}</span></div>
                    <div className="text-slate-500 text-xs mt-1">Lat: {pos[0].toFixed(5)}, Lng: {pos[1].toFixed(5)}</div>
                  </div>
                )}
                {isPickup && (
                  <div className="text-sm">
                    <div className="text-orange-600 font-bold mb-1">NEW PICKUP — PENDING</div>
                    <div className="text-slate-700">Sequence: <span className="font-medium">{index}</span></div>
                    <div className="text-slate-700">Stop ID: <span className="font-medium text-slate-500">{stopId}</span></div>
                    <div className="text-slate-700">Type: <span className="font-medium text-slate-500">Pickup</span></div>
                    <div className="text-slate-500 text-xs mt-1">Lat: {pos[0].toFixed(5)}, Lng: {pos[1].toFixed(5)}</div>
                  </div>
                )}
                {isDelayed && (
                  <div className="text-sm">
                    <div className="text-red-600 font-bold mb-1">Delayed Segment</div>
                    <div className="text-slate-700">Sequence: <span className="font-medium">{index}</span></div>
                    <div className="text-slate-700">ID: <span className="font-medium text-slate-500">{stopId}</span></div>
                    <div className="text-slate-500 text-xs mt-1">{pos[0].toFixed(5)}, {pos[1].toFixed(5)}</div>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}

        {/* Clustered Delivery Stop Markers */}
        {clusteredDeliveryStops.map((cluster, cIdx) => {
          const isSingle = cluster.items.length === 1;
          if (isSingle) {
            const item = cluster.items[0];
            const stopId = item.id;
            const index = item.originalIndex;
            const pos = stopCoordinates[stopId];
            const icon = getDeliveryIcon(index);

            return (
              <Marker key={`single-delivery-${stopId}-${index}`} position={pos} icon={icon}>
                <Popup className="custom-popup" closeButton={false}>
                  <div className="text-sm">
                    <div className="font-bold text-slate-800 mb-1">Delivery Stop</div>
                    <div className="text-slate-700">Sequence: <span className="font-medium">{index}</span></div>
                    <div className="text-slate-700">Stop ID: <span className="font-medium text-slate-500">{stopId}</span></div>
                    <div className="text-slate-700">Type: <span className="font-medium text-slate-500">Dropoff</span></div>
                    <div className="text-slate-500 text-xs mt-1">Lat: {pos[0].toFixed(5)}, Lng: {pos[1].toFixed(5)}</div>
                  </div>
                </Popup>
              </Marker>
            );
          } else {
            const count = cluster.items.length;
            const icon = getClusterIcon(count);
            return (
              <Marker key={`cluster-${cIdx}-${count}`} position={[cluster.lat, cluster.lng]} icon={icon}>
                <Popup className="custom-popup" closeButton={false}>
                  <div className="font-bold text-indigo-800 text-sm mb-2">Cluster of {count} Stops</div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-slate-600 pr-1">
                    {cluster.items.map(item => (
                      <div key={item.id} className="flex justify-between border-b border-slate-100 pb-0.5">
                        <span className="font-medium text-slate-800">Stop {item.originalIndex}:</span>
                        <span>{item.id.substring(0, 10)}...</span>
                      </div>
                    ))}
                  </div>
                </Popup>
              </Marker>
            );
          }
        })}
      </MapContainer>
    </div>
  );
};

export default MapViewer;
