// frontend/src/pages/ProjectDetailPage.jsx
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
} from "antd";
import {
  FiMap,
  FiChevronLeft,
  FiHelpCircle,
  FiInfo,
  FiShare2,
  FiUpload,
  FiSettings,
  FiBell,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import { FaPlane, FaCube, FaPhotoVideo, FaSatelliteDish, FaCloudDownloadAlt, FaCloudUploadAlt } from "react-icons/fa";
import * as turf from "@turf/turf";
import api from "../apis/config";

import L from "leaflet";
import leafletImage from 'leaflet-image';

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
  const [mapInstance, setMapInstance] = useState(null);

  const [vertices, setVertices] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [flightAngle, setFlightAngle] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);


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
          id: details._id, name: "Map Plan",
          flightAltitude: details.flightAltitude,
          enhanced3d: details.enhanced3d,
          liveMapHd: details.liveMapHd,
          rtkCoverage: details.rtkCoverage,
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

  const geoJsonToVertices = useCallback((flightPath) => {
    if (flightPath && flightPath.coordinates && flightPath.coordinates[0] && flightPath.coordinates[0].length > 3) {
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

  const handleSave = useCallback(async () => {
    if (!mission || isSaving) return;
    setIsSaving(true);
    toast.info("Saving project details...");

    try {
      const flightPath = verticesToGeoJson(vertices);
      const dataToSave = {
        flightAltitude: mission.flightAltitude,
        enhanced3d: mission.enhanced3d,
        liveMapHd: mission.liveMapHd,
        flightPath: flightPath,
        flightPathAngle: flightAngle,
      };
      await api.put(`/project-details/${projectId}`, dataToSave);

      if (mapInstance && vertices.length > 0) {
        await new Promise(resolve => {
          const bounds = L.latLngBounds(vertices);
          mapInstance.fitBounds(bounds, { padding: [50, 50] });

          mapInstance.once('moveend zoomend', () => {
            leafletImage(mapInstance, (err, canvas) => {
              if (err) {
                console.error("Could not create thumbnail:", err);
                resolve();
                return;
              }
              const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
              api.put(`/projects/${projectId}`, { thumbnail })
                .then(() => console.log("Thumbnail updated successfully."))
                .catch(thumbErr => console.error("Failed to update thumbnail:", thumbErr))
                .finally(resolve);
            });
          });
        });
      }

      setHasUnsavedChanges(false);
      toast.success("Project saved successfully!");

    } catch (error) {
      toast.error("Failed to save project details. Please try again.");
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [mission, isSaving, vertices, flightAngle, projectId, mapInstance, verticesToGeoJson]);

  const handleFlightAngleChange = (newAngle) => {
    setFlightAngle(newAngle);
    setHasUnsavedChanges(true);
  };

  const handleMissionChange = (key, value) => {
    setMission((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleVerticesChange = (newVertices) => {
    setVertices(newVertices);
    setHasUnsavedChanges(true);
  }

  const handleClearFlightPath = () => {
    if (window.confirm("Are you sure you want to clear the flight path and reset to the default square?")) {
      const defaultVertices = createDefaultSquare(project.latitude, project.longitude);
      setVertices(defaultVertices);
      setHasUnsavedChanges(true);
    }
  };

  const calculatedStats = useMemo(() => {
    const flightPath = verticesToGeoJson(vertices);
    if (!flightPath || !mission) {
      return { minutes: "0:00", acres: 0, images: 0, battery: 0, resolution: 0, spacing: 20 };
    }
    const areaMeters = turf.area(flightPath);
    const acres = parseFloat((areaMeters / 4046.86).toFixed(0));
    const altitude = mission.flightAltitude > 0 ? mission.flightAltitude : 1;
    const resolution = (altitude / 285).toFixed(1);
    const spacing = altitude * 0.2;

    // --- MODIFIED: Adjust calculations for Enhanced 3D ---
    const flightMultiplier = mission.enhanced3d ? 2 : 1;
    const baseImages = Math.round(acres * 18 * Math.pow(200 / altitude, 2));
    const images = baseImages * flightMultiplier; // Double the images for the crosshatch pattern

    const totalSeconds = Math.round(images * 1.7);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    const battery = Math.ceil(totalSeconds / (20 * 60));

    return {
      minutes: `${minutes}:${seconds}`, acres, images, battery, resolution, spacing
    };
  }, [vertices, mission, verticesToGeoJson]);

  const AltitudeWarning = () => {
    if (!mission) return null;
    if (mission.flightAltitude < 100) {
      return <p className="section-sub-text warning-text">Warning: Low Altitude</p>;
    }
    if (calculatedStats.resolution > 1.0) {
      return <p className="section-sub-text suggestion-text">Suggested: &lt; 200ft</p>;
    }
    return null;
  };

  if (loading || !mission || !project) {
    return <div className="loading-container"><Spin size="large" /></div>;
  }

  return (
    <div className="project-detail-container">
      <header className="main-header">
        <div className="breadcrumbs">
          <FiChevronLeft onClick={() => navigate("/projects")} className="back-icon" />
          <span onClick={() => navigate("/projects")}>Home</span> /{" "}
          <span>{project?.name || "Project"}</span>
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
          <Button type="default" icon={<FiShare2 />}>Share</Button>
          <Button icon={<FiUpload />} />
          <Button icon={<FiSettings />} />
          <Button icon={<FiBell />} />
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

          <div className="panel-section drawing-controls">
            <div className="section-title">
              <h4>Flight Path</h4>
            </div>
            <p className="section-sub-text">
              Click an edge to add a point. Click a point to remove it. Drag handles to move or rotate.
            </p>
            <div className="drawing-buttons">
              <Button
                danger
                type="text"
                icon={<FiTrash2 />}
                onClick={handleClearFlightPath}
                disabled={vertices.length === 0}
              >
                Reset Area
              </Button>
            </div>
          </div>

          <div className="panel-section">
            <div className="section-title"><h4>Flight Direction</h4></div>
            <input type="range" min="0" max="360" value={flightAngle} className="slider"
              onChange={(e) => handleFlightAngleChange(parseInt(e.target.value, 10))}
            />
          </div>

          <div className="panel-section">
            <div className="section-title"><FaPlane /><h4>Flight Altitude</h4></div>
            <div className="altitude-slider-container">
              <input
                type="range" min="30" max="500"
                value={mission.flightAltitude}
                className="slider"
                onChange={(e) => handleMissionChange("flightAltitude", parseInt(e.target.value, 10))}
              />
              <input
                type="number"
                value={mission.flightAltitude}
                className="altitude-input"
                onChange={(e) => handleMissionChange("flightAltitude", parseInt(e.target.value, 10) || 30)}
              />
              <span>ft</span>
            </div>
            <p className="section-sub-text">Resolution: {calculatedStats.resolution} in / px</p>
            <AltitudeWarning />
          </div>

          <div className="panel-section toggle-section">
            <div className="section-title"><FaCube /><h4 className="icon-title">Enhanced 3D</h4><FiInfo /></div>
            <Switch checked={mission.enhanced3d} onChange={(val) => handleMissionChange("enhanced3d", val)} />
          </div>

          <div className="panel-footer">
            <p><a href="#simulator">Test this with the simulation</a></p>
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
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;