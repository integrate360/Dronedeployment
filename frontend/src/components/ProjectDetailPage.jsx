import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Map, { Source, Layer } from 'react-map-gl';
import { toast } from 'react-toastify';
import { Switch, Slider, Button, Spin } from 'antd';
import { FiChevronLeft, FiShare2, FiUpload, FiSettings, FiBell } from 'react-icons/fi';
import * as turf from '@turf/turf';
import api from '../apis/config';

// --- CORRECT CSS IMPORT ---
// This must point to maplibre-gl's CSS file.
import 'maplibre-gl/dist/maplibre-gl.css';

import '../styles/ProjectDetailPage.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY;
const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`;


const ProjectDetailPage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const mapRef = useRef();

    const [project, setProject] = useState(null);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch initial project data (name, etc.)
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

    // Fetch project details (flight path, settings)
    const fetchDetails = useCallback(async () => {
        try {
            const response = await api.get(`/project-details/${projectId}`);
            setDetails(response.data);
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

            const canvas = mapRef.current?.getCanvas();
            if (canvas) {
                const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
                await api.put(`/projects/${projectId}`, { thumbnail });
                toast.success('Project saved and thumbnail updated!');
            } else {
                toast.success('Project details saved!');
            }
            fetchDetails();
        } catch (error) {
            toast.error('Failed to save project.');
        } finally {
            setIsSaving(false);
        }
    };

    const calculatedStats = useMemo(() => {
        if (!details?.flightPath) {
            return { minutes: 0, acres: 0, images: 0, battery: 0 };
        }
        const areaMeters = turf.area(details.flightPath);
        const acres = (areaMeters / 4046.86).toFixed(2);
        const images = Math.round(acres * 15);
        const minutes = (acres * 1.2).toFixed(2);
        const battery = Math.ceil(minutes / 15);
        return { minutes, acres, images, battery };
    }, [details]);


    if (loading || !details) {
        return <div className="loading-container"><Spin size="large" /></div>;
    }
    
    const polygonLayerStyle = { id: 'polygon', type: 'fill', paint: { 'fill-color': '#007cbf', 'fill-opacity': 0.5 } };
    const outlineLayerStyle = { id: 'outline', type: 'line', paint: { 'line-color': '#fff', 'line-width': 2 } };

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
                    <Map
                        ref={mapRef}
                        initialViewState={{
                            longitude: turf.center(details.flightPath).geometry.coordinates[0],
                            latitude: turf.center(details.flightPath).geometry.coordinates[1],
                            zoom: 14
                        }}
                        // --- THIS IS THE FIX ---
                        // Add an explicit style to force the map to fill its container.
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={MAPTILER_STYLE_URL}
                        preserveDrawingBuffer={true}
                    >
                        <Source id="my-data" type="geojson" data={details.flightPath}>
                            <Layer {...polygonLayerStyle} />
                            <Layer {...outlineLayerStyle} />
                        </Source>
                    </Map>
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailPage;