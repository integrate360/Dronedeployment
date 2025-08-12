import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Switch,
  Slider,
  Button,
  Spin,
  Dropdown,
  Menu,
  Modal,
  Select,
} from "antd";
import {
  FiMap,
  FiMoreVertical,
  FiEdit,
  FiCopy,
  FiTrash2,
  FiPlus,
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
} from "react-icons/fi";
import {
  MdOutlineGpsFixed,
  MdOutlineScreenshotMonitor,
  MdVideocam,
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

// Leaflet and plugins
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Polygon,
  Marker,
  Tooltip,
  LayersControl,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import leafletImage from "leaflet-image";

// Import Leaflet's CSS
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "../styles/ProjectDetailPage.css";

// Helper function to swap coordinates for Leaflet's [lat, lng] format
const swapCoords = (coords) => {
  return coords.map((ring) => ring.map((p) => [p[1], p[0]]));
};

// Fix for a known issue with leaflet-draw icons in Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// --- Advanced Settings Panel (Sub-Component) ---
const AdvancedSettingsPanel = ({
  mission,
  stats,
  onClose,
  onSettingChange,
}) => {
  const { Option } = Select;

  return (
    <div className="advanced-settings-panel">
      <div className="advanced-settings-header">
        <Button
          type="text"
          icon={<FiArrowLeft />}
          onClick={onClose}
          className="back-btn"
        />
        <h3>Advanced Settings</h3>
      </div>
      <div className="panel-section stats-grid">
        <div>
          <span>{stats.minutes}</span>
          <p>Minutes</p>
        </div>
        <div>
          <span>{stats.acres}</span>
          <p>Acres</p>
        </div>
        <div>
          <span>{stats.images}</span>
          <p>Images</p>
        </div>
        <div>
          <span>{stats.battery}</span>
          <p>Battery</p>
        </div>
      </div>
      <div className="panel-section">
        <div className="toggle-section large">
          <h4>Automatic Settings</h4>
          <Switch
            checked={mission.advancedSettings.automatic}
            onChange={(val) => onSettingChange("automatic", val)}
          />
        </div>
        <p className="section-sub-text full">
          Currently 75% front overlap, 70% side overlap, with optimized speed,
          direction, and 3D capture.
        </p>
      </div>
      <div className="panel-section toggle-section">
        <div className="section-title">
          <MdSensors />
          <h4 className="icon-title">Obstacle Avoidance</h4>
          <FiInfo />
        </div>
        <Switch
          checked={mission.advancedSettings.obstacleAvoidance}
          onChange={(val) => onSettingChange("obstacleAvoidance", val)}
        />
      </div>
      <div className="panel-section toggle-section">
        <div className="section-title">
          <h4>Show Existing Map</h4>
        </div>
        <Switch
          checked={mission.advancedSettings.showExistingMap}
          onChange={(val) => onSettingChange("showExistingMap", val)}
        />
      </div>
      <div className="panel-section toggle-section">
        <div className="section-title">
          <FiCheckSquare />
          <h4 className="icon-title">Show Project GCPs</h4>
          <FiInfo />
        </div>
        <Switch
          checked={mission.advancedSettings.showGCPs}
          onChange={(val) => onSettingChange("showGCPs", val)}
        />
      </div>
      <div className="panel-section toggle-section">
        <div className="section-title">
          <h4>Live Map No-Turn</h4>
          <FiInfo />
        </div>
        <Switch
          checked={mission.advancedSettings.liveMapNoTurn}
          onChange={(val) => onSettingChange("liveMapNoTurn", val)}
        />
      </div>
      <div className="panel-section toggle-section">
        <div className="section-title">
          <h4>Low Light</h4>
          <FiInfo />
        </div>
        <Switch
          checked={mission.advancedSettings.lowLight}
          onChange={(val) => onSettingChange("lowLight", val)}
        />
      </div>
      <div className="panel-section toggle-section">
        <div className="section-title">
          <h4>Manual Exposure in DJI app</h4>
        </div>
        <Switch
          checked={mission.advancedSettings.manualExposure}
          onChange={(val) => onSettingChange("manualExposure", val)}
        />
      </div>
      <div className="panel-section toggle-section no-border">
        <div className="section-title">
          <h4>Manual Focus in DJI app</h4>
        </div>
        <Switch
          checked={mission.advancedSettings.manualFocus}
          onChange={(val) => onSettingChange("manualFocus", val)}
        />
      </div>
      <div className="panel-section">
        <div className="section-title">
          <h4>Planning Camera</h4>
          <FiInfo />
        </div>
        <Select
          defaultValue={mission.advancedSettings.planningCamera}
          style={{ width: "100%" }}
          onChange={(val) => onSettingChange("planningCamera", val)}
        >
          <Option value="Mavic 3 Enterprise Camera">
            Mavic 3 Enterprise Camera
          </Option>
          <Option value="Mavic 3 Thermal Camera">Mavic 3 Thermal Camera</Option>
          <Option value="Matrice 4 Enterprise Camera">
            Matrice 4 Enterprise Camera
          </Option>
          <Option value="Matrice 4 Thermal Camera">
            Matrice 4 Thermal Camera
          </Option>
          <Option value="Mavic 2 Pro Camera">Mavic 2 Pro Camera</Option>
          <Option value="DJI Air 2S Camera">DJI Air 2S Camera</Option>
          <Option value="Matrice 3D Camera">Matrice 3D Camera</Option>
        </Select>
      </div>
      <div className="panel-footer">
        <Button type="text" icon={<FiHelpCircle />}>
          Help
        </Button>
      </div>
    </div>
  );
};

// --- Main Page Component ---
const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef();
  const featureGroupRef = useRef();

  const [project, setProject] = useState(null);
  const [missions, setMissions] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [polygonKey, setPolygonKey] = useState(0);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);

  const activeMission = useMemo(
    () => missions.find((m) => m.id === activeMissionId),
    [missions, activeMissionId]
  );

  useEffect(() => {
    const fetchProjectData = async () => {
      setLoading(true);
      try {
        const projectsResponse = await api.get("/projects");
        const currentProject = projectsResponse.data.find(
          (p) => p._id === projectId
        );
        setProject(currentProject);

        // SIMULATED DATA
        const mockMissions = [
          {
            id: "mission_1",
            name: "Map Plan",
            flightAltitude: 200,
            enhanced3d: true,
            liveMapHd: false,
            rtkCoverage: true,
            flightPath: {
              type: "Polygon",
              coordinates: [
                [
                  [72.77, 19.7],
                  [72.78, 19.7],
                  [72.78, 19.71],
                  [72.77, 19.71],
                  [72.77, 19.7],
                ],
              ],
            },
            advancedSettings: {
              automatic: true,
              obstacleAvoidance: true,
              showExistingMap: true,
              showGCPs: false,
              liveMapNoTurn: false,
              lowLight: false,
              manualExposure: false,
              manualFocus: false,
              planningCamera: "Mavic 3 Enterprise Camera",
            },
          },
          {
            id: "mission_2",
            name: "Map Plan 2",
            flightAltitude: 250,
            enhanced3d: false,
            liveMapHd: true,
            rtkCoverage: false,
            flightPath: null,
            advancedSettings: {
              automatic: false,
              obstacleAvoidance: true,
              showExistingMap: false,
              showGCPs: true,
              liveMapNoTurn: true,
              lowLight: false,
              manualExposure: true,
              manualFocus: false,
              planningCamera: "Mavic 2 Pro Camera",
            },
          },
        ];
        setMissions(mockMissions);
        setActiveMissionId(mockMissions[0]?.id || null);
      } catch (error) {
        toast.error("Failed to fetch project data.");
        navigate("/projects");
      } finally {
        setLoading(false);
      }
    };
    fetchProjectData();
  }, [projectId, navigate]);

  const handleMissionChange = (key, value) => {
    setMissions((prev) =>
      prev.map((m) => (m.id === activeMissionId ? { ...m, [key]: value } : m))
    );
  };

  const handleAdvancedSettingChange = (key, value) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id === activeMissionId
          ? { ...m, advancedSettings: { ...m.advancedSettings, [key]: value } }
          : m
      )
    );
  };

  const handleAddMission = () => {
    const newMission = {
      id: `mission_${Date.now()}`,
      name: `Map Plan ${missions.length + 1}`,
      flightAltitude: 200,
      enhanced3d: true,
      liveMapHd: false,
      rtkCoverage: false,
      flightPath: null,
      advancedSettings: {
        automatic: true,
        obstacleAvoidance: true,
        showExistingMap: true,
        showGCPs: false,
        liveMapNoTurn: false,
        lowLight: false,
        manualExposure: false,
        manualFocus: false,
        planningCamera: "Mavic 3 Enterprise Camera",
      },
    };
    setMissions([...missions, newMission]);
    setActiveMissionId(newMission.id);
    toast.success(`'${newMission.name}' created!`);
  };

  const handleRenameMission = (missionId, currentName) => {
    const newName = prompt("Enter new plan name:", currentName);
    if (newName && newName !== currentName) {
      setMissions(
        missions.map((m) => (m.id === missionId ? { ...m, name: newName } : m))
      );
      toast.info("Plan renamed.");
    }
  };

  const handleDeleteMission = (missionId) => {
    if (missions.length <= 1) {
      toast.error("You must have at least one flight plan.");
      return;
    }
    Modal.confirm({
      title: "Are you sure you want to delete this plan?",
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        const newMissions = missions.filter((m) => m.id !== missionId);
        setMissions(newMissions);
        setActiveMissionId(newMissions[0].id);
        toast.warn("Plan deleted.");
      },
    });
  };

  const handleSave = async () => {
    if (!activeMission) return;
    setIsSaving(true);
    try {
      if (mapRef.current) {
        leafletImage(mapRef.current, async (err, canvas) => {
          if (err) {
            toast.error("Could not create thumbnail, but details were saved.");
            setIsSaving(false);
            return;
          }
          const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
          // In a real app, you would send this to your backend
          // await api.put(`/projects/${projectId}`, { thumbnail });
          console.log(
            "Simulated save with thumbnail:",
            thumbnail.substring(0, 50) + "..."
          );
          toast.success("Project saved and thumbnail updated!");
          setIsSaving(false);
        });
      } else {
        toast.success("Project details saved!");
        setIsSaving(false);
      }
    } catch (error) {
      toast.error("Failed to save project.");
      setIsSaving(false);
    }
  };

  const onEdited = (e) => {
    const layers = e.layers.getLayers();
    if (layers.length > 0)
      handleMissionChange("flightPath", layers[0].toGeoJSON().geometry);
  };
  const onCreated = (e) => {
    if (featureGroupRef.current) featureGroupRef.current.clearLayers();
    handleMissionChange("flightPath", e.layer.toGeoJSON().geometry);
    setPolygonKey((prevKey) => prevKey + 1);
  };
  const onDeleted = () => {
    handleMissionChange("flightPath", null);
    setPolygonKey((prevKey) => prevKey + 1);
  };

  const calculatedStats = useMemo(() => {
    if (!activeMission)
      return { minutes: "0:00", acres: 0, images: 0, battery: 0 };
    if (!activeMission.flightPath)
      return { minutes: "3:49", acres: 5, images: 110, battery: 1 };
    const areaMeters = turf.area(activeMission.flightPath);
    const acres = parseFloat((areaMeters / 4046.86).toFixed(0));
    const images = Math.round(acres * 22);
    const totalSeconds = acres * 45;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    const battery = Math.ceil((minutes * 60 + parseInt(seconds)) / (20 * 60));
    return { minutes: `${minutes}:${seconds}`, acres, images, battery };
  }, [activeMission]);

  if (loading || !activeMission) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  const mapCenter = activeMission.flightPath
    ? turf.center(activeMission.flightPath).geometry.coordinates.reverse()
    : [19.7, 72.77];
  const polygonPositions = activeMission.flightPath
    ? swapCoords(activeMission.flightPath.coordinates)
    : [];

  const missionOptionsMenu = (
    <Menu>
      <Menu.Item
        key="rename"
        icon={<FiEdit />}
        onClick={() =>
          handleRenameMission(activeMission.id, activeMission.name)
        }
      >
        Rename
      </Menu.Item>
      <Menu.Item key="duplicate" icon={<FiCopy />}>
        Duplicate
      </Menu.Item>
      <Menu.Item key="photo_report" icon={<MdOutlineScreenshotMonitor />}>
        Duplicate as Photo Report
      </Menu.Item>
      <Menu.Item key="video" icon={<MdVideocam />}>
        Duplicate as Video
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item
        key="delete"
        icon={<FiTrash2 />}
        danger
        onClick={() => handleDeleteMission(activeMission.id)}
      >
        Delete
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="project-detail-container">
      <header className="main-header">
        <div className="breadcrumbs">
          <FiChevronLeft
            onClick={() => navigate("/projects")}
            className="back-icon"
          />
          <span onClick={() => navigate("/projects")}>Home</span> /{" "}
          <span>{project?.name || "Project"}</span>
        </div>
        <nav className="main-nav">
          <a href="#fly" className="active">
            Fly
          </a>
          <a href="#upload">Upload</a>
          <a href="#explore">Explore</a>
          <a href="#report">Report</a>
        </nav>
        <div className="header-actions">
          <Button type="primary" icon={<FiShare2 />}>
            Share
          </Button>
          <Button icon={<FiUpload />} />
          <Button icon={<FiSettings />} />
          <Button icon={<FiBell />} />
        </div>
      </header>

      <div className="page-body-container">
        <div className="left-panel">
          {isAdvancedSettingsOpen ? (
            <AdvancedSettingsPanel
              mission={activeMission}
              stats={calculatedStats}
              onClose={() => setIsAdvancedSettingsOpen(false)}
              onSettingChange={handleAdvancedSettingChange}
            />
          ) : (
            <>
              <div className="panel-section capture-plan-section">
                <p className="section-super-title">Capture Plan</p>
                <div className="plan-selector-row">
                  <Dropdown
                    overlay={
                      <Menu
                        onClick={(e) => setActiveMissionId(e.key)}
                        selectedKeys={[activeMissionId]}
                      >
                        {missions.map((m) => (
                          <Menu.Item key={m.id} icon={<FiMap />}>
                            {m.name}
                          </Menu.Item>
                        ))}
                      </Menu>
                    }
                    trigger={["click"]}
                  >
                    <Button className="plan-selector-btn">
                      <FiMap />
                      <span>{activeMission.name}</span>
                    </Button>
                  </Dropdown>
                  <Dropdown overlay={missionOptionsMenu} trigger={["click"]}>
                    <Button
                      className="plan-actions-btn"
                      icon={<FiMoreVertical />}
                    />
                  </Dropdown>
                  <Button
                    className="add-plan-btn"
                    type="primary"
                    shape="circle"
                    icon={<FiPlus />}
                    onClick={handleAddMission}
                  />
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
                    value={activeMission.flightAltitude}
                    onChange={(e) =>
                      handleMissionChange(
                        "flightAltitude",
                        parseInt(e.target.value) || 0
                      )
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
                  checked={activeMission.enhanced3d}
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
                  checked={activeMission.liveMapHd}
                  onChange={(val) => handleMissionChange("liveMapHd", val)}
                />
              </div>
              <div
                className="panel-section link-section"
                onClick={() => setIsAdvancedSettingsOpen(true)}
              >
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
                <div
                  className={`rtk-status ${
                    activeMission.rtkCoverage ? "active" : ""
                  }`}
                ></div>
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
          <div className="map-container">
            <MapContainer
              key={polygonKey} // polygonKey is preserved
              center={mapCenter}
              zoom={16}
              scrollWheelZoom={true}
              className="leaflet-map-container"
              ref={mapRef}
            >
              {/* --- MODIFICATION START --- */}
              <LayersControl position="topright">
                <LayersControl.BaseLayer name="Standard Map">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked name="Satellite & Labels">
                  <TileLayer
                    url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                    subdomains={["mt0", "mt1", "mt2", "mt3"]}
                    attribution="&copy; Google Maps"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Terrain">
                  <TileLayer
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                    attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              {/* --- MODIFICATION END --- */}

              <FeatureGroup ref={featureGroupRef}>
                <EditControl
                  position="topright"
                  onEdited={onEdited}
                  onCreated={onCreated}
                  onDeleted={onDeleted}
                  draw={{
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    polyline: false,
                    polygon: activeMission.flightPath
                      ? false
                      : { shapeOptions: { color: "#007cbf" } },
                  }}
                  edit={{ featureGroup: featureGroupRef.current }}
                />
                {polygonPositions.length > 0 && (
                  <Polygon
                    positions={polygonPositions}
                    pathOptions={{ color: "#007cbf" }}
                  />
                )}
                {project && (
                  <Marker
                    position={[
                      project.latitude || 19.7,
                      project.longitude || 72.77,
                    ]}
                  >
                    <Tooltip permanent direction="right" offset={[10, 0]}>
                      <strong>{project.name}</strong>
                    </Tooltip>
                  </Marker>
                )}
              </FeatureGroup>
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
