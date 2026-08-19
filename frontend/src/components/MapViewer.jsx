import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Layers, Map as MapIcon, Navigation, Play, Pause, RotateCcw, Zap, Maximize, Maximize2 } from 'lucide-react';

// Fix for default marker icons if we ever fallback
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// MapUpdater to handle both automatic scrubbing snaps and animated fitBounds clicks
const MapUpdater = ({ positions, fitTrigger, depotPosition }) => {
  const map = useMap();

  useEffect(() => {
    if (fitTrigger > 0) {
      if (positions.length > 0) {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 0.8 });
      } else if (depotPosition) {
        map.setView(depotPosition, 14, { animate: true });
      }
    }
  }, [fitTrigger, map, positions, depotPosition]);

  return null;
};

// Map View Control Actions Component (Fit Route, Focus Vehicle, Fullscreen)
const MapViewControlBar = ({ currentVanPos, positions, containerRef }) => {
  const map = useMap();

  const handleFitRoute = () => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
    }
  };

  const handleCenterVehicle = () => {
    if (currentVanPos) {
      map.setView(currentVanPos, 15, { animate: true });
    }
  };

  const handleToggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="flex bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-lg border border-slate-200 text-xs font-bold gap-1">
      <button
        onClick={handleFitRoute}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
        title="View full map and fit all stops"
      >
        <Maximize2 size={13} /> View Map
      </button>
      {currentVanPos && (
        <button
          onClick={handleCenterVehicle}
          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          title="Center map on live moving vehicle"
        >
          <Navigation size={13} className="transform rotate-45" /> Vehicle
        </button>
      )}
      <button
        onClick={handleToggleFullscreen}
        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
        title="Expand map to fullscreen"
      >
        <Maximize size={13} /> Fullscreen
      </button>
    </div>
  );
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

const getDeliveryIcon = (label) => createIcon(`
  <div class="flex items-center justify-center min-w-[28px] h-7 px-1.5 bg-purple-600 rounded-full shadow-md border-2 border-white text-white text-[11px] font-bold">
    ${label}
  </div>
`, [32, 28], [16, 14]);

const getDeliveredIcon = (label) => createIcon(`
  <div class="flex items-center justify-center min-w-[28px] h-7 px-1.5 bg-emerald-500 rounded-full shadow-md border-2 border-white text-white text-[11px] font-black ring-4 ring-emerald-100">
    <span class="text-[10px] mr-0.5 font-black">✓</span>${label}
  </div>
`, [32, 28], [16, 14]);

const getPickupIcon = (label = '') => createIcon(`
  <div class="relative flex flex-col items-center justify-center">
    <div class="absolute -top-7 bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xl border border-white whitespace-nowrap animate-bounce uppercase tracking-wide flex items-center gap-1 z-20">
      <span class="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
      NEW PICKUP ${label ? '(' + label + ')' : ''}
    </div>
    <div class="absolute w-12 h-12 bg-amber-400/40 rounded-full animate-ping z-0"></div>
    <div class="flex items-center justify-center w-8 h-8 bg-amber-500 rounded-full shadow-xl border-2 border-white ring-4 ring-amber-200 z-10">
      ${svgPickup}
    </div>
  </div>
`, [44, 52], [22, 38]);

const getDelayedIcon = (label) => createIcon(`
  <div class="flex items-center justify-center min-w-[28px] h-7 px-1.5 bg-red-600 rounded-full shadow-md border-2 border-white text-white text-[11px] font-bold ring-4 ring-red-100">
    ${label}
  </div>
`, [32, 28], [16, 14]);

const getMovingVanIcon = (statusText = "VAN EN ROUTE") => createIcon(`
  <div class="relative flex flex-col items-center justify-center">
    <div class="absolute -top-7 bg-indigo-700 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-2xl border border-white whitespace-nowrap animate-pulse flex items-center gap-1.5 z-30">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      🚚 ${statusText}
    </div>
    <div class="absolute w-12 h-12 bg-indigo-500/40 rounded-full animate-ping z-0"></div>
    <div class="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-full shadow-2xl border-2 border-white ring-4 ring-indigo-200 z-10 text-white">
      ${svgVehicle}
    </div>
  </div>
`, [48, 54], [24, 27]);

