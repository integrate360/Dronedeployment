// frontend/src/components/DroneMarker.jsx
import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { FaPaperPlane, FaArrowUp, FaPlane } from 'react-icons/fa';
import ReactDOMServer from 'react-dom/server';

const DroneMarker = ({ position, isActive = false }) => {
  if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
    return null;
  }

  // Create a custom drone icon using available icons
  const iconHtml = ReactDOMServer.renderToString(
    <div 
      className={`drone-icon-container ${isActive ? 'active' : ''}`} 
      style={{ transform: `rotate(${position.heading || 0}deg)` }}
    >
      <FaPaperPlane color={isActive ? "#ff6b35" : "#007cbf"} size={16} />
    </div>
  );

  const droneIcon = L.divIcon({
    html: iconHtml,
    className: `drone-icon ${isActive ? 'active' : ''}`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  const altitudeFt = position.alt_feet ? position.alt_feet.toFixed(0) : 0;
  const speedMps = position.ground_speed ? position.ground_speed.toFixed(1) : 0;
  const heading = position.heading ? position.heading.toFixed(0) : 0;

  return (
    <Marker position={[position.lat, position.lng]} icon={droneIcon}>
      <Tooltip permanent direction="top" offset={[0, -10]}>
        <div className="drone-tooltip">
          <div className="tooltip-header">
            <FaPlane size={12} />
            <span>Drone Position</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Altitude:</span>
            <span className="value">{altitudeFt} ft</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Speed:</span>
            <span className="value">{speedMps} m/s</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Heading:</span>
            <span className="value">{heading}°</span>
          </div>
          {position.battery && (
            <div className="tooltip-row">
              <span className="label">Battery:</span>
              <span className="value">{position.battery}%</span>
            </div>
          )}
        </div>
      </Tooltip>
    </Marker>
  );
};

export default DroneMarker;