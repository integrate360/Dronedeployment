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

  // --- REFINED IMPLEMENTATION: Manual logic for edge dragging (resizing) ---
  const handleEdgeDrag = (e, index1, index2) => {
    if (!dragStartRef.current) return;
    
    const { initialVertices } = dragStartRef.current;
    
    // 1. Get the original vertices of the edge from the stored state
    const v1 = initialVertices[index1];
    const v2 = initialVertices[index2];
    
    const p1 = turf.point([v1[1], v1[0]]);
    const p2 = turf.point([v2[1], v2[0]]);
    
    // 2. Calculate the normal (perpendicular) direction of the edge. This is the axis of movement.
    const bearing = turf.bearing(p1, p2);
    const normalBearing = bearing + 90; // The direction to push/pull the edge
    
    const currentPointTurf = turf.point([e.latlng.lng, e.latlng.lat]);
    
    // 3. To constrain movement, create an infinite line along the normal that passes through the edge's midpoint.
    const midPoint = turf.midpoint(p1, p2);
    const normalLineP1 = turf.destination(midPoint, 10, normalBearing, { units: 'kilometers' }); // A point far away
    const normalLineP2 = turf.destination(midPoint, 10, normalBearing - 180, { units: 'kilometers' }); // A point far away in the opposite direction
    const infiniteNormalLine = turf.lineString([normalLineP1.geometry.coordinates, normalLineP2.geometry.coordinates]);
    
    // 4. Find the closest point on the normal line to the current mouse position. This forces the drag to be perpendicular.
    const snappedCurrent = turf.nearestPointOnLine(infiniteNormalLine, currentPointTurf);
    
    // 5. Calculate the distance to move. This is the distance from the original midpoint to the snapped mouse position.
    const dragDistance = turf.distance(midPoint, snappedCurrent, { units: 'kilometers' });
    
    if (dragDistance === 0) return;

    // 6. Determine the direction (inward vs. outward).
    const dragBearing = turf.bearing(midPoint, snappedCurrent);
    const bearingDiff = Math.abs(dragBearing - normalBearing);
    // If the drag bearing is almost the same as the normal, it's outward (1). Otherwise, it's inward (-1).
    const direction = (bearingDiff < 1 || bearingDiff > 359) ? 1 : -1;
    
    const moveDistance = dragDistance * direction;
    
    // 7. Move the two original vertices by the calculated distance along the normal.
    const newP1 = turf.destination(p1, moveDistance, normalBearing, { units: 'kilometers' });
    const newP2 = turf.destination(p2, moveDistance, normalBearing, { units: 'kilometers' });
    
    // 8. Create the new set of vertices for the entire polygon.
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
              initialVertices: vertices, // Store original vertices
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
              initialVertices: vertices, // Store original vertices
            };
          },
          drag: handleRotate,
          dragend: () => {
            onDragEnd();
            dragStartRef.current = null;
          },
        }}
      />
      {/* --- Edge Handles for Resizing (Stretching) --- */}
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
              // Store a clean copy of the vertices at the moment the drag begins.
              dragStartRef.current = {
                initialVertices: [...vertices],
              };
            },
            drag: (e) => handleEdgeDrag(e, edge.v1_index, edge.v2_index),
            dragend: () => {
              onDragEnd();
              dragStartRef.current = null; // Clear the state
            },
          }}
        />
      ))}
    </>
  );
};

export default PolygonHandles;