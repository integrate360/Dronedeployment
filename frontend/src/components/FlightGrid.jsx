// frontend/src/components/FlightGrid.jsx
import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import * as turf from '@turf/turf';

// This component calculates and renders the internal flight grid and path
const FlightGrid = ({ vertices, angle, spacing = 20, enhanced3d }) => { // --- NEW: enhanced3d prop
  // We use useMemo to prevent expensive calculations on every render
  const { gridLines, perpendicularGridLines, flightPath } = useMemo(() => {
    if (vertices.length < 3) {
      return { gridLines: [], perpendicularGridLines: [], flightPath: [] };
    }

    // --- Helper function to generate grid lines for a given angle ---
    const generateGridForAngle = (rotationAngle) => {
        // 1. Create a GeoJSON polygon from our Leaflet vertices
        const polygonCoords = vertices.map(p => [p[1], p[0]]);
        polygonCoords.push(polygonCoords[0]); // Close the ring
        const polygon = turf.polygon([polygonCoords]);
        
        // 2. Rotate the polygon to make grid lines horizontal for easier calculation
        const center = turf.centerOfMass(polygon);
        const rotatedPolygon = turf.transformRotate(polygon, -rotationAngle, { pivot: center });

        // 3. Get the bounding box of the rotated polygon
        const bbox = turf.bbox(rotatedPolygon);
        const [minX, minY, maxX, maxY] = bbox;
        
        // 4. Create horizontal lines across the bounding box
        const lines = [];
        // Rough conversion of meters to degrees. Spacing is in meters.
        const lineSpacingInDegrees = (spacing / 111320);

        for (let y = minY; y <= maxY; y += lineSpacingInDegrees) {
            lines.push(turf.lineString([[minX - 1, y], [maxX + 1, y]]));
        }

        // 5. Clip these lines to the boundary of our rotated polygon
        const clippedLines = lines.map(line => turf.lineIntersect(rotatedPolygon, line))
                                  .filter(intersection => intersection.features.length > 1);
        
        if (clippedLines.length === 0) {
            return [];
        }

        const finalGridSegments = clippedLines.map(intersection => 
            turf.lineString(intersection.features.map(f => f.geometry.coordinates))
        );

        // 6. Rotate the grid lines back to their original orientation
        const finalGrid = finalGridSegments.map(line => 
          turf.transformRotate(line, rotationAngle, { pivot: center })
        );

        return finalGrid;
    }

    // --- Generate the primary grid and flight path ---
    const primaryGrid = generateGridForAngle(angle);
    let pathPoints = [];
    primaryGrid.forEach((line, index) => {
      const coords = line.geometry.coordinates;
      if (index % 2 !== 0) {
        pathPoints.push(...coords.reverse());
      } else {
        pathPoints.push(...coords);
      }
    });
    
    // --- Generate the perpendicular grid for Enhanced 3D ---
    let perpendicularGrid = [];
    if (enhanced3d) {
        perpendicularGrid = generateGridForAngle(angle + 90);
    }

    // Convert GeoJSON [lng, lat] back to Leaflet [lat, lng] for rendering
    const leafletGridLines = primaryGrid.map(line => line.geometry.coordinates.map(p => [p[1], p[0]]));
    const leafletPerpendicularGrid = perpendicularGrid.map(line => line.geometry.coordinates.map(p => [p[1], p[0]]));
    const leafletFlightPath = pathPoints.map(p => [p[1], p[0]]);

    return { 
        gridLines: leafletGridLines, 
        perpendicularGridLines: leafletPerpendicularGrid,
        flightPath: leafletFlightPath 
    };

  }, [vertices, angle, spacing, enhanced3d]); // --- NEW: enhanced3d dependency

  return (
    <>
      {/* Render the primary internal grid lines */}
      {gridLines.map((line, index) => (
        <Polyline key={`grid-${index}`} positions={line} color="#45ff70" weight={1} opacity={0.7} />
      ))}

      {/* --- NEW: Conditionally render the perpendicular grid lines --- */}
      {enhanced3d && perpendicularGridLines.map((line, index) => (
        <Polyline key={`perp-grid-${index}`} positions={line} color="#45ff70" weight={1} opacity={0.7} />
      ))}

      {/* Render the S-pattern flight path */}
      {flightPath.length > 0 && (
        <Polyline positions={flightPath} color="white" weight={2} dashArray="5, 10" />
      )}
    </>
  );
};

export default FlightGrid;