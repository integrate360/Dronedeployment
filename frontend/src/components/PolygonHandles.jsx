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

const moveIcon = createDivIcon(<FiMove />);
const rotateIcon = createDivIcon(<FiRefreshCw />);

const PolygonHandles = ({ vertices, onMove, onDragStart, onDragEnd }) => {
  const dragStartRef = useRef(null);

  const { center, rotationHandlePosition } = useMemo(() => {
    if (vertices.length < 3) return { center: null, rotationHandlePosition: null };

    const polygonCoords = vertices.map(v => [v[1], v[0]]);
    polygonCoords.push(polygonCoords[0]);

    const polygon = turf.polygon([polygonCoords]);
    const centerPoint = turf.centerOfMass(polygon);
    const centerLatLng = { lat: centerPoint.geometry.coordinates[1], lng: centerPoint.geometry.coordinates[0] };

    const bbox = turf.bbox(polygon);
    const northPoint = turf.point([centerPoint.geometry.coordinates[0], bbox[3]]);
    // Position the rotation handle a fixed distance north of the polygon's center
    const bearingPoint = turf.destination(northPoint, 0.05, 0, { units: 'kilometers' });

    return {
      center: centerLatLng,
      rotationHandlePosition: { lat: bearingPoint.geometry.coordinates[1], lng: bearingPoint.geometry.coordinates[0] },
    };
  }, [vertices]);

  if (!center) return null;

  const handleRotate = (e) => {
    if (!dragStartRef.current) return;

    const { initialCenterPoint, initialVertices, initialHandlePosition } = dragStartRef.current;
    const mousePos = e.latlng;

    // Calculate bearing from the fixed initial center to the handle's start position
    const originalBearing = turf.bearing(
      initialCenterPoint,
      turf.point([initialHandlePosition.lng, initialHandlePosition.lat])
    );

    // Calculate bearing from the fixed initial center to the current mouse position
    const newBearing = turf.bearing(
      initialCenterPoint,
      turf.point([mousePos.lng, mousePos.lat])
    );

    const angleDiff = newBearing - originalBearing;

    // Use the original vertices (not the current state) to calculate rotation
    const rotatedVertices = initialVertices.map(v => {
      const point = turf.point([v[1], v[0]]);
      const distance = turf.distance(initialCenterPoint, point);
      const bearing = turf.bearing(initialCenterPoint, point);
      const newPoint = turf.destination(initialCenterPoint, distance, bearing + angleDiff);
      return [newPoint.geometry.coordinates[1], newPoint.geometry.coordinates[0]];
    });

    onMove(rotatedVertices);
  }

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
              initialVertices: [...vertices], // Store a fresh copy
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
          dragend: onDragEnd,
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
              initialVertices: [...vertices], // Store a fresh copy
              initialHandlePosition: { ...rotationHandlePosition } // Store initial handle pos
            };
          },
          drag: handleRotate,
          dragend: onDragEnd,
        }}
      />
    </>
  );
};

export default PolygonHandles;