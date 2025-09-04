// frontend/src/components/DroneMarker.jsx
import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { FaArrowUp } from 'react-icons/fa';
import ReactDOMServer from 'react-dom/server';

const DroneMarker = ({ position }) => {
  if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
    return null;
  }

  // Create a custom icon with rotation
  const iconHtml = ReactDOMServer.renderToString(
    <div className="drone-icon-container" style={{ transform: `rotate(${position.heading || 0}deg)` }}>
      <FaArrowUp color="#fff" size={14} />
    </div>
  );

  const droneIcon = L.divIcon({
    html: iconHtml,
    className: 'drone-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <Marker position={[position.lat, position.lng]} icon={droneIcon}>
      <Tooltip permanent>
        Altitude: {position.alt ? position.alt.toFixed(0) : 0} m
      </Tooltip>
    </Marker>
  );
};

export default DroneMarker;
