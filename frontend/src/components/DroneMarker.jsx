// frontend/src/components/DroneMarker.jsx
import React, { forwardRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';

const DroneMarker = forwardRef(({ position, isActive = false }, ref) => {
  if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
    return null;
  }

  const iconHtml = ReactDOMServer.renderToString(
    <div 
      className={`drone-icon-container ${isActive ? 'active' : ''}`}
      style={{ '--drone-heading': `${position.heading || 0}deg` }}
    >
      <div className="drone-icon-inner">🚁</div>
    </div>
  );

  const droneIcon = L.divIcon({
    html: iconHtml,
    className: `drone-icon ${isActive ? 'active' : ''}`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <Marker
      ref={ref}
      position={[position.lat, position.lng]}
      icon={droneIcon}
      zIndexOffset={1000}
    >
      <Tooltip permanent direction="top" offset={[0, -20]}>
        <div className="drone-tooltip">
          <div className="tooltip-header">
            <span>🚁 Drone Position</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Altitude:</span>
            <span className="value">{position.alt_feet ? position.alt_feet.toFixed(0) : 0} ft</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Speed:</span>
            <span className="value">{position.ground_speed ? position.ground_speed.toFixed(1) : 0} m/s</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Heading:</span>
            <span className="value">{position.heading ? position.heading.toFixed(0) : 0}°</span>
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
});

export default DroneMarker;