import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Switch,
  Button,
  Spin,
  Modal,
  Select,
} from "antd";
import {
  FiMap,
  FiChevronRight,
  FiHelpCircle,
  FiInfo,
  FiChevronLeft,
  FiArrowLeft,
  FiShare2,
  FiUpload,
  FiSettings,
  FiBell,
  FiCheckSquare,
  FiSave,
} from "react-icons/fi";
import {
  MdOutlineGpsFixed,
  MdSensors,
} from "react-icons/md";
import {
  FaPlane,
  FaCube,
  FaPhotoVideo,
  FaSatelliteDish,
  FaCloudDownloadAlt,
  FaCloudUploadAlt,
} from "react-icons/fa";
import * as turf from "@turf/turf";
import api from "../apis/config";

import L from "leaflet";
import leafletImage from 'leaflet-image'; // MODIFICATION: Import leaflet-image
import InteractiveMap from '../components/InteractiveMap';
import DrawingControls from '../components/DrawingControls';

import "leaflet/dist/leaflet.css";
import "../styles/ProjectDetailPage.css";

// --- Advanced Settings Panel (can be in its own file or here) ---
const AdvancedSettingsPanel = ({ mission, stats, onClose, onSettingChange }) => {
    // This component's code remains unchanged.
    return (<div>Advanced Settings Panel</div>);
};


