// frontend/src/components/PolygonHandles.jsx
import React, { useMemo, useRef } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { FiMove, FiRefreshCw } from 'react-icons/fi';
import ReactDOMServer from 'react-dom/server';

// Helper function to create custom HTML icons
const createDivIcon = (icon) => {
  return L.divIcon({
    html: ReactDOMServer.renderToString(icon),
    className: 'polygon-handle',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Helper for the new edge handles
const createEdgeHandleIcon = () => {
    return L.divIcon({
      html: ReactDOMServer.renderToString(<div className="edge-handle-icon" />),
      className: 'edge-handle', // New class for styling
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

const moveIcon = createDivIcon(<FiMove />);
const rotateIcon = createDivIcon(<FiRefreshCw />);
const edgeIcon = createEdgeHandleIcon(); // Create the icon for edge handles

const PolygonHandles = ({ vertices, onMove, onRotate, onDragStart, onDragEnd }) => {
  const dragStartRef = useRef(null);

  const { center, rotationHandlePosition, edges } = useMemo(() => {
    if (vertices.length < 3) return { center: null, rotationHandlePosition: null, edges: [] };

    const polygonCoords = vertices.map(v => [v[1], v[0]]);
    polygonCoords.push(polygonCoords[0]); 
    
    const polygon = turf.polygon([polygonCoords]); 
    const centerPoint = turf.centerOfMass(polygon);
    const centerLatLng = { lat: centerPoint.geometry.coordinates[1], lng: centerPoint.geometry.coordinates[0] };

    const bbox = turf.bbox(polygon);
    const northPoint = turf.point([centerPoint.geometry.coordinates[0], bbox[3]]);
    const bearingPoint = turf.destination(northPoint, 0.05, 0, { units: 'kilometers' }); // 50m north

    // Calculate edge midpoints
    const edgeMidpoints = [];
    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length]; // Wrap around for the last edge
        const midPoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        edgeMidpoints.push({
            position: midPoint,
            v1_index: i,
            v2_index: (i + 1) % vertices.length,
        });
    }
    
    return {
      center: centerLatLng,
      rotationHandlePosition: { lat: bearingPoint.geometry.coordinates[1], lng: bearingPoint.geometry.coordinates[0] },
      edges: edgeMidpoints
    };
  }, [vertices]);

  if (!center) return null;

  const handleRotate = (e) => {
    if (!dragStartRef.current) return;

    const { initialCenterPoint, initialVertices } = dragStartRef.current;
    const mousePos = e.latlng;
    
    const originalBearing = turf.bearing(initialCenterPoint, turf.point([rotationHandlePosition.lng, rotationHandlePosition.lat]));
    const newBearing = turf.bearing(initialCenterPoint, turf.point([mousePos.lng, mousePos.lat]));
    
    const angleDiff = newBearing - originalBearing;
    
    const rotatedVertices = initialVertices.map(v => {
      const point = turf.point([v[1], v[0]]);
      const distance = turf.distance(initialCenterPoint, point);
      const bearing = turf.bearing(initialCenterPoint, point);
      const newPoint = turf.destination(initialCenterPoint, distance, bearing + angleDiff);
      return [newPoint.geometry.coordinates[1], newPoint.geometry.coordinates[0]]; // back to [lat, lng]
    });
    onMove(rotatedVertices);
  }

  const handleEdgeDrag = (e, index1, index2) => {
    if (!dragStartRef.current) return;
    
    const { initialVertices } = dragStartRef.current;
    
    const v1 = initialVertices[index1];
    const v2 = initialVertices[index2];
    
    const p1 = turf.point([v1[1], v1[0]]);
    const p2 = turf.point([v2[1], v2[0]]);
    
    const bearing = turf.bearing(p1, p2);
    const normalBearing = bearing + 90;
    
    const currentPointTurf = turf.point([e.latlng.lng, e.latlng.lat]);
    
    const midPoint = turf.midpoint(p1, p2);
    const normalLineP1 = turf.destination(midPoint, 1, normalBearing, { units: 'kilometers' });
    const normalLineP2 = turf.destination(midPoint, 1, normalBearing - 180, { units: 'kilometers' });
    const infiniteNormalLine = turf.lineString([normalLineP1.geometry.coordinates, normalLineP2.geometry.coordinates]);
    
    const snappedCurrent = turf.nearestPointOnLine(infiniteNormalLine, currentPointTurf);
    
    const dragDistance = turf.distance(midPoint, snappedCurrent, { units: 'kilometers' });
    
    if (dragDistance === 0) return;

    const dragBearing = turf.bearing(midPoint, snappedCurrent);
    const bearingDiff = Math.abs(dragBearing - normalBearing);
    const direction = (bearingDiff < 1 || bearingDiff > 359) ? 1 : -1;
    
    const moveDistance = dragDistance * direction;
    
    const newP1 = turf.destination(p1, moveDistance, normalBearing, { units: 'kilometers' });
    const newP2 = turf.destination(p2, moveDistance, normalBearing, { units: 'kilometers' });
    
    const newVertices = [...initialVertices];
    newVertices[index1] = [newP1.geometry.coordinates[1], newP1.geometry.coordinates[0]];
    newVertices[index2] = [newP2.geometry.coordinates[1], newP2.geometry.coordinates[0]];
    
    onMove(newVertices);
  };

  return (
    <>
      {/* --- Move Handle --- */}
      <Marker
        position={center}
        icon={moveIcon}
        draggable={true}
        eventHandlers={{
          mousedown: (e) => {
            L.DomEvent.stopPropagation(e);
            onDragStart();
          },
          dragstart: (e) => {
            dragStartRef.current = {
              startPos: e.target.getLatLng(),
              initialVertices: vertices,
            };
          },
          drag: (e) => {
            if (!dragStartRef.current) return;
            const { startPos, initialVertices } = dragStartRef.current;
            const newPos = e.target.getLatLng();
            const latDiff = newPos.lat - startPos.lat;
            const lngDiff = newPos.lng - startPos.lng;
            
            const movedVertices = initialVertices.map(v => [v[0] + latDiff, v[1] + lngDiff]);
            onMove(movedVertices);
          },
          dragend: () => {
            onDragEnd();
            dragStartRef.current = null;
          },
        }}
      />
      {/* --- Rotate Handle --- */}
      <Marker
        position={rotationHandlePosition}
        icon={rotateIcon}
        draggable={true}
        eventHandlers={{
          mousedown: (e) => {
            L.DomEvent.stopPropagation(e);
            onDragStart();
          },
          dragstart: () => {
            dragStartRef.current = {
              initialCenterPoint: turf.point([center.lng, center.lat]),
              initialVertices: vertices,
            };
          },
          drag: handleRotate,
          dragend: () => {
            onDragEnd();
            dragStartRef.current = null;
          },
        }}
      />
      {/* --- Edge Handles for Stretching --- */}
      {edges.map((edge, index) => (
        <Marker
          key={`edge-${index}`}
          position={edge.position}
          icon={edgeIcon}
          draggable={true}
          eventHandlers={{
            mousedown: (e) => {
              L.DomEvent.stopPropagation(e);
              onDragStart();
            },
            dragstart: () => {
              dragStartRef.current = {
                initialVertices: [...vertices],
              };
            },
            drag: (e) => handleEdgeDrag(e, edge.v1_index, edge.v2_index),
            dragend: () => {
              onDragEnd();
              dragStartRef.current = null;
            },
          }}
        />
      ))}
    </>
  );
};

export default PolygonHandles;