const getClusterIcon = (count) => createIcon(`
  <div class="flex items-center justify-center px-3 py-1 bg-purple-700 rounded-full shadow-lg border-2 border-white text-white text-xs font-bold ring-4 ring-purple-100 whitespace-nowrap">
    ${count} stops
  </div>
`, [60, 28], [30, 14]);

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
  fitTrigger = 0,
  approvalStatus = null,
  // Callbacks so parent can read live simulation state
  onVehiclePositionChange = null,
  onDeliveredStopsChange = null,
}) => {
  const containerRef = useRef(null);
  const [roadPositions, setRoadPositions] = useState([]);
  const [beforeRoadPositions, setBeforeRoadPositions] = useState([]);
  const [mapType, setMapType] = useState('map');
  const [showOriginal, setShowOriginal] = useState(true);
  const [showProposed, setShowProposed] = useState(true);

  const isReturnToDepot = routeSequence.length > 1 && routeSequence[0] === routeSequence[routeSequence.length - 1];

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

  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const lastVanPosRef = useRef(null);

  const isWaitingApproval = approvalStatus === 'pending' || approvalStatus === 'pending_approval';

  useEffect(() => {
    if (lastVanPosRef.current && displayPositions.length > 0) {
      const [lastLat, lastLng] = lastVanPosRef.current;
      let minDistance = Infinity;
      let closestIdx = 0;
      displayPositions.forEach((pos, idx) => {
        if (!pos) return;
        const dist = Math.hypot(pos[0] - lastLat, pos[1] - lastLng);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });
      setCurrentPathIndex(closestIdx);
    }
  }, [routeSequence, displayPositions]);

  useEffect(() => {
    if (!isPlaying || isWaitingApproval || displayPositions.length < 2) return;
    const stepMs = Math.max(120, Math.floor(700 / speedMultiplier));
    const timer = setInterval(() => {
      setCurrentPathIndex((prev) => (prev >= displayPositions.length - 1 ? 0 : prev + 1));
    }, stepMs);
    return () => clearInterval(timer);
  }, [isPlaying, isWaitingApproval, speedMultiplier, displayPositions]);

  const currentVanPos = useMemo(() => {
    if (displayPositions.length === 0) return null;
    return displayPositions[Math.min(currentPathIndex, displayPositions.length - 1)];
  }, [displayPositions, currentPathIndex]);

  useEffect(() => {
    if (currentVanPos) {
      lastVanPosRef.current = currentVanPos;
      if (onVehiclePositionChange) onVehiclePositionChange(currentVanPos);
    }
  }, [currentVanPos, onVehiclePositionChange]);

  // ── Authoritative Delivery State & Transition ──────────────────────────
  const [deliveredStopsMap, setDeliveredStopsMap] = useState({});

  // Authoritative delivery transition function
  const markStopDelivered = useCallback((stopId, currentPos, targetPos, distanceKm) => {
    if (!stopId) return;
    setDeliveredStopsMap(prev => {
      if (prev[stopId]) return prev;
      console.log(
        `%c[DELIVERY EVENT] Stop ID: ${stopId} | Status: DELIVERED | Vehicle Pos: [${currentPos[0].toFixed(4)}, ${currentPos[1].toFixed(4)}] | Stop Pos: [${targetPos[0].toFixed(4)}, ${targetPos[1].toFixed(4)}] | Distance: ${distanceKm.toFixed(3)} km | Reason: PHYSICAL ARRIVAL`,
        "color: #10b981; font-weight: bold; background: #ecfdf5; border: 1px solid #10b981; padding: 4px 8px; border-radius: 4px;"
      );
      return { ...prev, [stopId]: true };
    });
  }, []);

  // Active target stop is the FIRST un-delivered stop in the active route sequence
  const currentTargetStopId = useMemo(() => {
    return routeSequence.find((stopId, idx) => idx > 0 && !deliveredStopsMap[stopId]);
  }, [routeSequence, deliveredStopsMap]);

  useEffect(() => {
    if (currentPathIndex === 0) {
      const initialMap = {};
      if (routeSequence.length > 0) {
        initialMap[routeSequence[0]] = true;
      }
      setDeliveredStopsMap(initialMap);
    }
  }, [routeSequence, currentPathIndex === 0]);

  // Physical arrival check strictly for currentTargetStopId when van is moving (currentPathIndex > 0)
  useEffect(() => {
    if (!currentVanPos || !currentTargetStopId || currentPathIndex === 0) return;

    const targetCoords = stopCoordinates[currentTargetStopId];
    if (!targetCoords) return;

    const dLat = currentVanPos[0] - targetCoords[0];
    const dLng = currentVanPos[1] - targetCoords[1];
    const distSq = dLat * dLat + dLng * dLng;

    // Physical arrival threshold: ~80 meters (distSq <= 0.000001)
    if (distSq <= 0.000001) {
      const distKm = Math.sqrt(distSq) * 111.0;
      markStopDelivered(currentTargetStopId, currentVanPos, targetCoords, distKm);
    }
  }, [currentVanPos, currentTargetStopId, currentPathIndex, stopCoordinates, markStopDelivered]);

  // Notify parent whenever delivered stops change so it can build accurate replan payloads
  useEffect(() => {
    if (onDeliveredStopsChange) onDeliveredStopsChange(deliveredStopsMap);
  }, [deliveredStopsMap, onDeliveredStopsChange]);

  const formattedDestLabel = useMemo(() => {
    if (!currentTargetStopId) return "FINAL DESTINATION";
    return currentTargetStopId.toLowerCase().startsWith('stop') ? currentTargetStopId.replace('_', ' ').toUpperCase() : currentTargetStopId;
  }, [currentTargetStopId]);

  const stopsToRender = useMemo(() => {
    const list = [];
    if (routeSequence.length === 0) return list;
    const depotId = routeSequence[0];
    const vehicleId = routeSequence[routeSequence.length - 1];
    if (depotId) list.push({ id: depotId, originalIndex: 0, type: 'depot' });
    routeSequence.forEach((stopId, idx) => {
      if (idx === 0 || idx === routeSequence.length - 1) return;
      if (idx <= visibleCount) list.push({ id: stopId, originalIndex: idx, type: 'stop' });
    });
    if (vehicleId && vehicleId !== depotId) list.push({ id: vehicleId, originalIndex: routeSequence.length - 1, type: 'vehicle' });
    return list;
  }, [routeSequence, visibleCount]);

  const clusteredDeliveryStops = useMemo(() => {
    const deliveryStops = stopsToRender.filter(s => {
      const idx = s.originalIndex;
      const isDepot = idx === 0;
      const isLast = idx === routeSequence.length - 1;
      const isPickup = s.id.toLowerCase().includes('pickup') || s.type === 'Pickup';
      const isDelayed = idx === routeSequence.length - 2 && routeSequence.length > 3;
      return !isDepot && !isLast && !isPickup && !isDelayed;
    });
    const clusters = [];
    deliveryStops.forEach(item => {
      const coords = stopCoordinates[item.id];
      if (!coords) return;
      const [lat, lng] = coords;
      let found = false;
      for (const c of clusters) {
        if (Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2)) < 0.0) {
          c.items.push(item);
          found = true;
          break;
        }
      }
      if (!found) clusters.push({ lat, lng, items: [item] });
    });
    return clusters;
  }, [stopsToRender, stopCoordinates, routeSequence]);

  const nonClusteredStops = useMemo(() => {
    return stopsToRender.filter(s => {
      const idx = s.originalIndex;
      const isDepot = idx === 0;
      const isLast = idx === routeSequence.length - 1;
      const isPickup = s.id.toLowerCase().includes('pickup') || s.type === 'Pickup';
      const isDelayed = idx === routeSequence.length - 2 && routeSequence.length > 3;
      return isDepot || isLast || isPickup || isDelayed;
    });
  }, [stopsToRender, routeSequence]);

  const visibleCoordsForFit = useMemo(() => stopsToRender.map(s => stopCoordinates[s.id]).filter(Boolean), [stopsToRender, stopCoordinates]);
  const depotPos = routeSequence[0] ? stopCoordinates[routeSequence[0]] : null;
  const hasReplanned = beforeSequence.length > 0 && beforeSequence.join(',') !== routeSequence.join(',');

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end">
        <div className="flex bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-200 text-xs font-semibold">
          <button onClick={() => setMapType('map')} className={`px-3 py-1.5 flex items-center transition-colors rounded-lg ${mapType === 'map' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <MapIcon size={13} className="mr-1" /> Map
          </button>
          <button onClick={() => setMapType('satellite')} className={`px-3 py-1.5 flex items-center transition-colors rounded-lg ${mapType === 'satellite' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Layers size={13} className="mr-1" /> Satellite
          </button>
        </div>
        {hasReplanned && (
          <div className="flex flex-col bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-md border border-slate-200 text-xs font-semibold gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} className="rounded text-black focus:ring-slate-800 w-4 h-4" />
              <div className="w-3 h-1 bg-black"></div> Original Planned Route
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input type="checkbox" checked={showProposed} onChange={(e) => setShowProposed(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
              <div className="w-3 h-1 bg-emerald-500"></div> Re-planned Route (Green)
            </label>
          </div>
        )}
      </div>

      <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-md border border-slate-200 text-sm w-60">
        <div className="space-y-2">
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-green-500 mr-3 border-2 border-white ring-2 ring-green-100 flex-shrink-0"></div> <span className="font-medium text-slate-700">Depot Station</span></div>
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-emerald-500 mr-3 border-2 border-white ring-2 ring-emerald-100 flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white">✓</div> <span className="font-semibold text-emerald-700">Delivered Stop</span></div>
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-purple-600 mr-3 border-2 border-white flex-shrink-0"></div> <span className="font-medium text-slate-700">Pending Delivery Stop</span></div>
          <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-orange-500 mr-3 border-2 border-white ring-2 ring-orange-100 flex-shrink-0"></div> <span className="font-medium text-slate-700">New Pickup Stop</span></div>
          <div className="w-full h-px bg-slate-200 my-2"></div>
          <div className="flex items-center"><div className="w-4 h-1 bg-black mr-3 flex-shrink-0"></div> <span className="text-slate-700 text-xs font-semibold">Original Route (Black)</span></div>
          <div className="flex items-center"><div className="w-4 h-1 bg-emerald-500 mr-3 flex-shrink-0"></div> <span className="text-emerald-700 text-xs font-bold">Proposed / Approved Route (Green)</span></div>
        </div>
      </div>

      <MapContainer center={fullRawPositions[0] || [12.9716, 77.5946]} zoom={12} zoomControl={false} scrollWheelZoom className="h-full w-full z-0">
        {mapType === 'map' ? (
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        ) : (
          <TileLayer attribution="Esri World Imagery" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        )}
        <MapUpdater positions={visibleCoordsForFit} fitTrigger={fitTrigger} depotPosition={depotPos} />
        <MapViewControlBar currentVanPos={currentVanPos} positions={visibleCoordsForFit} containerRef={containerRef} />
        
        {showOriginal && (hasReplanned ? displayBeforePositions : displayPositions).length > 1 && (
          <Polyline positions={hasReplanned ? displayBeforePositions : displayPositions} color="#000000" weight={4} opacity={0.85} />
        )}
        {hasReplanned && showProposed && displayPositions.length > 1 && (
          <Polyline positions={displayPositions} color="#16a34a" weight={5} dashArray={isWaitingApproval ? "8, 8" : undefined} opacity={0.95} />
        )}
        
        {/* Render all route sequence stops in exact numerical travel order */}
        {routeSequence.map((stopId, index) => {
          const pos = stopCoordinates[stopId];
          if (!pos) return null;

          const isDepot = index === 0;
          const isLast = index === routeSequence.length - 1;
          const isPickup = stopId.toLowerCase().includes('pickup');
          const isDelivered = Boolean(deliveredStopsMap[stopId]);

          let icon;
          if (isDepot) {
            icon = getDepotIcon();
          } else if (isLast && !isReturnToDepot) {
            icon = getDestinationIcon();
          } else if (isPickup) {
            icon = getPickupIcon(`Stop #${index}`);
          } else if (isDelivered) {
            icon = getDeliveredIcon(index);
          } else {
            icon = getDeliveryIcon(index);
          }

          return (
            <Marker key={`stop-${stopId}-${index}`} position={pos} icon={icon}>
              {isPickup && (
                <Tooltip permanent direction="top" offset={[0, -35]} className="font-bold text-xs bg-amber-500 text-slate-950 border border-white shadow-lg rounded-full px-2.5 py-0.5">
                  📍 NEW PICKUP (Stop #{index})
                </Tooltip>
              )}
              <Popup className="custom-popup" closeButton={false}>
                <div className="text-sm p-1">
                  <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1">
                    {isDepot ? "DEPOT / STARTING STATION" : isPickup ? "NEW PICKUP LOCATION" : `STOP #${index}`}
                  </div>
                  <div className="text-slate-600">Stop ID: <strong className="text-slate-800">{stopId}</strong></div>
                  <div className="text-slate-600">Sequence Position: <strong className="text-slate-800">Stop #{index} of {routeSequence.length - 1}</strong></div>
                  <div className="text-slate-600">Status: {isDelivered ? <strong className="text-emerald-600">✓ Completed (Delivered)</strong> : <span className="text-purple-600 font-semibold">Pending Delivery</span>}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {currentVanPos && (
          <Marker position={currentVanPos} icon={getMovingVanIcon(isWaitingApproval ? "PAUSED" : `EN ROUTE TO ${formattedDestLabel}`)}>
            <Popup className="custom-popup" closeButton={false}>
              <div className="text-sm p-1">
                <div className="font-bold text-indigo-600">🚚 ROUTEMIND VEHICLE</div>
                <div>{isWaitingApproval ? "PAUSED - Awaiting Approval" : `En Route to ${formattedDestLabel}`}</div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-950/90 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-4 text-xs font-semibold">
        <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer" title={isPlaying ? "Pause Simulation" : "Play Simulation"}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={() => setCurrentPathIndex(0)} className="p-2 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors cursor-pointer" title="Reset Route">
          <RotateCcw size={14} />
        </button>
        
        {/* Speed Adjuster */}
        <div className="flex items-center gap-1 px-3 border-r border-l border-slate-800">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1">Speed:</span>
          {[1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => setSpeedMultiplier(s)}
              className={`px-2 py-0.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${speedMultiplier === s ? 'bg-amber-500 text-slate-950 shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="pl-1">
          {isWaitingApproval ? <span className="text-amber-300">Vehicle Paused — Waiting for Supervisor Approval</span> : <span className="text-slate-200">En Route to <strong className="text-emerald-400">{formattedDestLabel}</strong></span>}
        </div>
      </div>
    </div>
  );
};

export default MapViewer;
