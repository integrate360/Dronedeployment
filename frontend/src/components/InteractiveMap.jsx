// frontend/src/components/InteractiveMap.jsx
import React, { useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  LayersControl,
  CircleMarker,
} from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { toast } from 'react-toastify';

import FlightGrid from './FlightGrid';
import PolygonHandles from './PolygonHandles';

const InteractiveMap = ({
  project,
  vertices,
  flightAngle,
  onVerticesChange,
  onInteraction,
  onFlightAngleChange, // This prop seems unused but kept for interface consistency
  whenCreated,
}) => {
  const mapRef = useRef(null);

  const handleDragStart = () => mapRef.current?.dragging.disable();
  const handleDragEnd = () => mapRef.current?.dragging.enable();

  // --- CLICK EDGE TO ADD VERTEX ---
  const handleEdgeClick = (e) => {
    L.DomEvent.stopPropagation(e); // Prevent map click event
    
    // Create a GeoJSON line from the vertices to use with Turf.js
    const polygonLine = turf.lineString([...vertices.map(v => [v[1], v[0]]), [vertices[0][1], vertices[0][0]]]);
    const clickedPoint = turf.point([e.latlng.lng, e.latlng.lat]);
    
    // Find the nearest point on the line and its index
    const snapped = turf.nearestPointOnLine(polygonLine, clickedPoint);
    const newVertex = [snapped.geometry.coordinates[1], snapped.geometry.coordinates[0]]; // Back to [lat, lng]
    const insertIndex = snapped.properties.index + 1;

    // Create a new vertices array with the new point inserted
    const newVertices = [...vertices];
    newVertices.splice(insertIndex, 0, newVertex);
    
    onVerticesChange(newVertices);
    onInteraction();
  };

  // --- CLICK VERTEX TO REMOVE ---
  const handleVertexClick = (indexToRemove) => {
    if (vertices.length <= 3) {
      toast.warn("A flight path must have at least 3 points.");
      return;
    }
    const newVertices = vertices.filter((_, index) => index !== indexToRemove);
    onVerticesChange(newVertices);
    onInteraction();
  };
  
  const mapCenter = useMemo(() => {
    return vertices.length > 0
      ? L.latLngBounds(vertices).getCenter()
      : [project.latitude, project.longitude];
  }, [vertices, project]);

  return (
    <div className="map-container" style={{ cursor: 'grab' }}>
      <MapContainer
        center={mapCenter}
        zoom={16}
        scrollWheelZoom={true}
        className="leaflet-map-container"
        ref={mapRef}
        whenCreated={whenCreated}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Standard Map">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="Satellite & Labels">
            <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" subdomains={["mt0", "mt1", "mt2", "mt3"]} attribution="&copy; Google" />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        <FlightGrid vertices={vertices} angle={flightAngle} />
        
        {/* The main polygon outline */}
        {vertices.length > 1 && (
            <Polyline 
              positions={[...vertices, vertices[0]]} 
              pathOptions={{ color: '#007cbf', weight: 5, opacity: 0.8 }}
              eventHandlers={{ click: handleEdgeClick }}
            />
        )}
        
        {/* The draggable vertices (corners) */}
        {vertices.map((position, index) => (
            <CircleMarker
                key={`vertex-${index}`}
                center={position}
                draggable={true}
                eventHandlers={{
                    mousedown: handleDragStart, // Disable map panning when starting to drag a vertex
                    drag: (e) => {
                      const newVertices = [...vertices];
                      newVertices[index] = [e.target.getLatLng().lat, e.target.getLatLng().lng];
                      onVerticesChange(newVertices);
                    },
                    dragend: () => {
                        handleDragEnd(); // Re-enable map panning
                        onInteraction();
                    },
                    // Direct click on a vertex removes it
                    click: () => handleVertexClick(index),
                }}
                radius={8}
                pathOptions={{ color: '#007cbf', fillColor: '#fff', weight: 2, fillOpacity: 1 }}
            />
        ))}

        {/* The move and rotate handles for the entire polygon */}
        <PolygonHandles 
            vertices={vertices} 
            onMove={onVerticesChange} 
            onRotate={() => {}} // Rotation is now handled by onMove
            onDragStart={handleDragStart}
            onDragEnd={() => {
                handleDragEnd();
                onInteraction();
            }}
        />

        {/* The permanent project location marker */}
        {project && <Marker position={[project.latitude, project.longitude]}><Tooltip permanent>{project.name}</Tooltip></Marker>}
      </MapContainer>
    </div>
  );
};

export default InteractiveMap;