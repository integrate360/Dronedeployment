// frontend/src/pages/ProjectDetailPage.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Switch,
  Button,
  Spin,
} from "antd";
import {
  FiChevronLeft,
  FiInfo,
  FiShare2,
  FiUpload,
  FiSettings,
  FiBell,
  FiSave,
  FiTrash2,
  FiStopCircle,
} from "react-icons/fi";
import { FaPlane, FaCube, FaPaperPlane } from "react-icons/fa";
import * as turf from "@turf/turf";
import api from "../apis/config";

import L from "leaflet";
import leafletImage from 'leaflet-image';

import InteractiveMap from '../components/InteractiveMap';
import DroneMarker from '../components/DroneMarker';

import "leaflet/dist/leaflet.css";
import "../styles/ProjectDetailPage.css";

// Helper function to create a default square polygon
const createDefaultSquare = (centerLat, centerLng, sizeMeters = 200) => {
  const centerPoint = turf.point([centerLng, centerLat]);
  const distance = (sizeMeters / 2) / 1000;
  const buffered = turf.circle(centerPoint, distance);
  const bbox = turf.bbox(buffered);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    [maxLat, minLng], [maxLat, maxLng], [minLat, maxLng], [minLat, minLng],
  ];
};


const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [vertices, setVertices] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [flightAngle, setFlightAngle] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [dronePosition, setDronePosition] = useState(null);
  const websocket = useRef(null);

  // Effect to manage WebSocket connection to the Python Simulation Server
// Replace the entire useEffect for WebSocket connection with this:

