// frontend/src/components/InteractiveMap.jsx
import React, { useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  LayersControl,
  useMapEvents,
  CircleMarker,
} from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import FlightGrid from './FlightGrid';

const InteractiveMap = ({
  project,
  vertices,
  isDrawing,
  flightAngle,
  onVerticesChange,
  onDrawingChange,
  onInteraction,
  whenCreated, // MODIFICATION: Add whenCreated prop
}) => {

  // --- Map Interaction Logic ---

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!isDrawing) return;
        const newVertex = [e.latlng.lat, e.latlng.lng];
        
        if (vertices.length > 2 && e.originalEvent.target.classList.contains('vertex-point-start')) {
            onDrawingChange(false);
        } else {
            onVerticesChange([...vertices, newVertex]);
            onInteraction();
        }
      },
    });
    return null;
  };

  const handleVertexDrag = (e, index) => {
    const newLatLng = e.target.getLatLng();
    const newVertices = [...vertices];
    newVertices[index] = [newLatLng.lat, newLatLng.lng];
    onVerticesChange(newVertices);
    onInteraction();
  };

  const handleEdgeClick = (e) => {
    if (isDrawing || vertices.length < 2) return;
    L.DomEvent.stopPropagation(e);
    const clickedPoint = [e.latlng.lat, e.latlng.lng];
    let closestSegmentIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        const segment = turf.lineString([[p1[1], p1[0]], [p2[1], p2[0]]]);
        const point = turf.point([clickedPoint[1], clickedPoint[0]]);
        const distance = turf.pointToLineDistance(point, segment, { units: 'meters' });
        if (distance < minDistance) {
            minDistance = distance;
            closestSegmentIndex = i;
        }
    }

    if (closestSegmentIndex !== -1) {
        const newVertices = [...vertices];
        newVertices.splice(closestSegmentIndex + 1, 0, clickedPoint);
        onVerticesChange(newVertices);
        onInteraction();
    }
  };

  const mapCenter = useMemo(() => {
    return vertices.length > 0
      ? L.latLngBounds(vertices).getCenter()
      : [project.latitude, project.longitude];
  }, [vertices, project]);
  
  return (
    <div className="map-container" style={{ cursor: isDrawing ? 'crosshair' : 'grab' }}>
      <MapContainer
        center={mapCenter}
        zoom={16}
        scrollWheelZoom={true}
        className="leaflet-map-container"
        whenCreated={whenCreated} // MODIFICATION: Pass prop to MapContainer
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Standard Map">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="Satellite & Labels">
            <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" subdomains={["mt0", "mt1", "mt2", "mt3"]} attribution="&copy; Google Maps" />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        <MapEvents />
        
        <FlightGrid vertices={vertices} angle={flightAngle} />

        {vertices.length > 1 && (
            <Polyline 
              positions={[...vertices, vertices[0]]} 
              pathOptions={{ color: '#007cbf', weight: 5, opacity: 0.8 }}
              eventHandlers={{
                  click: (e) => handleEdgeClick(e),
              }}
            />
        )}
        
        {vertices.map((position, index) => (
            <CircleMarker
                key={`main-${index}`}
                center={position}
                draggable={!isDrawing}
                eventHandlers={{ 
                    drag: (e) => handleVertexDrag(e, index),
                }}
                radius={6}
                pathOptions={{ color: '#007cbf', fillColor: '#fff', weight: 2, fillOpacity: 1 }}
                className={index === 0 ? 'vertex-point-start draggable-vertex' : 'draggable-vertex'}
            />
        ))}

        {project && (
          <Marker position={[project.latitude, project.longitude]}>
            <Tooltip permanent direction="right" offset={[10, 0]}>
              <strong>{project.name}</strong>
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default InteractiveMap;