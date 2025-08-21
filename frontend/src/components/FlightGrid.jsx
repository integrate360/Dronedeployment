// frontend/src/components/FlightGrid.jsx
import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import * as turf from '@turf/turf';

// This component calculates and renders the internal flight grid and path
const FlightGrid = ({ vertices, angle, spacing = 20 }) => {
  // We use useMemo to prevent expensive recalculations on every render
  const { gridLines, flightPath } = useMemo(() => {
    if (vertices.length < 3) {
      return { gridLines: [], flightPath: [] };
    }

    // 1. Create a GeoJSON polygon from our Leaflet vertices
    const polygonCoords = vertices.map(p => [p[1], p[0]]);
    polygonCoords.push(polygonCoords[0]); // Close the ring
    const polygon = turf.polygon([polygonCoords]);
    
    // 2. Rotate the polygon to make grid lines horizontal for easier calculation
    const center = turf.centerOfMass(polygon);
    const rotatedPolygon = turf.transformRotate(polygon, -angle, { pivot: center });

    // 3. Get the bounding box of the rotated polygon
    const bbox = turf.bbox(rotatedPolygon);
    const [minX, minY, maxX, maxY] = bbox;
    
    // 4. Create horizontal lines across the bounding box
    const lines = [];
    const distance = turf.distance([minX, minY], [maxX, minY], { units: 'meters' });
    const lineSpacingInDegrees = (spacing / 111320); // Rough conversion of meters to degrees

    for (let y = minY; y <= maxY; y += lineSpacingInDegrees) {
      lines.push(turf.lineString([[minX - 1, y], [maxX + 1, y]]));
    }

    // 5. Clip these lines to the boundary of our rotated polygon
    const clippedLines = lines.map(line => turf.lineIntersect(rotatedPolygon, line))
                              .filter(intersection => intersection.features.length > 1);
    
    if (clippedLines.length === 0) {
        return { gridLines: [], flightPath: [] };
    }

    const finalGridSegments = clippedLines.map(intersection => 
        turf.lineString(intersection.features.map(f => f.geometry.coordinates))
    );

    // 6. Rotate the grid lines back to their original orientation
    const finalGrid = finalGridSegments.map(line => 
      turf.transformRotate(line, angle, { pivot: center })
    );

    // 7. Calculate the S-pattern flight path from the grid
    let pathPoints = [];
    finalGrid.forEach((line, index) => {
      const coords = line.geometry.coordinates;
      // Reverse the order for every other line to create the S-pattern
      if (index % 2 !== 0) {
        pathPoints.push(...coords.reverse());
      } else {
        pathPoints.push(...coords);
      }
    });

    // Convert GeoJSON [lng, lat] back to Leaflet [lat, lng] for rendering
    const leafletGridLines = finalGrid.map(line => line.geometry.coordinates.map(p => [p[1], p[0]]));
    const leafletFlightPath = pathPoints.map(p => [p[1], p[0]]);

    return { gridLines: leafletGridLines, flightPath: leafletFlightPath };

  }, [vertices, angle, spacing]);

  return (
    <>
      {/* Render the internal grid lines */}
      {gridLines.map((line, index) => (
        <Polyline key={`grid-${index}`} positions={line} color="#45ff70" weight={1} opacity={0.7} />
      ))}
      {/* Render the S-pattern flight path */}
      {flightPath.length > 0 && (
        <Polyline positions={flightPath} color="white" weight={2} dashArray="5, 10" />
      )}
    </>
  );
};

export default FlightGrid;