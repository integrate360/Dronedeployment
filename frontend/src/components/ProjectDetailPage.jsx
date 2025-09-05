// frontend/src/components/ProjectDetailPage.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Switch, Button, Spin } from "antd";
import { FiChevronLeft, FiInfo, FiSave, FiStopCircle, FiAlertTriangle } from "react-icons/fi";
import { FaPlane, FaCube, FaPaperPlane } from "react-icons/fa";
import * as turf from "@turf/turf";
import api from "../apis/config";

import InteractiveMap from '../components/InteractiveMap';

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
  
  // Map component reference for controlling simulation
  const mapComponentRef = useRef(null);

  // Map interaction control functions
  const disableMapInteraction = useCallback((map) => {
    if (!map) return;
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
  }, []);

  const enableMapInteraction = useCallback((map) => {
    if (!map) return;
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
  }, []);
  
  // Handle simulation state changes from the map component
  const handleSimulationStateChange = useCallback((flying) => {
    setIsFlying(flying);
    if (flying) {
      disableMapInteraction(mapInstance);
      toast.info("Mission started - map interaction disabled");
    } else {
      enableMapInteraction(mapInstance);
      toast.info("Mission ended - map interaction enabled");
    }
  }, [mapInstance, disableMapInteraction, enableMapInteraction]);

  // Data fetching
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
          flightAltitude: details.flightAltitude || 100,
          enhanced3d: details.enhanced3d || false,
        });
        
        const existingVertices = geoJsonToVertices(details.flightPath);
        if (existingVertices.length > 0) {
          setVertices(existingVertices);
        } else {
          const defaultVertices = createDefaultSquare(
            currentProject.latitude, 
            currentProject.longitude, 
            300 // Larger default area
          );
          setVertices(defaultVertices);
          setHasUnsavedChanges(true);
        }
        
        setFlightAngle(details.flightPathAngle || 0);
        
      } catch (error) {
        console.error("Data fetch error:", error);
        toast.error("Failed to fetch project data. Please try again.");
      } finally {
        setLoading(false);
        setHasUnsavedChanges(false);
      }
    };
    
    fetchProjectData();
  }, [projectId, navigate]);

  // GeoJSON conversion functions
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

  // Save project details
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

  // Mission control functions
  const handleFlyMission = useCallback(() => {
    if (hasUnsavedChanges) {
      toast.warn("Please save your changes before starting the mission.");
      return;
    }
    
    if (vertices.length < 3) {
      toast.error("Please define a valid flight area with at least 3 points.");
      return;
    }
    
    const missionData = {
      altitude: mission.flightAltitude,
      waypoints: vertices.map(v => ({ lat: v[0], lng: v[1] })),
      enhanced3d: mission.enhanced3d,
      flight_speed: 10, // m/s
      photo_interval: 2.0 // seconds
    };
    
    // Start mission through map component
    mapComponentRef.current?.startMission(missionData);
  }, [hasUnsavedChanges, vertices, mission]);

  const handleStopMission = useCallback(() => {
    mapComponentRef.current?.stopMission();
  }, []);

  const handleEmergencyLand = useCallback(() => {
    mapComponentRef.current?.emergencyLand();
  }, []);

  // Handle vertices changes
  const handleVerticesChange = useCallback((newVertices) => {
    setVertices(newVertices);
    setHasUnsavedChanges(true);
  }, []);

  // Calculate flight statistics
  const calculatedStats = useMemo(() => {
    const flightPath = verticesToGeoJson(vertices);
    
    if (!flightPath || !mission) {
      return { 
        minutes: "0:00", 
        acres: 0, 
        images: 0, 
        battery: 0, 
        resolution: 0, 
        spacing: 20,
        estimatedDistance: 0
      };
    }

    const areaMeters = turf.area(flightPath);
    const acres = parseFloat((areaMeters / 4046.86).toFixed(1));
    const altitude = mission.flightAltitude > 0 ? mission.flightAltitude : 1;
    
    // More accurate calculations
    const resolution = (altitude / 285).toFixed(1); // cm/pixel
    const spacing = Math.round((altitude * 0.3048) * 0.2); // meters
    
    // Enhanced 3D doubles the coverage
    const flightMultiplier = mission.enhanced3d ? 2 : 1;
    
    // Base images calculation (more realistic)
    const groundSampleDistance = altitude * 0.3048 * 0.00165; // GSD in meters
    const imageFootprint = Math.pow(groundSampleDistance * 4000, 2); // 4000x4000 sensor
    const overlap = 0.8; // 80% overlap
    const effectiveArea = imageFootprint * (1 - overlap);
    const baseImages = Math.ceil(areaMeters / effectiveArea);
    const images = baseImages * flightMultiplier;
    
    // Flight time estimation
    const perimeterLength = turf.length(turf.polygonToLine(flightPath), { units: 'meters' });
    const gridLines = Math.ceil(Math.sqrt(areaMeters) / spacing);
    const estimatedDistance = gridLines * Math.sqrt(areaMeters) * flightMultiplier;
    
    const flightTimeSeconds = estimatedDistance / 10; // 10 m/s flight speed
    const setupTime = 60; // 1 minute setup
    const totalSeconds = Math.round(flightTimeSeconds + setupTime);
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    
    // Battery calculation (assume 20-minute flight time per battery)
    const battery = Math.ceil(totalSeconds / (20 * 60));

    return { 
      minutes: `${minutes}:${seconds}`, 
      acres, 
      images, 
      battery, 
      resolution, 
      spacing,
      estimatedDistance: Math.round(estimatedDistance)
    };
  }, [vertices, mission, verticesToGeoJson]);

  if (loading || !mission || !project) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <p>Loading project data...</p>
      </div>
    );
  }

  return (
    <div className="project-detail-container">
      <header className="main-header">
        <div className="breadcrumbs">
          <FiChevronLeft 
            onClick={() => navigate("/projects")} 
            className="back-icon" 
          />
          <span>Home</span> / <span>{project?.name || "Project"}</span>
        </div>
        
        <nav className="main-nav">
          <a href="#fly" className="active">Fly</a>
          <a href="#upload">Upload</a>
          <a href="#explore">Explore</a>
          <a href="#report">Report</a>
        </nav>
        
        <div className="header-actions">
          <Button 
            type="primary" 
            icon={<FiSave />} 
            onClick={handleSave} 
            loading={isSaving} 
            disabled={!hasUnsavedChanges && !isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="page-body-container">
        <div className="left-panel">
          {/* Flight Statistics */}
          <div className="panel-section stats-grid">
            <div>
              <span>{calculatedStats.minutes}</span>
              <p>Est. Time</p>
            </div>
            <div>
              <span>{calculatedStats.acres}</span>
              <p>Acres</p>
            </div>
            <div>
              <span>{calculatedStats.images}</span>
              <p>Images</p>
            </div>
            <div>
              <span>{calculatedStats.battery}</span>
              <p>Batteries</p>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="panel-section">
            <div className="section-title">
              <h4>Flight Details</h4>
            </div>
            <div className="flight-details">
              <div className="detail-row">
                <span>Resolution:</span>
                <span>{calculatedStats.resolution} cm/px</span>
              </div>
              <div className="detail-row">
                <span>Grid Spacing:</span>
                <span>{calculatedStats.spacing}m</span>
              </div>
              <div className="detail-row">
                <span>Est. Distance:</span>
                <span>{calculatedStats.estimatedDistance}m</span>
              </div>
            </div>
          </div>

          {/* Flight Altitude Control */}
          <div className="panel-section">
            <div className="section-title">
              <FaPlane />
              <h4>Flight Altitude</h4>
            </div>
            <div className="altitude-slider-container">
              <input 
                type="range" 
                min="30" 
                max="500" 
                value={mission.flightAltitude} 
                className="slider" 
                onChange={(e) => { 
                  setMission(m => ({
                    ...m, 
                    flightAltitude: parseInt(e.target.value, 10)
                  })); 
                  setHasUnsavedChanges(true); 
                }}
                disabled={isFlying}
              />
              <input 
                type="number" 
                value={mission.flightAltitude} 
                className="altitude-input" 
                min="30"
                max="500"
                onChange={(e) => { 
                  const value = parseInt(e.target.value, 10);
                  if (value >= 30 && value <= 500) {
                    setMission(m => ({
                      ...m, 
                      flightAltitude: value
                    })); 
                    setHasUnsavedChanges(true); 
                  }
                }}
                disabled={isFlying}
              />
              <span>ft</span>
            </div>
          </div>

          {/* Enhanced 3D Toggle */}
          <div className="panel-section toggle-section">
            <div className="section-title">
              <FaCube />
              <h4 className="icon-title">Enhanced 3D</h4>
              <FiInfo />
            </div>
            <div className="toggle-description">
              <p>Captures perpendicular flight paths for better 3D reconstruction</p>
            </div>
            <Switch 
              checked={mission.enhanced3d} 
              onChange={(val) => { 
                setMission(m => ({...m, enhanced3d: val})); 
                setHasUnsavedChanges(true); 
              }}
              disabled={isFlying}
            />
          </div>

          {/* Mission Controls */}
          <div className="panel-footer">
            {isFlying ? (
              <div className="mission-controls">
                <Button 
                  type="primary" 
                  danger 
                  size="large" 
                  icon={<FiStopCircle />} 
                  onClick={handleStopMission} 
                  block
                  style={{ marginBottom: '8px' }}
                >
                  Stop Mission
                </Button>
                <Button 
                  type="default" 
                  danger 
                  size="small" 
                  icon={<FiAlertTriangle />} 
                  onClick={handleEmergencyLand} 
                  block
                >
                  Emergency Land
                </Button>
              </div>
            ) : (
              <Button 
                type="primary" 
                size="large" 
                icon={<FaPaperPlane />} 
                onClick={handleFlyMission} 
                disabled={hasUnsavedChanges || vertices.length < 3} 
                block
                style={{ 
                  background: hasUnsavedChanges ? undefined : '#28a745', 
                  borderColor: hasUnsavedChanges ? undefined : '#28a745' 
                }}
              >
                {hasUnsavedChanges ? 'Save Changes First' : 'Start Mission'}
              </Button>
            )}
            
            {hasUnsavedChanges && (
              <p className="section-sub-text warning-text" style={{ 
                textAlign: 'center', 
                marginTop: '8px',
                color: '#ff6b35'
              }}>
                Save changes to enable flight simulation
              </p>
            )}
          </div>
        </div>

        <div className="main-content">
          <InteractiveMap
            ref={mapComponentRef}
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
            onSimulationStateChange={handleSimulationStateChange}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;