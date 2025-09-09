// frontend/src/components/InteractiveMap.jsx
import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback
} from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  LayersControl,
  Popup
} from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'react-toastify';

import FlightGrid from './FlightGrid';
import PolygonHandles from './PolygonHandles';
import DroneMarker from './DroneMarker';
import DroneAnimation from './DroneAnimation';

// Photo marker icon
const createPhotoIcon = () => {
  const iconHtml = `<div class="photo-marker-icon">📷</div>`;
  return L.divIcon({
    html: iconHtml,
    className: 'photo-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const createMidpointIcon = () => {
  const iconHtml = `<div class="midpoint-handle-icon"></div>`;
  return L.divIcon({
    html: iconHtml,
    className: 'midpoint-handle',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

const photoIcon = createPhotoIcon();
const midpointIcon = createMidpointIcon();

const InteractiveMap = forwardRef(({
  project,
  vertices,
  flightAngle,
  flightSpacing,
  enhanced3d,
  isInteracting,
  onVerticesChange,
  onInteractionStart,
  onInteractionEnd,
  whenCreated,
  onSimulationStateChange,
}, ref) => {
  const mapRef = useRef(null);
  const websocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const droneMarkerRef = useRef(null);

  // Simulation state
  const [dronePosition, setDronePosition] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [missionStatus, setMissionStatus] = useState({
    active: false,
    progress: 0,
    photosToTaken: 0,
    totalWaypoints: 0,
    currentWaypoint: 0
  });
  const [photoLocations, setPhotoLocations] = useState([]);
  const [flightPath, setFlightPath] = useState([]);
  const [simulationStats, setSimulationStats] = useState({
    startTime: null,
    photosToTaken: 0,
    distanceFlown: 0,
    batteryLevel: 100
  });
  const [animationState, setAnimationState] = useState({ status: null, altitude: 0 });
  const [simulationSummary, setSimulationSummary] = useState(null);

  const connectWebSocket = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket('ws://localhost:5000');
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to simulation server');
        setIsConnected(true);
        toast.success("Simulation Engine Connected");

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onclose = (event) => {
        console.log('Disconnected from simulation server');
        setIsConnected(false);
        setDronePosition(null);

        if (event.code !== 1000) {
          toast.warn("Simulation Engine Disconnected");
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", event.data, e);
        }
      };

    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnected(false);
    }
  }, []);

  // Handle drone position updates smoothly
  useEffect(() => {
    if (dronePosition && droneMarkerRef.current) {
      const marker = droneMarkerRef.current;
      const newPos = [dronePosition.lat, dronePosition.lng];
      
      marker.setLatLng(newPos);
      
      const tooltip = marker.getTooltip();
      if (tooltip) {
        const altitudeFt = dronePosition.alt_feet ? dronePosition.alt_feet.toFixed(0) : 0;
        const speedMps = dronePosition.ground_speed ? dronePosition.ground_speed.toFixed(1) : 0;
        const heading = dronePosition.heading ? dronePosition.heading.toFixed(0) : 0;
        
        tooltip.setContent(`
          <div class="drone-tooltip">
            <div class="tooltip-header">
              <span>🚁 Drone Position</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Altitude:</span>
              <span class="value">${altitudeFt} ft</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Speed:</span>
              <span class="value">${speedMps} m/s</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Heading:</span>
              <span class="value">${heading}°</span>
            </div>
            ${dronePosition.battery ? `
            <div class="tooltip-row">
              <span class="label">Battery:</span>
              <span class="value">${dronePosition.battery}%</span>
            </div>
            ` : ''}
          </div>
        `);
      }
    }
  }, [dronePosition]);

  const handleWebSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected':
        console.log('Server connection confirmed:', data.payload);
        break;

      case 'telemetry':
        const telemetryData = data.payload;
        
        // Smooth transition for drone movement
        setDronePosition(prev => {
          if (!prev) return telemetryData;
          return {
            ...telemetryData,
            lat: (prev.lat + telemetryData.lat) / 2,
            lng: (prev.lng + telemetryData.lng) / 2,
            alt: (prev.alt + telemetryData.alt) / 2
          };
        });

        setAnimationState(prev =>
          prev.status ? { ...prev, altitude: telemetryData.alt || 0 } : prev
        );

        if (telemetryData.lat && telemetryData.lng) {
          setFlightPath(prev => {
            const newPath = [...prev, [telemetryData.lat, telemetryData.lng]];
            return newPath.slice(-500);
          });
        }
        
        if (telemetryData.mission_status) {
          setMissionStatus(prev => ({ 
            ...prev, 
            active: telemetryData.mission_status.active, 
            photosToTaken: telemetryData.mission_status.photos_taken, 
            currentWaypoint: telemetryData.mission_status.current_waypoint 
          }));
        }
        
        setSimulationStats(prev => ({ 
          ...prev, 
          batteryLevel: telemetryData.battery || 100 
        }));
        break;

      case 'status':
        toast.info(data.payload);
        if (data.payload.includes('Taking off')) {
          setAnimationState({ status: 'takeoff', altitude: 0 });
        } else if (data.payload.includes('returning to launch')) {
          setAnimationState({ status: 'landing', altitude: dronePosition?.alt || 0 });
        }
        break;

      case 'mission_info':
        const missionInfo = data.payload;
        setMissionStatus(prev => ({ ...prev, totalWaypoints: missionInfo.total_waypoints, active: true }));
        setSimulationStats(prev => ({ ...prev, startTime: new Date() }));
        toast.info(`Mission started: ${missionInfo.total_waypoints} waypoints, estimated ${missionInfo.estimated_time}s`);
        break;

      case 'waypoint_progress':
        const progress = data.payload;
        setMissionStatus(prev => ({ ...prev, currentWaypoint: progress.current, totalWaypoints: progress.total, progress: progress.percentage }));
        break;

      case 'photo_taken':
        const photoData = data.payload;
        setPhotoLocations(prev => [...prev, { 
          id: photoData.photo_number, 
          lat: photoData.location.lat, 
          lng: photoData.location.lng, 
          altitude: photoData.location.altitude, 
          timestamp: new Date() 
        }]);
        setSimulationStats(prev => ({ ...prev, photosToTaken: photoData.photo_number }));
        break;

      case 'mission_complete':
        const completionData = data.payload;
        setSimulationSummary({
          photosTaken: completionData.photos_taken,
          waypointsCompleted: completionData.waypoints_completed,
          distanceFlown: completionData.distance_flown,
          areaCovered: completionData.area_covered,
          missionDuration: completionData.mission_duration
        });
        toast.success(`Mission Complete! Photos taken: ${completionData.photos_taken}`);
        setMissionStatus(prev => ({ ...prev, active: false }));
        onSimulationStateChange(false);
        setAnimationState({ status: 'landing', altitude: dronePosition?.alt || 0 });
        break;

      case 'simulation_end':
        toast.success(data.payload);
        onSimulationStateChange(false);
        setMissionStatus(prev => ({ ...prev, active: false }));
        setTimeout(() => {
          setAnimationState({ status: null, altitude: 0 });
          setDronePosition(null);
        }, 2000);
        break;

      case 'error':
        toast.error(data.payload);
        onSimulationStateChange(false);
        setMissionStatus(prev => ({ ...prev, active: false }));
        setAnimationState({ status: null, altitude: 0 });
        break;

      case 'warning':
        toast.warn(data.payload);
        break;

      case 'vehicle_status':
        console.log('Vehicle status:', data.payload);
        break;

      default:
        console.log('Unknown message type:', data.type, data.payload);
        break;
    }
  }, [onSimulationStateChange, dronePosition?.alt]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (websocketRef.current) {
        websocketRef.current.close(1000, "Component unmounting");
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && !isInteracting && vertices.length > 2) {
      const bounds = L.latLngBounds(vertices);
      map.flyToBounds(bounds, { padding: [50, 50], duration: 0.5, maxZoom: 20 });
    }
  }, [vertices, isInteracting]);

  useImperativeHandle(ref, () => ({
    startMission(missionData) {
      if (!isConnected) {
        toast.error("Simulation Engine not connected. Please wait and try again.");
        return;
      }

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        const command = {
          command: "start_mission",
          data: {
            ...missionData,
            enhanced3d: enhanced3d,
            flight_pattern: "survey"
          }
        };

        websocketRef.current.send(JSON.stringify(command));
        onSimulationStateChange(true);

        // Reset simulation state
        setPhotoLocations([]);
        setFlightPath([]);
        setDronePosition(null);
        setSimulationSummary(null);
        setMissionStatus({
          active: true,
          progress: 0,
          photosToTaken: 0,
          totalWaypoints: 0,
          currentWaypoint: 0
        });

        // Center map on the mission area
        if (vertices.length > 0) {
          const map = mapRef.current;
          const bounds = L.latLngBounds(vertices);
          map.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
        }

      } else {
        toast.error("Connection to simulation engine lost. Reconnecting...");
        connectWebSocket();
      }
    },

    stopMission() {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        const command = { command: "stop_mission" };
        websocketRef.current.send(JSON.stringify(command));
      }
    },

    emergencyLand() {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        const command = { command: "emergency_land" };
        websocketRef.current.send(JSON.stringify(command));
        toast.warn("Emergency landing initiated!");
      }
    },

    getStatus() {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        const command = { command: "get_status" };
        websocketRef.current.send(JSON.stringify(command));
      }
    }
  }), [isConnected, enhanced3d, onSimulationStateChange, connectWebSocket, vertices]);

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
        insertIndex: i + 1
      });
    }
    return points;
  }, [vertices]);

  const SimulationSummaryModal = () => {
    if (!simulationSummary) return null;
    
    const acresCovered = (simulationSummary.areaCovered / 4046.86).toFixed(2);
    const hours = Math.floor(simulationSummary.missionDuration / 3600);
    const minutes = Math.floor((simulationSummary.missionDuration % 3600) / 60);
    const seconds = Math.floor(simulationSummary.missionDuration % 60);
    
    return (
      <div className="simulation-summary-modal">
        <div className="modal-content">
          <h2>Mission Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Photos Taken:</span>
              <span className="value">{simulationSummary.photosTaken}</span>
            </div>
            <div className="summary-item">
              <span className="label">Waypoints Completed:</span>
              <span className="value">{simulationSummary.waypointsCompleted}</span>
            </div>
            <div className="summary-item">
              <span className="label">Distance Flown:</span>
              <span className="value">{simulationSummary.distanceFlown.toFixed(2)} meters</span>
            </div>
            <div className="summary-item">
              <span className="label">Area Covered:</span>
              <span className="value">{acresCovered} acres ({simulationSummary.areaCovered.toFixed(2)} m²)</span>
            </div>
            <div className="summary-item">
              <span className="label">Mission Duration:</span>
              <span className="value">{hours}h {minutes}m {seconds}s</span>
            </div>
          </div>
          <button 
            className="close-summary-btn"
            onClick={() => setSimulationSummary(null)}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="map-container">
      <MapContainer
        center={[project.latitude, project.longitude]}
        zoom={16}
        scrollWheelZoom={true}
        className="leaflet-map-container"
        ref={mapRef}
        whenCreated={whenCreated}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Standard Map">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="Satellite & Labels">
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
              subdomains={["mt0", "mt1", "mt2", "mt3"]}
              attribution="&copy; Google"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <FlightGrid
          vertices={vertices}
          angle={flightAngle}
          spacing={flightSpacing}
          enhanced3d={enhanced3d}
        />

        {dronePosition && (
          <DroneMarker
            ref={droneMarkerRef}
            position={dronePosition}
            isActive={missionStatus.active}
          />
        )}

        {flightPath.length > 1 && (
          <Polyline
            positions={flightPath}
            pathOptions={{
              color: '#ff6b35',
              weight: 3,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}

        {photoLocations.map((photo) => (
          <Marker
            key={`photo-${photo.id}`}
            position={[photo.lat, photo.lng]}
            icon={photoIcon}
          >
            <Popup>
              <div>
                <strong>Photo #{photo.id}</strong><br />
                <small>Altitude: {photo.altitude.toFixed(1)}m</small><br />
                <small>Time: {photo.timestamp.toLocaleTimeString()}</small>
              </div>
            </Popup>
          </Marker>
        ))}

        <Polyline
          positions={[...vertices, vertices.length > 2 ? vertices[0] : null]}
          pathOptions={{
            color: '#007cbf',
            weight: 5,
            opacity: 0.8
          }}
        />

        {vertices.map((position, index) => {
          const vertexIcon = L.divIcon({
            html: `<div class="vertex-handle-icon"></div>`,
            className: 'vertex-handle',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
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
                  const newLatLng = e.target.getLatLng();
                  const newVertices = [...vertices];
                  newVertices[index] = [newLatLng.lat, newLatLng.lng];
                  onVerticesChange(newVertices);
                },
                dragend: onInteractionEnd,
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  handleVertexClick(index);
                },
              }}
            />
          );
        })}

        {midpoints.map((midpoint, index) => (
          <Marker
            key={`midpoint-${index}`}
            position={midpoint.position}
            icon={midpointIcon}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onInteractionStart();
                const newVertex = [e.latlng.lat, e.latlng.lng];
                const newVertices = [...vertices];
                newVertices.splice(midpoint.insertIndex, 0, newVertex);
                onVerticesChange(newVertices);
                onInteractionEnd();
              },
            }}
          />
        ))}

        <PolygonHandles
          vertices={vertices}
          onMove={onVerticesChange}
          onDragStart={onInteractionStart}
          onDragEnd={onInteractionEnd}
        />

        {project && (
          <Marker position={[project.latitude, project.longitude]}>
            <Tooltip permanent>{project.name}</Tooltip>
          </Marker>
        )}

        {missionStatus.active && (
          <div className="mission-status-overlay">
            <div className="mission-progress">
              <div>Progress: {missionStatus.progress.toFixed(1)}%</div>
              <div>Waypoint: {missionStatus.currentWaypoint}/{missionStatus.totalWaypoints}</div>
              <div>Photos: {missionStatus.photosToTaken}</div>
              <div>Battery: {simulationStats.batteryLevel}%</div>
            </div>
            <div className="mission-progress-bar">
              <div
                className="mission-progress-fill"
                style={{ width: `${missionStatus.progress}%` }}
              />
            </div>
          </div>
        )}
      </MapContainer>

      <DroneAnimation
        status={animationState.status}
        altitude={animationState.altitude}
      />

      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        <div className="status-indicator"></div>
        <span>{isConnected ? 'Simulation Engine Connected' : 'Connecting...'}</span>
      </div>

      <SimulationSummaryModal />
    </div>
  );
});

export default InteractiveMap;