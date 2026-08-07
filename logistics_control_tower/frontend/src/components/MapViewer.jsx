import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const depotIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper to update map bounds when sequence changes
const MapUpdater = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
};

const MapViewer = ({ routeSequence = [], stopCoordinates = {} }) => {
  // Default to Bangalore if no data
  const center = [12.9716, 77.5946];
  
  // Get positions only for stops that exist in stopCoordinates
  const polylinePositions = routeSequence
    .map(id => stopCoordinates[id])
    .filter(pos => pos !== undefined);

  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-lg border border-gray-200 z-0">
      <MapContainer center={center} zoom={12} scrollWheelZoom={true} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {polylinePositions.length > 0 && <MapUpdater positions={polylinePositions} />}
        
        {routeSequence.length > 0 && stopCoordinates[routeSequence[0]] && (
          <Marker position={stopCoordinates[routeSequence[0]]} icon={depotIcon}>
            <Popup>Depot: {routeSequence[0]}</Popup>
          </Marker>
        )}
        
        {routeSequence.slice(1, -1).map((stopId, idx) => {
          if (!stopCoordinates[stopId]) return null;
          return (
            <Marker key={`${stopId}-${idx}`} position={stopCoordinates[stopId]}>
              <Popup>Stop: {stopId}</Popup>
            </Marker>
          );
        })}

        {polylinePositions.length > 0 && (
          <Polyline positions={polylinePositions} color="#146eb4" weight={4} opacity={0.8} />
        )}
      </MapContainer>
    </div>
  );
};

export default MapViewer;
