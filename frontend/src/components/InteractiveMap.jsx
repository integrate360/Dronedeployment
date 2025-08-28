// frontend/src/components/InteractiveMap.jsx
import React, { useMemo, useRef, useCallback, useEffect } from 'react'; // --- MODIFIED: Imported useEffect
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  LayersControl,
} from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'react-toastify';

import FlightGrid from './FlightGrid';
import PolygonHandles from './PolygonHandles';

// Helper function to create the custom icon for the midpoint handles
const createMidpointIcon = () => {
  const iconHtml = `<div class="midpoint-handle-icon"></div>`;
  return L.divIcon({
    html: iconHtml,
    className: 'midpoint-handle',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};
const midpointIcon = createMidpointIcon();

const InteractiveMap = ({
  project,
  vertices,
  flightAngle,
  isInteracting,
  onVerticesChange,
  onInteractionStart,
  onInteractionEnd,
  whenCreated,
}) => {
  const mapRef = useRef(null);

  // --- NEW: useEffect to auto-fit bounds after interaction ---
  useEffect(() => {
    const map = mapRef.current;
    if (map && !isInteracting && vertices.length > 2) {
      const bounds = L.latLngBounds(vertices);
      // Fly to the new bounds with some padding and a max zoom level
      map.flyToBounds(bounds, {
        padding: [20, 20],
        duration: 0.5, // Animation duration in seconds
        maxZoom: 20
      });
    }
  }, [vertices, isInteracting, mapRef]);


  // --- CLICK VERTEX TO REMOVE ---
  const handleVertexClick = (indexToRemove) => {
    if (vertices.length <= 3) {
      toast.warn("A flight path must have at least 3 points.");
      return;
    }
    const newVertices = vertices.filter((_, index) => index !== indexToRemove);
    onVerticesChange(newVertices);
    onInteractionEnd();
  };

  const midpoints = useMemo(() => {
    if (vertices.length < 2) return [];

    const points = [];
    for (let i = 0; i < vertices.length; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % vertices.length];

      points.push({
        position: L.latLng((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2),
        insertIndex: i + 1,
        edgeIndex: i
      });
    }
    return points;
  }, [vertices]);

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
            {/* --- MODIFIED: Added maxZoom property --- */}
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' maxZoom={20} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="Satellite & Labels">
            {/* --- MODIFIED: Added maxZoom property --- */}
            <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" subdomains={["mt0", "mt1", "mt2", "mt3"]} attribution="&copy; Google" maxZoom={20} />
          </LayersControl.BaseLayer>
        </LayersControl>

        <FlightGrid 
          vertices={vertices} 
          angle={flightAngle} 
          isInteracting={isInteracting} 
        />

        <Polyline
          positions={[...vertices, vertices.length > 2 ? vertices[0] : null]}
          pathOptions={{ color: '#007cbf', weight: 5, opacity: 0.8 }}
        />

        {/* Draggable Primary Vertices */}
        {vertices.map((position, index) => {
          const vertexIcon = L.divIcon({
            html: `<div style="
              width: 16px; 
              height: 16px; 
              background-color: white; 
              border: 2px solid #007cbf; 
              border-radius: 50%;
              cursor: move;
            "></div>`,
            className: 'vertex-handle',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          return (
            <Marker
              key={`vertex-${index}`}
              position={position}
              icon={vertexIcon}
              draggable={true}
              eventHandlers={{
                dragstart: onInteractionStart,
                drag: (e) => {
                  const marker = e.target;
                  const newLatLng = marker.getLatLng();
                  const newVertices = [...vertices];
                  newVertices[index] = [newLatLng.lat, newLatLng.lng];
                  onVerticesChange(newVertices);
                },
                dragend: onInteractionEnd,
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  // A small delay to distinguish from a drag
                  setTimeout(() => {
                    handleVertexClick(index);
                  }, 50);
                },
                mouseover: (e) => {
                  e.target.getElement().style.cursor = 'move';
                  e.target.getElement().style.zIndex = '1000';
                },
                mouseout: (e) => {
                  e.target.getElement().style.cursor = '';
                  e.target.getElement().style.zIndex = '';
                }
              }}
            />
          );
        })}

        {/* Midpoint markers for adding new vertices */}
        {midpoints.map((midpoint, index) => (
          <Marker
            key={`midpoint-${index}`}
            position={midpoint.position}
            icon={midpointIcon}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                const newVertex = [e.latlng.lat, e.latlng.lng];
                const newVertices = [...vertices];
                newVertices.splice(midpoint.insertIndex, 0, newVertex);
                onVerticesChange(newVertices);
                onInteractionEnd();
              },
              mouseover: (e) => {
                e.target.getElement().style.cursor = 'pointer';
                e.target.getElement().style.zIndex = '1000';
              },
              mouseout: (e) => {
                e.target.getElement().style.cursor = '';
                e.target.getElement().style.zIndex = '';
              }
            }}
          />
        ))}

        <PolygonHandles
          vertices={vertices}
          onMove={onVerticesChange}
          onDragStart={onInteractionStart}
          onDragEnd={onInteractionEnd}
        />

        {project && <Marker position={[project.latitude, project.longitude]}><Tooltip permanent>{project.name}</Tooltip></Marker>}
      </MapContainer>
    </div>
  );
};

export default InteractiveMap;