// --- Main Page Component ---
const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  
  // MODIFICATION: Add state to hold the map instance
  const [mapInstance, setMapInstance] = useState(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [vertices, setVertices] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [flightAngle, setFlightAngle] = useState(0);

  const geoJsonToVertices = useCallback((flightPath) => {
    if (flightPath && flightPath.coordinates && flightPath.coordinates[0]) {
      const coords = flightPath.coordinates[0];
      return coords.slice(0, coords.length - 1).map(p => [p[1], p[0]]);
    }
    return [];
  }, []);

  const verticesToGeoJson = useCallback((verts) => {
    if (verts.length < 3) return null;
    const geoJsonCoords = verts.map(p => [p[1], p[0]]);
    geoJsonCoords.push(geoJsonCoords[0]);
    return { type: 'Polygon', coordinates: [geoJsonCoords] };
  }, []);
  
  useEffect(() => {
    const fetchProjectData = async () => {
      setLoading(true);
      try {
        const projectsResponse = await api.get("/projects");
        const currentProject = projectsResponse.data.find((p) => p._id === projectId);
        if (!currentProject) { toast.error("Project not found."); navigate("/projects"); return; }
        setProject(currentProject);
        
        const detailsResponse = await api.get(`/project-details/${projectId}`);
        const details = detailsResponse.data;
        
        setMission({
          id: details._id, name: "Map Plan", flightAltitude: details.flightAltitude,
          enhanced3d: details.enhanced3d, liveMapHd: details.liveMapHd, rtkCoverage: details.rtkCoverage,
          flightPath: details.flightPath,
          flightPathAngle: details.flightPathAngle,
          advancedSettings: { automatic: true, obstacleAvoidance: true, showExistingMap: true, showGCPs: false, liveMapNoTurn: false, lowLight: false, manualExposure: false, manualFocus: false, planningCamera: "Mavic 3 Enterprise Camera" },
        });
        setVertices(geoJsonToVertices(details.flightPath));
        setFlightAngle(details.flightPathAngle || 0);
      } catch (error) {
        console.error("Data fetch error:", error);
        toast.error("Failed to fetch project data.");
        navigate("/projects");
      } finally {
        setLoading(false);
      }
    };
    fetchProjectData();
  }, [projectId, navigate, geoJsonToVertices]);

  const handleNavigate = useCallback((path) => {
    if (hasUnsavedChanges) {
      if (window.confirm("You have unsaved changes that will be lost. Are you sure you want to leave?")) {
        navigate(path);
      }
    } else {
      navigate(path);
    }
  }, [hasUnsavedChanges, navigate]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);


  // --- MODIFICATION: Updated Save Handler to include thumbnail generation ---
  const handleSave = useCallback(async () => {
    if (!mission || isSaving) return;
    setIsSaving(true);
    setIsDrawing(false);
    toast.info("Saving project details...");

    try {
      // --- Part 1: Save Project Details (flight path, angle, etc.) ---
      const flightPath = verticesToGeoJson(vertices);
      const dataToSave = {
        flightAltitude: mission.flightAltitude,
        enhanced3d: mission.enhanced3d,
        liveMapHd: mission.liveMapHd,
        rtkCoverage: mission.rtkCoverage,
        flightPath: flightPath,
        flightPathAngle: flightAngle,
      };
      
      const detailsResponse = await api.put(`/project-details/${projectId}`, dataToSave);
      setMission(prev => ({...prev, flightPath: detailsResponse.data.flightPath, flightPathAngle: detailsResponse.data.flightPathAngle}));
      setVertices(geoJsonToVertices(detailsResponse.data.flightPath));
      setFlightAngle(detailsResponse.data.flightPathAngle || 0);

      // --- Part 2: Generate and Save Thumbnail ---
      if (mapInstance && vertices.length > 0) {
        await new Promise(resolve => {
            const bounds = L.latLngBounds(vertices);
            
            mapInstance.once('moveend zoomend', () => {
                leafletImage(mapInstance, (err, canvas) => {
                    if (err) {
                        console.error("Could not create thumbnail:", err);
                        resolve(); // Resolve anyway, main save succeeded
                        return;
                    }
                    const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
                    
                    // Send thumbnail to the main project endpoint
                    api.put(`/projects/${projectId}`, { thumbnail })
                        .then(() => console.log("Thumbnail updated successfully."))
                        .catch(thumbErr => console.error("Failed to update thumbnail:", thumbErr));
                    
                    resolve();
                });
            });

            // Fit the map to the polygon bounds with some padding
            mapInstance.fitBounds(bounds, { padding: [50, 50] });
        });
      }

      setHasUnsavedChanges(false);
      toast.success("Project saved successfully!");

    } catch (error) {
      toast.error("Failed to save project details.");
    } finally {
      setIsSaving(false);
    }
  }, [mission, isSaving, vertices, flightAngle, projectId, mapInstance, verticesToGeoJson, geoJsonToVertices]);

  const handleMissionChange = (key, value) => {
    setMission((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };
  
  const handleAdvancedSettingChange = (key, value) => {
    setMission(prev => ({ ...prev, advancedSettings: { ...prev.advancedSettings, [key]: value } }));
  };

  const handleClearFlightPath = () => {
      if (vertices.length > 0) {
          setVertices([]);
          setHasUnsavedChanges(true);
      }
      setIsDrawing(false);
  };
  
  const calculatedStats = useMemo(() => {
      const flightPath = verticesToGeoJson(vertices);
      if (!flightPath) return { minutes: "0:00", acres: 0, images: 0, battery: 0 };
      const areaMeters = turf.area(flightPath);
      const acres = parseFloat((areaMeters / 4046.86).toFixed(0));
      const images = Math.round(acres * 22);
      const totalSeconds = acres * 45;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = (totalSeconds % 60).toString().padStart(2, "0");
      const battery = Math.ceil((minutes * 60 + parseInt(seconds)) / (20 * 60));
      return { minutes: `${minutes}:${seconds}`, acres, images, battery };
  }, [vertices, verticesToGeoJson]);

  if (loading || !mission || !project) {
    return <div className="loading-container"><Spin size="large" /></div>;
  }

  return (
    <div className="project-detail-container">
      <header className="main-header">
        <div className="breadcrumbs">
          <FiChevronLeft onClick={() => handleNavigate("/projects")} className="back-icon" />
          <span onClick={() => handleNavigate("/projects")}>Home</span> /{" "}
          <span>{project?.name || "Project"}</span>
        </div>
        <nav className="main-nav">
          <a href="#fly" className="active">Fly</a>
          <a href="#upload">Upload</a>
          <a href="#explore">Explore</a>
          <a href="#report">Report</a>
        </nav>
        <div className="header-actions">
          <Button type="primary" icon={<FiSave />} onClick={handleSave} loading={isSaving} disabled={!hasUnsavedChanges}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button type="default" icon={<FiShare2 />}>Share</Button>
          <Button icon={<FiUpload />} />
          <Button icon={<FiSettings />} />
          <Button icon={<FiBell />} />
        </div>
      </header>

      <div className="page-body-container">
        <div className="left-panel">
          {isAdvancedSettingsOpen ? (
            <AdvancedSettingsPanel
              mission={mission}
              stats={calculatedStats}
              onClose={() => setIsAdvancedSettingsOpen(false)}
              onSettingChange={handleAdvancedSettingChange}
            />
          ) : (
            <>
              <div className="panel-section capture-plan-section">
                <p className="section-super-title">Capture Plan</p>
                <div className="plan-selector-row">
                    <Button className="plan-selector-btn">
                      <FiMap />
                      <span>{mission.name}</span>
                    </Button>
                </div>
              </div>
              <div className="panel-section stats-grid">
                <div>
                  <span>{calculatedStats.minutes}</span>
                  <p>Minutes</p>
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
                  <p>Battery</p>
                </div>
              </div>

              <DrawingControls 
                isDrawing={isDrawing}
                onToggleDrawing={setIsDrawing}
                onClear={handleClearFlightPath}
                hasFlightPath={vertices.length > 0}
              />
              
              <div className="panel-section">
                <div className="section-title">
                  <h4>Flight Direction</h4>
                </div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  value={flightAngle}
                  className="slider"
                  onChange={(e) => {
                    setFlightAngle(parseInt(e.target.value, 10));
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>

              <div className="panel-section">
                <div className="section-title">
                  <FaPlane />
                  <h4>Flight Altitude</h4>
                </div>
                <p className="section-sub-text">Travel Altitude: 210 ft</p>
                <div className="altitude-control">
                  <Button shape="circle" icon={<MdOutlineGpsFixed />} />
                  <input
                    type="number"
                    value={mission.flightAltitude}
                    onChange={(e) =>
                      handleMissionChange("flightAltitude", parseInt(e.target.value) || 0)
                    }
                  />
                  <span>ft</span>
                </div>
              </div>
              <div className="panel-section toggle-section">
                <div className="section-title">
                  <FaCube />
                  <h4 className="icon-title">Enhanced 3D</h4>
                  <FiInfo />
                </div>
                <Switch
                  checked={mission.enhanced3d}
                  onChange={(val) => handleMissionChange("enhanced3d", val)}
                />
              </div>
              <div className="panel-section toggle-section">
                <div className="section-title">
                  <FaPhotoVideo />
                  <h4 className="icon-title">Live Map HD</h4>
                  <FiInfo />
                </div>
                <Switch
                  checked={mission.liveMapHd}
                  onChange={(val) => handleMissionChange("liveMapHd", val)}
                />
              </div>
              <div className="panel-section link-section" onClick={() => setIsAdvancedSettingsOpen(true)}>
                <div className="section-title">
                  <FiSettings />
                  <h4 className="icon-title">Advanced</h4>
                </div>
                <FiChevronRight />
              </div>
              <div className="panel-section toggle-section no-border">
                <div className="section-title">
                  <FaSatelliteDish />
                  <h4 className="icon-title">RTK Coverage</h4>
                  <FiInfo />
                </div>
                <div className={`rtk-status ${mission.rtkCoverage ? "active" : ""}`}></div>
              </div>
              <div className="panel-section button-section">
                <div className="section-title">
                  <FaCloudDownloadAlt />
                  <h4 className="icon-title">Data On Demand</h4>
                  <FiInfo />
                </div>
                <Button>Request</Button>
              </div>
              <div className="panel-section button-section">
                <div className="section-title">
                  <FaCloudUploadAlt />
                  <h4 className="icon-title">Import Flight Path</h4>
                  <FiInfo />
                </div>
                <Button>Import</Button>
              </div>
              <div className="panel-footer">
                 <p>
                  Don't own a drone? <a href="#simulator">Test the simulator</a>
                </p>
                <Button type="text" icon={<FiHelpCircle />}>
                  Help
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="main-content">
          <InteractiveMap
            project={project}
            vertices={vertices}
            isDrawing={isDrawing}
            flightAngle={flightAngle}
            onVerticesChange={setVertices}
            onDrawingChange={setIsDrawing}
            onInteraction={() => setHasUnsavedChanges(true)}
            whenCreated={setMapInstance} 
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;