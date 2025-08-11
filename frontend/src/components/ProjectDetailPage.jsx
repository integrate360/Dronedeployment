import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Switch, Slider, Button, Spin } from 'antd';
import { FiChevronLeft, FiShare2, FiUpload, FiSettings, FiBell } from 'react-icons/fi';
import * as turf from '@turf/turf';
import api from '../apis/config';

// Leaflet and plugins
import { MapContainer, TileLayer, FeatureGroup, Polygon } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import leafletImage from 'leaflet-image';

// Import Leaflet's CSS
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../styles/ProjectDetailPage.css';

// Helper function to swap coordinates for Leaflet's [lat, lng] format
const swapCoords = (coords) => {
    return coords.map(ring => ring.map(p => [p[1], p[0]]));
};

// Fix for a known issue with leaflet-draw icons in Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});


const ProjectDetailPage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const mapRef = useRef();
    const featureGroupRef = useRef();

    const [project, setProject] = useState(null);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [polygonKey, setPolygonKey] = useState(0); // Key to force re-render of polygon

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await api.get('/projects');
                const currentProject = response.data.find(p => p._id === projectId);
                setProject(currentProject);
            } catch (error) {
                toast.error('Could not fetch project name.');
            }
        };
        fetchProject();
    }, [projectId]);

    const fetchDetails = useCallback(async () => {
        try {
            const response = await api.get(`/project-details/${projectId}`);
            setDetails(response.data);
            setPolygonKey(prevKey => prevKey + 1); // Update key on new data
        } catch (error) {
            toast.error('Failed to fetch project details.');
            navigate('/projects');
        } finally {
            setLoading(false);
        }
    }, [projectId, navigate]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const handleDetailChange = (key, value) => {
        setDetails(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!details) return;
        setIsSaving(true);
        try {
            const detailsToSave = {
                flightAltitude: details.flightAltitude,
                enhanced3d: details.enhanced3d,
                liveMapHd: details.liveMapHd,
                rtkCoverage: details.rtkCoverage,
                flightPath: details.flightPath,
            };
            await api.put(`/project-details/${projectId}`, detailsToSave);

            if (mapRef.current) {
                leafletImage(mapRef.current, async (err, canvas) => {
                    if (err) {
                        toast.error("Could not create thumbnail.");
                        setIsSaving(false);
                        return;
                    }
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
                    await api.put(`/projects/${projectId}`, { thumbnail });
                    toast.success('Project saved and thumbnail updated!');
                    fetchDetails();
                    setIsSaving(false);
                });
            } else {
                toast.success('Project details saved!');
                fetchDetails();
                setIsSaving(false);
            }

        } catch (error) {
            toast.error('Failed to save project.');
            setIsSaving(false);
        }
    };

    const onEdited = (e) => {
        const layers = e.layers.getLayers();
        if (layers.length > 0) {
            const geoJSON = layers[0].toGeoJSON().geometry;
            handleDetailChange('flightPath', geoJSON);
        }
    };

    const onCreated = (e) => {
        const { layer } = e;
        const geoJSON = layer.toGeoJSON().geometry;

        // Clear existing layers in the feature group before adding the new one
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }

        handleDetailChange('flightPath', geoJSON);
        setPolygonKey(prevKey => prevKey + 1); // Force Polygon component to re-render with new data
    };

    const onDeleted = () => {
        setDetails(prev => ({ ...prev, flightPath: null }));
    };

    const calculatedStats = useMemo(() => {
        if (!details?.flightPath) {
            return { minutes: 0, acres: 0, images: 0, battery: 0 };
        }
        const areaMeters = turf.area(details.flightPath);
        const acres = (areaMeters / 4046.86).toFixed(2);
        const images = Math.round(acres * 20);
        const minutes = (acres * 1.5).toFixed(2);
        const battery = Math.ceil(minutes / 20);
        return { minutes, acres, images, battery };
    }, [details]);

    if (loading || !details) {
        return <div className="loading-container"><Spin size="large" /></div>;
    }

    const mapCenter = details.flightPath ? turf.center(details.flightPath).geometry.coordinates.reverse() : [40.7128, -74.0060];
    const polygonPositions = details.flightPath ? swapCoords(details.flightPath.coordinates) : [];

    return (
        <div className="project-detail-container">
            <div className="left-panel">
                <div className="panel-header">
                    <h3 className="plan-title">Capture Plan</h3>
                    <div className="plan-actions">
                        <Button type="primary" shape="circle" size="large">+</Button>
                    </div>
                </div>

                <div className="stats-grid">
                    <div><span>{calculatedStats.minutes}</span><p>Minutes</p></div>
                    <div><span>{calculatedStats.acres}</span><p>Acres</p></div>
                    <div><span>{calculatedStats.images}</span><p>Images</p></div>
                    <div><span>{calculatedStats.battery}</span><p>Battery</p></div>
                </div>

                <div className="control-section">
                    <h4>Flight Altitude</h4>
                    <Slider
                        value={details.flightAltitude}
                        min={50}
                        max={400}
                        onChange={(val) => handleDetailChange('flightAltitude', val)}
                    />
                    <span>{details.flightAltitude} ft</span>
                </div>

                <div className="control-section toggle-section">
                    <h4>Enhanced 3D</h4>
                    <Switch checked={details.enhanced3d} onChange={(val) => handleDetailChange('enhanced3d', val)} />
                </div>
                <div className="control-section toggle-section">
                    <h4>Live Map HD</h4>
                    <Switch checked={details.liveMapHd} onChange={(val) => handleDetailChange('liveMapHd', val)} />
                </div>
                <div className="control-section toggle-section">
                    <h4>RTK Coverage</h4>
                    <Switch checked={details.rtkCoverage} onChange={(val) => handleDetailChange('rtkCoverage', val)} />
                </div>

                <div className="panel-footer">
                    <Button type="primary" loading={isSaving} onClick={handleSave} block>
                        Save & Update Thumbnail
                    </Button>
                </div>
            </div>

            <div className="main-content">
                <header className="main-header">
                    <div className="breadcrumbs">
                        <FiChevronLeft onClick={() => navigate('/projects')} className="back-icon" />
                        <span onClick={() => navigate('/projects')}>Home</span> / <span>{project?.name || 'Project'}</span>
                    </div>
                    <nav className="main-nav">
                        <a href="#fly" className="active">Fly</a>
                        <a href="#upload">Upload</a>
                        <a href="#explore">Explore</a>
                        <a href="#report">Report</a>
                    </nav>
                    <div className="header-actions">
                        <Button icon={<FiShare2 />}>Share</Button>
                        <Button icon={<FiUpload />} />
                        <Button icon={<FiSettings />} />
                        <Button icon={<FiBell />} />
                    </div>
                </header>
                <div className="map-container">
                    <MapContainer
                        key={polygonKey} // Corrected line
                        center={mapCenter}
                        zoom={15}
                        scrollWheelZoom={true}
                        className="leaflet-map-container"
                        ref={mapRef}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.esri.com/en-us/home">Esri</a> &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
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
                                    polygon: details.flightPath ? false : {
                                        shapeOptions: { color: '#007cbf' }
                                    }
                                }}
                            />
                            {polygonPositions && (
                                <Polygon positions={polygonPositions} pathOptions={{ color: '#007cbf' }} />
                            )}
                        </FeatureGroup>
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};
export default ProjectDetailPage;