useEffect(() => {
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout;

  const connectWebSocket = () => {
    // Connect to the Python WebSocket server, which runs on port 5001
    const wsUrl = `ws://${window.location.hostname}:5001`;
    websocket.current = new WebSocket(wsUrl);

    websocket.current.onopen = () => {
      toast.success("Simulation Engine Connected");
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    };
    
    websocket.current.onclose = () => {
      toast.warn("Simulation Engine Disconnected");
      
      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000); // Exponential backoff up to 10s
        reconnectTimeout = setTimeout(connectWebSocket, delay);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
      }
    };
    
    websocket.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast.error("Simulation Engine Connection Error");
    };

    // Listen for messages from the simulation server
    websocket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'telemetry':
          setDronePosition(data.payload);
          break;
        case 'status':
          console.log('SIM_STATUS:', data.payload);
          toast.info(data.payload);
          break;
        case 'simulation_end':
          toast.success(data.payload);
          setIsFlying(false);
          setDronePosition(null);
          break;
        case 'error':
          toast.error(data.payload);
          setIsFlying(false);
          setDronePosition(null);
          break;
        default:
          break;
      }
    };
  };

  // Initial connection attempt
  connectWebSocket();

  // Cleanup on component unmount
  return () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    if (websocket.current) {
      websocket.current.close();
    }
  };
}, []); // Empty dependency array ensures this runs only once

  // Effect to fetch initial project data from the Node.js API server
  useEffect(() => {
    const fetchProjectData = async () => {
      setLoading(true);
      try {
        const projectsResponse = await api.get("/projects");
        const currentProject = projectsResponse.data.find((p) => p._id === projectId);
        if (!currentProject) {
          toast.error("Project not found.");
          navigate("/projects");
          return;
        }
        setProject(currentProject);

        const detailsResponse = await api.get(`/project-details/${projectId}`);
        const details = detailsResponse.data;

        setMission({
          id: details._id,
          flightAltitude: details.flightAltitude,
          enhanced3d: details.enhanced3d,
        });

        const existingVertices = geoJsonToVertices(details.flightPath);
        if (existingVertices.length > 0) {
          setVertices(existingVertices);
        } else {
          const defaultVertices = createDefaultSquare(currentProject.latitude, currentProject.longitude);
          setVertices(defaultVertices);
          setHasUnsavedChanges(true);
        }
        setFlightAngle(details.flightPathAngle || 0);
      } catch (error) {
        console.error("Data fetch error:", error);
        toast.error("Failed to fetch project data. Please try again.");
        navigate("/projects");
      } finally {
        setLoading(false);
        setHasUnsavedChanges(false);
      }
    };
    fetchProjectData();
  }, [projectId, navigate]);

  // Utility functions for converting between Leaflet vertices and GeoJSON
  const geoJsonToVertices = useCallback((flightPath) => {
    if (flightPath && flightPath.coordinates && flightPath.coordinates[0].length > 3) {
      return flightPath.coordinates[0].slice(0, -1).map(p => [p[1], p[0]]);
    }
    return [];
  }, []);

  const verticesToGeoJson = useCallback((verts) => {
    if (verts.length < 3) return null;
    const geoJsonCoords = verts.map(p => [p[1], p[0]]);
    geoJsonCoords.push(geoJsonCoords[0]); // Close the polygon
    return { type: 'Polygon', coordinates: [geoJsonCoords] };
  }, []);

  // Handle saving project details to the Node.js API
  const handleSave = useCallback(async () => {
    if (!mission || isSaving) return;
    setIsSaving(true);
    toast.info("Saving project details...");

    try {
      const flightPath = verticesToGeoJson(vertices);
      const dataToSave = {
        flightAltitude: mission.flightAltitude,
        enhanced3d: mission.enhanced3d,
        flightPath: flightPath,
        flightPathAngle: flightAngle,
      };
      await api.put(`/project-details/${projectId}`, dataToSave);
      setHasUnsavedChanges(false);
      toast.success("Project saved successfully!");
    } catch (error) {
      toast.error("Failed to save project details.");
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [mission, isSaving, vertices, flightAngle, projectId, verticesToGeoJson]);

  // Handler to send "start_mission" command via WebSocket
  const handleFlyMission = () => {
    if (hasUnsavedChanges) {
      toast.warn("Please save your changes before starting the mission.");
      return;
    }
    if (isFlying || !websocket.current || websocket.current.readyState !== WebSocket.OPEN) {
      toast.error("Simulation Engine not ready.");
      return;
    }

    const missionData = {
      altitude: mission.flightAltitude,
      waypoints: verticesToGeoJson(vertices).coordinates[0].slice(0, -1).map(c => ({ lat: c[1], lng: c[0] })),
      home: { lat: project.latitude, lng: project.longitude }
    };

    const command = {
      command: "start_mission",
      data: missionData
    };

    websocket.current.send(JSON.stringify(command));
    setIsFlying(true);
  };

  // Handler to send "stop_mission" command via WebSocket
  const handleStopMission = () => {
    if (!isFlying || !websocket.current || websocket.current.readyState !== WebSocket.OPEN) return;
    
    const command = { command: "stop_mission" };
    websocket.current.send(JSON.stringify(command));
    // The UI will update automatically when the "simulation_end" message is received
  };

  const handleVerticesChange = (newVertices) => {
    setVertices(newVertices);
    setHasUnsavedChanges(true);
  };

  const calculatedStats = useMemo(() => {
    const flightPath = verticesToGeoJson(vertices);
    if (!flightPath || !mission) return { minutes: "0:00", acres: 0, images: 0, battery: 0, resolution: 0, spacing: 20 };
    const areaMeters = turf.area(flightPath);
    const acres = parseFloat((areaMeters / 4046.86).toFixed(0));
    const altitude = mission.flightAltitude > 0 ? mission.flightAltitude : 1;
    const resolution = (altitude / 285).toFixed(1);
    const spacing = altitude * 0.2;
    const flightMultiplier = mission.enhanced3d ? 2 : 1;
    const baseImages = Math.round(acres * 18 * Math.pow(200 / altitude, 2));
    const images = baseImages * flightMultiplier;
    const totalSeconds = Math.round(images * 1.7);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    const battery = Math.ceil(totalSeconds / (20 * 60));
    return { minutes: `${minutes}:${seconds}`, acres, images, battery, resolution, spacing };
  }, [vertices, mission, verticesToGeoJson]);

  if (loading || !mission || !project) {
    return <div className="loading-container"><Spin size="large" /></div>;
  }

  return (
    <div className="project-detail-container">
      <header className="main-header">
        <div className="breadcrumbs">
          <FiChevronLeft onClick={() => navigate("/projects")} className="back-icon" />
          <span onClick={() => navigate("/projects")}>Home</span> / <span>{project?.name || "Project"}</span>
        </div>
        <nav className="main-nav">
          <a href="#fly" className="active">Fly</a>
          <a href="#upload">Upload</a>
          <a href="#explore">Explore</a>
          <a href="#report">Report</a>
        </nav>
        <div className="header-actions">
          <Button type="primary" icon={<FiSave />} onClick={handleSave} loading={isSaving} disabled={!hasUnsavedChanges && !isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="page-body-container">
        <div className="left-panel">
          <div className="panel-section stats-grid">
            <div><span>{calculatedStats.minutes}</span><p>Minutes</p></div>
            <div><span>{calculatedStats.acres}</span><p>Acres</p></div>
            <div><span>{calculatedStats.images}</span><p>Images</p></div>
            <div><span>{calculatedStats.battery}</span><p>Battery</p></div>
          </div>

          <div className="panel-section">
            <div className="section-title"><FaPlane /><h4>Flight Altitude</h4></div>
            <div className="altitude-slider-container">
                <input type="range" min="30" max="500" value={mission.flightAltitude} className="slider" onChange={(e) => { setMission(m => ({...m, flightAltitude: parseInt(e.target.value, 10)})); setHasUnsavedChanges(true); }}/>
                <input type="number" value={mission.flightAltitude} className="altitude-input" onChange={(e) => { setMission(m => ({...m, flightAltitude: parseInt(e.target.value, 10) || 30})); setHasUnsavedChanges(true); }}/>
                <span>ft</span>
            </div>
          </div>
          
          <div className="panel-section toggle-section">
            <div className="section-title"><FaCube /><h4 className="icon-title">Enhanced 3D</h4><FiInfo /></div>
            <Switch checked={mission.enhanced3d} onChange={(val) => { setMission(m => ({...m, enhanced3d: val})); setHasUnsavedChanges(true); }} />
          </div>

          <div className="panel-footer">
            {isFlying ? (
              <Button type="primary" danger size="large" icon={<FiStopCircle />} onClick={handleStopMission} block>
                Stop Simulation
              </Button>
            ) : (
              <Button type="primary" size="large" icon={<FaPaperPlane />} onClick={handleFlyMission} disabled={hasUnsavedChanges} block style={{ background: '#28a745', borderColor: '#28a745' }}>
                Fly Mission
              </Button>
            )}
            {hasUnsavedChanges && <p className="section-sub-text warning-text" style={{ textAlign: 'center', marginTop: '8px' }}>Save changes to enable flight.</p>}
          </div>
        </div>

        <div className="main-content">
          <InteractiveMap
            project={project}
            vertices={vertices}
            flightAngle={flightAngle}
            flightSpacing={calculatedStats.spacing}
            enhanced3d={mission.enhanced3d}
            isInteracting={isInteracting}
            onVerticesChange={handleVerticesChange}
            onInteractionStart={() => setIsInteracting(true)}
            onInteractionEnd={() => setIsInteracting(false)}
            whenCreated={setMapInstance}
          >
            {isFlying && <DroneMarker position={dronePosition} />}
          </InteractiveMap>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;